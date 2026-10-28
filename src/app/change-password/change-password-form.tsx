"use client";

import { useState } from "react";
import { KeyRound, AlertCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm({ userName, forced }: { userName: string; forced: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không đổi được mật khẩu.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    try { localStorage.removeItem("flowboard_session"); } catch {}
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F05922] text-white shadow-lg shadow-[#F05922]/20">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Đổi mật khẩu</h1>
            <p className="text-xs text-muted mt-0.5">
              {forced
                ? `Xin chào ${userName}, bạn cần đặt mật khẩu mới trước khi sử dụng hệ thống.`
                : `Xin chào ${userName}, cập nhật mật khẩu đăng nhập của bạn.`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
          {error && (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent-subtle p-3.5 text-xs text-foreground"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-xs font-semibold">
                {forced ? "Mật khẩu được cấp (trong email)" : "Mật khẩu hiện tại"}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="text-xs h-9 bg-surface-2 font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-xs font-semibold">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Tối thiểu 6 ký tự..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-xs h-9 bg-surface-2 font-mono"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-xs h-9 bg-surface-2 font-mono"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full h-9 text-xs font-bold" disabled={loading}>
              {loading ? "Đang xử lý..." : "Lưu mật khẩu mới"}
            </Button>
          </form>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
