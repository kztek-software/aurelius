"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Helper đọc giá trị chỉ có ở phía client (localStorage, window.location, ...)
 * mà KHÔNG dùng `setState` trong `useEffect`.
 *
 * `useEffect` + `setState` để hydrate giá trị client gây thêm một lượt render
 * ngay sau khi mount (cascading render). `useSyncExternalStore` cho phép React
 * lấy snapshot server và snapshot client tách biệt, nên chỉ render một lần và
 * vẫn không bị hydration mismatch.
 */

/** Store không bao giờ thay đổi — dùng cho giá trị đọc một lần lúc mount. */
export function noopSubscribe(): () => void {
  return () => {};
}

const LOCAL_STORAGE_EVENT = "kztek-local-storage";

/** Lắng nghe thay đổi localStorage: từ tab khác (`storage`) và trong cùng tab. */
function subscribeToLocalStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_STORAGE_EVENT, onChange);
  };
}

/** Ghi localStorage và thông báo cho mọi `useLocalStorageRaw` trong cùng tab. */
export function writeLocalStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // localStorage không khả dụng (private mode, hết quota) -> bỏ qua
  }
  try {
    window.dispatchEvent(new Event(LOCAL_STORAGE_EVENT));
  } catch {
    // không có window (SSR) -> bỏ qua
  }
}

/**
 * Đọc chuỗi thô trong localStorage như một external store.
 * Trả về `null` khi render trên server, khi key chưa có, hoặc khi localStorage
 * bị chặn. Snapshot là chuỗi nên luôn ổn định theo tham chiếu — nơi gọi tự
 * `useMemo` nếu cần parse thành object.
 */
export function useLocalStorageRaw(key: string): string | null {
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  return useSyncExternalStore(subscribeToLocalStorage, getSnapshot, () => null);
}

/** `false` khi render trên server / lúc hydrate, `true` sau khi đã ở client. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * Đọc một query param của URL hiện tại như external store.
 * Trả về `null` trên server để hydration khớp với HTML do server sinh ra.
 */
export function useUrlParam(name: string): string | null {
  const getSnapshot = useCallback(() => {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch {
      return null;
    }
  }, [name]);

  return useSyncExternalStore(noopSubscribe, getSnapshot, () => null);
}
