"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useLocalStorageRaw, writeLocalStorage } from "@/lib/client-store";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = "kztek-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // localStorage được đọc như external store: snapshot server là `null` nên
  // hydration khớp với HTML ("dark"), rồi React nhận giá trị client ngay trong
  // cùng lượt commit — không cần setState trong useEffect.
  const stored = useLocalStorageRaw(STORAGE_KEY);

  // `override` giữ lựa chọn của phiên hiện tại và được ưu tiên hơn localStorage,
  // nhờ đó theme vẫn đổi được khi localStorage bị chặn (private mode, hết quota).
  const [override, setOverride] = useState<Theme | null>(null);
  const persisted: Theme | null = stored === "light" || stored === "dark" ? stored : null;
  const theme: Theme = override ?? persisted ?? "dark";

  // `data-theme` là DOM ngoài tầm kiểm soát của React -> đồng bộ qua effect.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setOverride(newTheme);
    writeLocalStorage(STORAGE_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
