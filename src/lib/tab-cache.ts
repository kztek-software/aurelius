"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// Cấu trúc một bản ghi cache trong bộ nhớ RAM trình duyệt
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

// Bảng lưu trữ Cache toàn cục trên Client
const tabCache = new Map<string, CacheEntry>();

// Danh sách các listeners đăng ký nhận thông báo khi cache của 1 key thay đổi
const listeners = new Map<string, Set<(data: unknown) => void>>();

// Bộ gom trùng lặp request (Request Deduplication Map):
// Nếu có 2 component hoặc prefetch cùng gọi 1 URL đồng thời, chỉ 1 HTTP request thực sự được bắn đi
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Lấy dữ liệu từ cache nếu có
 */
export function getTabCache<T>(key: string): T | undefined {
  const entry = tabCache.get(key);
  return entry ? (entry.data as T) : undefined;
}

/**
 * Kiểm tra xem dữ liệu trong cache có bị cũ (stale) so với ngưỡng thời gian không
 */
export function isTabCacheStale(key: string, staleTimeMs: number = 15000): boolean {
  const entry = tabCache.get(key);
  if (!entry) return true;
  return Date.now() - entry.timestamp > staleTimeMs;
}

/**
 * Ghi dữ liệu vào cache và thông báo tới tất cả subscriber đang lắng nghe key này
 */
