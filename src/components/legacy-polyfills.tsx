"use client";

if (typeof window !== "undefined") {
  // 1. Polyfill ResizeObserver
  if (!("ResizeObserver" in window)) {
    (window as any).ResizeObserver = class ResizeObserver {
      callback: (entries: any[]) => void;
      constructor(callback: (entries: any[]) => void) {
        this.callback = callback;
      }
      observe(target: Element) {
        if (target) {
          try {
            const rect = target.getBoundingClientRect();
            this.callback([
              {
                target,
                contentRect: rect,
                borderBoxSize: [{ inlineSize: rect.width || 300, blockSize: rect.height || 200 }],
                contentBoxSize: [{ inlineSize: rect.width || 300, blockSize: rect.height || 200 }],
              },
            ]);
          } catch (e) {}
        }
      }
      unobserve() {}
      disconnect() {}
    };
  }

  // 2. Polyfill IntersectionObserver
  if (!("IntersectionObserver" in window)) {
    (window as any).IntersectionObserver = class IntersectionObserver {
      callback: (entries: any[]) => void;
      constructor(callback: (entries: any[]) => void) {
        this.callback = callback;
      }
      observe(target: Element) {
        if (target) {
          try {
            this.callback([
              {
                target,
                isIntersecting: true,
                intersectionRatio: 1,
                boundingClientRect: target.getBoundingClientRect(),
              },
            ]);
          } catch (e) {}
        }
      }
      unobserve() {}
      disconnect() {}
    };
  }

  // 3. Polyfill structuredClone
  if (!("structuredClone" in window)) {
    (window as any).structuredClone = function (obj: any) {
      if (obj === undefined) return undefined;
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        return obj;
      }
    };
  }

  // 4. Polyfill requestIdleCallback
  if (!("requestIdleCallback" in window)) {
    (window as any).requestIdleCallback = function (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) {
      return setTimeout(() => {
        try {
          cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50),
          });
        } catch (e) {}
      }, 1);
    };
    (window as any).cancelIdleCallback = function (id: number) {
      clearTimeout(id);
    };
  }

  // 5. Polyfill matchMedia
  if (!("matchMedia" in window)) {
    (window as any).matchMedia = function (query: string) {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {
          return false;
        },
      };
    };
  }
}

export function LegacyPolyfills() {
  return null;
}
