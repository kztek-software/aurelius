"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowRight, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUrlParam } from "@/lib/client-store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  // Lỗi từ URL (khi gửi form HTML truyền thống thất bại) được đọc như external
  // store thay vì setState trong useEffect.
  const errParam = useUrlParam("error");
  const urlError =
    errParam === "invalid_credentials"
      ? "Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại."
      : errParam === "missing_fields"
        ? "Vui lòng nhập đầy đủ tài khoản và mật khẩu."
        : errParam
          ? "Đăng nhập không thành công. Vui lòng thử lại."
          : "";

  // Lỗi do submit bằng fetch được ưu tiên hiển thị so với lỗi còn lại trên URL.
  // `urlErrorDismissed` cho phép đóng banner lỗi đọc từ URL (URL không đổi được
  // ở đây nên cần cờ riêng).
  const [urlErrorDismissed, setUrlErrorDismissed] = useState(false);
  const error = formError || (urlErrorDismissed ? "" : urlError);

  function clearError() {
    setFormError("");
    setUrlErrorDismissed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Tài khoản hoặc mật khẩu không chính xác.");
        return;
      }
      if (data.token) {
        document.cookie = `flowboard_session=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        try { localStorage.setItem("flowboard_session", data.token); } catch {}
      }
      window.location.href = data.user?.mustChangePassword ? "/change-password" : "/";
    } catch {
      setFormError("Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng.");
    } finally {
      setLoading(false);
    }
  }

  async function quickLogin(account: string, pass: string) {
    setEmail(account);
    setPassword(pass);
    clearError();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account, password: pass }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        if (d.token) {
          document.cookie = `flowboard_session=${d.token}; path=/; max-age=604800; SameSite=Lax`;
          try { localStorage.setItem("flowboard_session", d.token); } catch {}
        }
        window.location.href = d.user?.mustChangePassword ? "/change-password" : "/";
      } else {
        setFormError(d.error ?? "Không thể đăng nhập vào tài khoản này.");
      }
    } catch {
      setFormError("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo & Header */}
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F05922] font-black text-white text-xl shadow-lg shadow-[#F05922]/20">
            KZ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">KZTEK Work Management</h1>
            <p className="text-xs text-muted mt-0.5">Hệ thống điều hành & quản lý công việc nội bộ</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
          {/* Thông báo lỗi đăng nhập nổi bật */}
          {error && (
            <div
              className="relative flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent-subtle p-3.5 text-xs text-foreground shadow-md animate-in fade-in slide-in-from-top-2 duration-200"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-bold text-accent">Đăng nhập không thành công</div>
                <div className="text-[11px] text-foreground/90 leading-relaxed">{error}</div>
                <div className="text-[10px] text-accent/70 pt-0.5">
                  💡 Gợi ý: Kiểm tra lại email/mật khẩu, hoặc bấm nút đăng nhập 1-Click bên dưới.
                </div>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="text-accent hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form
            action="/api/auth/login"
            method="POST"
            onSubmit={handleSubmit}
            suppressHydrationWarning
            className="space-y-3.5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">Tài khoản hoặc Email</Label>
              <Input
                id="email"
                name="email"
                type="text"
                placeholder="admin hoặc email@kztek.net"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs h-9 bg-surface-2"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">Mật khẩu</Label>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs h-9 bg-surface-2 font-mono"
                required
              />
            </div>

            <Button type="submit" className="w-full h-9 text-xs font-bold" disabled={loading}>
              {loading ? "Đang xử lý..." : "Đăng nhập hệ thống"}
            </Button>
          </form>

          {/* Quick Login Section */}
          <div className="space-y-2 pt-2 border-t border-line">
            <div className="text-[11px] font-medium text-muted text-center">Đăng nhập nhanh 1-Click:</div>

            {/* Default Admin Button */}
            <button
              type="button"
              onClick={() => quickLogin("admin", "Kztek@2026")}
              disabled={loading}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 text-xs font-semibold transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-orange-600" />
                <span>Admin Mặc Định</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            {/* Demo Members */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => quickLogin("alice@demo.dev", "demo123")}
                disabled={loading}
                className="h-7 text-[11px] border-line hover:bg-surface-2"
              >
                Alice (PM)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => quickLogin("binh@demo.dev", "demo123")}
                disabled={loading}
                className="h-7 text-[11px] border-line hover:bg-surface-2"
              >
                Bình (Dev)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => quickLogin("chi@demo.dev", "demo123")}
                disabled={loading}
                className="h-7 text-[11px] border-line hover:bg-surface-2"
              >
                Chi (Dev)
              </Button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Đăng ký tài khoản mới
          </Link>
        </p>
      </div>
    </div>
  );
}