export function setTabCache<T>(key: string, data: T, broadcast: boolean = true): void {
  tabCache.set(key, {
    data,
    timestamp: Date.now(),
  });

  if (broadcast) {
    const keyListeners = listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[tab-cache] Error in listener for key ${key}:`, err);
        }
      });
    }
  }
}

/**
 * Cập nhật trực tiếp dữ liệu trong cache (Optimistic Update)
 * @param key Key của cache (hoặc URL endpoint)
 * @param updater Dữ liệu mới hoặc hàm chuyển đổi (prev => next)
 */
export function mutateTabCache<T>(
  key: string,
  updater: T | ((prev: T | undefined) => T)
): void {
  const current = getTabCache<T>(key);
  const nextData = typeof updater === "function" ? (updater as (prev: T | undefined) => T)(current) : updater;
  setTabCache(key, nextData, true);
}

/**
 * Hủy bỏ cache (Invalidate):
 * Xóa cache theo key cụ thể hoặc theo tiền tố URL (pattern) để lần truy cập tiếp theo bắt buộc lấy mới
 */
export function invalidateTabCache(keyOrPattern?: string | RegExp): void {
  if (!keyOrPattern) {
    tabCache.clear();
    return;
  }

  if (typeof keyOrPattern === "string") {
    tabCache.delete(keyOrPattern);
    // Xóa cả các key con bắt đầu bằng tiền tố này nếu có
    for (const k of Array.from(tabCache.keys())) {
      if (k.startsWith(keyOrPattern)) {
        tabCache.delete(k);
      }
    }
  } else if (keyOrPattern instanceof RegExp) {
    for (const k of Array.from(tabCache.keys())) {
      if (keyOrPattern.test(k)) {
        tabCache.delete(k);
      }
    }
  }
}

/**
 * Tải trước dữ liệu (Prefetch) ngầm khi hover vào nút chuyển tab
 */
export async function prefetchTab<T>(
  url: string,
  customHeaders?: Record<string, string>
): Promise<T | null> {
  // Nếu cache còn mới (dưới 30 giây), không cần prefetch lại
  if (!isTabCacheStale(url, 30000)) {
    return getTabCache<T>(url) || null;
  }

  // Nếu đang có request chạy cùng URL, dùng chung promise đó
  if (inflightRequests.has(url)) {
    return (await inflightRequests.get(url)) as T;
  }

  const promise = (async () => {
    try {
      const headers: Record<string, string> = { ...customHeaders };
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("flowboard_session") : null;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {}

      const res = await fetch(url, {
        credentials: "same-origin",
        headers,
      });

      if (!res.ok) return null;
      const data = (await res.json()) as T;
      setTabCache(url, data, true);
      return data;
    } catch {
      return null;
    } finally {
      inflightRequests.delete(url);
    }
  })();

  inflightRequests.set(url, promise);
  return await promise;
}

export interface UseTabCacheOptions<T> {
  staleTime?: number; // Thời gian (ms) coi dữ liệu là còn mới (mặc định 15s)
  enabled?: boolean;  // Có kích hoạt fetch không
  initialData?: T | null;
  onSuccess?: (data: T) => void;
  onError?: (err: unknown) => void;
}

export interface UseTabCacheResult<T> {
  data: T | null;
  loading: boolean;        // true chỉ khi chưa có dữ liệu nào (lần đầu tiên hoàn toàn)
  isValidating: boolean;   // true khi đang revalidate ngầm ở background
  error: unknown | null;
  mutate: (updater: T | null | ((prev: T | null) => T | null)) => void;
  revalidate: () => Promise<T | null>;
}

/**
 * Universal Hook quản lý dữ liệu Tab với cơ chế Stale-While-Revalidate (SWR):
 * - Nếu trong cache đã có dữ liệu -> Trả về NGAY LẬP TỨC (loading = false, 0ms latency)
 * - Nếu dữ liệu đã cũ hơn staleTime -> Tự động kích hoạt revalidate ngầm ở background và cập nhật êm
 * - Tự động đồng bộ khi các tab/component khác mutate cùng key
 */
export function useTabCache<T>(
  key: string | null | undefined,
  fetcher: () => Promise<T>,
  options: UseTabCacheOptions<T> = {}
): UseTabCacheResult<T> {
  const {
    staleTime = 15000,
    enabled = true,
    initialData = null,
    onSuccess,
    onError,
  } = options;

  // Lấy dữ liệu sẵn có trong cache (nếu có)
  const cachedData = key ? getTabCache<T>(key) : undefined;
  const hasCachedData = cachedData !== undefined;

  const [data, setData] = useState<T | null>(() => {
    if (hasCachedData) return cachedData as T;
    return initialData;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (!enabled || !key) return false;
    return !hasCachedData && initialData === null;
  });

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<unknown | null>(null);

  // Ref lưu fetcher & callbacks để tránh dependency loop trong useEffect.
  // Gán trong effect (không phải trong lúc render): effect này khai báo TRƯỚC
  // các effect khác nên luôn cập nhật ref xong trước khi chúng chạy.
  const fetcherRef = useRef(fetcher);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    fetcherRef.current = fetcher;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  // Đồng bộ state khi `key` thay đổi. Giá trị lúc mount đã được lấy từ cache
  // trong useState initializer, nên ở đây chỉ xử lý các lần key đổi về sau —
  // làm ngay trong lúc render để không render thừa với dữ liệu của key cũ.
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    const nextCached = key ? getTabCache<T>(key) : undefined;
    if (nextCached !== undefined) {
      setData(nextCached);
      setLoading(false);
    } else {
      setData(initialData);
      setLoading(Boolean(enabled && key));
    }
    setError(null);
  }

  // Đăng ký listener lắng nghe thay đổi của key này từ các component khác
  useEffect(() => {
    if (!key) return;

    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }
    const keyListeners = listeners.get(key)!;

    const handleUpdate = (newData: unknown) => {
      setData(newData as T);
      setLoading(false);
    };

    keyListeners.add(handleUpdate);

    return () => {
      keyListeners.delete(handleUpdate);
      if (keyListeners.size === 0) {
        listeners.delete(key);
      }
    };
  }, [key]);

  // Hàm Revalidate lấy dữ liệu mới nhất từ server
  const revalidate = useCallback(async (): Promise<T | null> => {
    if (!key || !enabled) return null;

    // Khử trùng lặp: Nếu đang có request cho key này, đợi kết quả chung
    if (inflightRequests.has(key)) {
      setIsValidating(true);
      try {
        const result = (await inflightRequests.get(key)) as T;
        setData(result);
        return result;
      } finally {
        setIsValidating(false);
        setLoading(false);
      }
    }

    setIsValidating(true);
    setError(null);

    const promise = (async () => {
      try {
        const freshData = await fetcherRef.current();
        setTabCache(key, freshData, true);
        setData(freshData);
        onSuccessRef.current?.(freshData);
        return freshData;
      } catch (err) {
        setError(err);
        onErrorRef.current?.(err);
        return null;
      } finally {
        setIsValidating(false);
        setLoading(false);
        inflightRequests.delete(key);
      }
    })();

    inflightRequests.set(key, promise);
    return await promise;
  }, [key, enabled]);

  // Kích hoạt revalidate khi mount hoặc khi key thay đổi.
  // `data`/`loading` đã được đặt đúng ở useState initializer (mount) và ở khối
  // đồng bộ key phía trên, nên effect này chỉ còn việc gọi fetch.
  useEffect(() => {
    if (!key || !enabled) return;

    // Có cache -> chỉ revalidate ngầm khi dữ liệu đã cũ hơn staleTime.
    if (getTabCache<T>(key) !== undefined && !isTabCacheStale(key, staleTime)) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: revalidate() chỉ setState sau await, rule không phân tích được async
    revalidate();
  }, [key, enabled, staleTime, revalidate]);

  // Hàm mutate cục bộ
  const mutate = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) => {
      if (!key) return;
      const next = typeof updater === "function" ? (updater as (prev: T | null) => T | null)(data) : updater;
      setData(next);
      if (next !== null) {
        setTabCache(key, next, true);
      } else {
        tabCache.delete(key);
      }
    },
    [key, data]
  );

  return {
    data,
    loading,
    isValidating,
    error,
    mutate,
    revalidate,
  };
}
