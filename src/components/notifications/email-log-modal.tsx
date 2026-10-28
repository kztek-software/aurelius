"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Send,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Server,
  Sparkles,
  ExternalLink,
  Search,
  Check,
  X,
} from "lucide-react";
import { Dialog } from "primereact/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EmailLog = {
  id: string;
  to: string;
  toName?: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  type: "TASK_ASSIGNED" | "STATUS_CHANGED" | "COMMENTED" | "TEST" | "SYSTEM";
  status: "SENT" | "SIMULATED" | "FAILED";
  error?: string;
  createdAt: string;
};

export function EmailLogModal({
  visible,
  onHide,
  currentUserEmail,
}: {
  visible: boolean;
  onHide: () => void;
  currentUserEmail?: string;
}) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Test form state
  const [testEmail, setTestEmail] = useState(currentUserEmail || "admin@kztek.net");
  const [testName, setTestName] = useState("Quản trị viên KZTEK");
  const [sendingTest, setSendingTest] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState("");
  const [testErrorMessage, setTestErrorMessage] = useState("");

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications/email-logs?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setSmtpConfigured(Boolean(data.smtpConfigured));
        setSmtpHost(data.smtpHost || "");
        setFromEmail(data.fromEmail || "");
        if (data.logs?.length > 0 && !selectedLog) {
          setSelectedLog(data.logs[0]);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải email logs:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open: setState chỉ chạy sau await, rule không phân tích được biên async
      fetchLogs();
      if (currentUserEmail) setTestEmail(currentUserEmail);
    }
  }, [visible, searchQuery]);

  // Keyboard shortcuts listener for EmailLogModal
  useEffect(() => {
    if (!visible) return;

    function handleEmailModalKeyDown(e: KeyboardEvent) {
      // Ctrl + Enter / Cmd + Enter: Gửi thử email
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (testEmail && !sendingTest) {
          e.preventDefault();
          handleSendTest(e as unknown as React.FormEvent);
          return;
        }
      }

      // Alt + R: Tải lại danh sách log
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        fetchLogs();
        return;
      }
    }

    window.addEventListener("keydown", handleEmailModalKeyDown);
    return () => window.removeEventListener("keydown", handleEmailModalKeyDown);
  }, [visible, testEmail, testName, sendingTest]);

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail) return;

    setSendingTest(true);
    setTestSuccessMessage("");
    setTestErrorMessage("");

    try {
      const res = await fetch("/api/notifications/email-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: testEmail,
          recipientName: testName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestSuccessMessage(data.message || "Gửi email thử nghiệm thành công!");
        fetchLogs();
      } else {
        setTestErrorMessage(data.error || "Gửi email thất bại");
      }
    } catch {
      setTestErrorMessage("Không thể kết nối máy chủ gửi mail");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleClearLogs() {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử Outbox không?")) return;
    try {
      await fetch("/api/notifications/email-logs", { method: "DELETE" });
      setLogs([]);
      setSelectedLog(null);
    } catch (err) {
      console.error("Lỗi xóa logs:", err);
    }
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "TASK_ASSIGNED":
        return <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 border border-orange-500/20">Giao việc</span>;
      case "STATUS_CHANGED":
        return <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-500/20">Đổi trạng thái</span>;
      case "COMMENTED":
        return <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-600 border border-purple-500/20">Bình luận</span>;
      case "TEST":
        return <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">Thử nghiệm</span>;
      default:
        return <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Hệ thống</span>;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Đã gửi qua SMTP
          </span>
        );
      case "SIMULATED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" /> Lưu Outbox (Dev)
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FDE9E0] px-2 py-0.5 text-[10px] font-semibold text-accent border border-[#F9C7AA]">
            <AlertCircle className="h-3 w-3" /> Lỗi gửi
          </span>
        );
    }
  }

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                Hộp Thư Gửi & Quản Lý Notify Mail Service
                {smtpConfigured ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    SMTP Sẵn Sàng
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                    ⚡ Chế độ Outbox Simulator
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted">
                Theo dõi toàn bộ email thông báo giao việc và kiểm tra gửi email trực tiếp
              </p>
            </div>
          </div>
        </div>
      }
      style={{ width: "95vw", maxWidth: "1150px" }}
      contentClassName="p-0 bg-surface text-foreground"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-line min-h-[550px]">
        {/* Left Side: Test Sender & Email List */}
        <div className="lg:col-span-5 flex flex-col h-full bg-surface-2/30">
          {/* Quick Test Box */}
          <div className="p-4 border-b border-line bg-surface">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-accent" /> Gửi Thử Nghiệm Email
              </span>
              <span className="text-[10px] text-muted">Kiểm tra kết nối</span>
            </div>

            <form onSubmit={handleSendTest} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted">Tên người nhận</Label>
                  <Input
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Tên thành viên"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted">Email nhận</Label>
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="email@domain.com"
                    required
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {currentUserEmail && testEmail !== currentUserEmail && (
                  <button
                    type="button"
                    onClick={() => setTestEmail(currentUserEmail)}
                    className="text-[10px] text-accent hover:underline cursor-pointer"
                  >
                    Dùng email của tôi
                  </button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={sendingTest}
                  className="h-7 text-xs ml-auto cursor-pointer font-semibold gap-1.5"
                >
                  {sendingTest ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  <span>{sendingTest ? "Đang gửi..." : "Gửi thử ngay"}</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                    Ctrl+Enter
                  </kbd>
                </Button>
              </div>

              {testSuccessMessage && (
                <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-2 text-[11px] text-emerald-600 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0" /> {testSuccessMessage}
                </div>
              )}
              {testErrorMessage && (
                <div className="rounded bg-accent/10 border border-accent/20 p-2 text-[11px] text-accent flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {testErrorMessage}
                </div>
              )}
            </form>
          </div>

          {/* List Header & Search */}
          <div className="p-3 border-b border-line flex items-center justify-between gap-2 bg-surface">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none z-10" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm email, tiêu đề..."
                className="h-7.5 pl-8 text-xs bg-surface-2"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchLogs}
              disabled={loading}
              className="h-7.5 w-7.5 shrink-0 cursor-pointer"
              title="Tải lại danh sách (Alt+R)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {logs.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearLogs}
                className="h-7.5 w-7.5 shrink-0 text-muted hover:text-accent cursor-pointer"
                title="Xóa lịch sử outbox"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Outbox List */}
          <div className="flex-1 overflow-y-auto max-h-[380px] divide-y divide-line/60">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted space-y-2">
                <Mail className="h-8 w-8 mx-auto text-muted/40" />
                <p className="font-semibold text-foreground">Hộp thư Outbox đang trống</p>
                <p className="text-[11px]">
                  Khi bạn giao việc hoặc cập nhật task, các email thông báo sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3 text-left transition-colors cursor-pointer flex flex-col gap-1.5 ${
                    selectedLog?.id === log.id
                      ? "bg-accent/10 border-l-4 border-l-accent"
                      : "hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                      {log.toName ? `${log.toName} (${log.to})` : log.to}
                    </span>
                    <span className="text-[10px] text-muted shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-foreground line-clamp-1">
                    {log.subject}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {getTypeBadge(log.type)}
                    {getStatusBadge(log.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Live HTML Email Preview */}
        <div className="lg:col-span-7 flex flex-col h-full bg-surface">
          {selectedLog ? (
            <div className="flex flex-col h-full">
              {/* Preview Header */}
              <div className="p-4 border-b border-line bg-surface-2/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-accent" />
                    <span className="font-bold text-xs text-foreground">Xem trước Mẫu Email Thực tế</span>
                  </div>
                  {getStatusBadge(selectedLog.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-surface p-2.5 rounded-lg border border-line">
                  <div>
                    <span className="text-muted text-[11px] block">Người nhận:</span>
                    <span className="font-semibold text-foreground">
                      {selectedLog.toName ? `${selectedLog.toName} ` : ""}
                      &lt;{selectedLog.to}&gt;
                    </span>
                  </div>
                  <div>
                    <span className="text-muted text-[11px] block">Tiêu đề email:</span>
                    <span className="font-semibold text-foreground line-clamp-1">{selectedLog.subject}</span>
                  </div>
                </div>

                {selectedLog.error && (
                  <div className="rounded bg-accent/10 border border-accent/20 p-2 text-xs text-accent">
                    <strong>Lỗi SMTP:</strong> {selectedLog.error}
                  </div>
                )}
              </div>

              {/* Iframe Preview */}
              <div className="flex-1 p-3 bg-slate-100 dark:bg-slate-900/50 overflow-hidden min-h-[420px]">
                <iframe
                  title="Email Preview"
                  srcDoc={selectedLog.html}
                  className="w-full h-full min-h-[400px] rounded-lg border border-line bg-white shadow-sm"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted">
              <Eye className="h-10 w-10 text-muted/30 mb-2" />
              <p className="font-semibold text-foreground text-sm">Chưa chọn email để xem trước</p>
              <p className="text-xs max-w-sm mt-1">
                Chọn một email trong danh sách bên trái hoặc nhấn &quot;Gửi thử ngay&quot; để tạo email đầu tiên.
              </p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
