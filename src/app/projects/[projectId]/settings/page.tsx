"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Settings,
  Mail,
  Building2,
  BellRing,
  Activity,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  ArrowLeft,
  Globe,
  Phone,
  HelpCircle,
  Database,
  ExternalLink,
  Radio,
  Sparkles,
  MessageCircle,
  Link2,
  Unlink,
  Smartphone,
  Bot,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { boardHref } from "@/lib/board-link";

type SystemConfigState = {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    from: string;
    fromName: string;
  };
  branding: {
    systemName: string;
    companyName: string;
    hotline: string;
    supportEmail: string;
    website: string;
    appUrl: string;
  };
  notifications: {
    notifyOnAssign: boolean;
    notifyOnStatusChange: boolean;
    notifyOnComment: boolean;
    enableRealtimeSse: boolean;
  };
  zalo: {
    enabled: boolean;
    appId: string;
    appSecret: string;
    oaId: string;
    oaSecretKey: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: string | null;
    znsTemplateId: string;
    notifyOnAssign: boolean;
    notifyOnStatusChange: boolean;
    notifyOnComment: boolean;
  };
  discord: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    botToken: string;
    webhookUrl: string;
    notifyOnAssign: boolean;
    notifyOnStatusChange: boolean;
    notifyOnComment: boolean;
    webhookOnAssign: boolean;
    webhookOnStatusChange: boolean;
    webhookOnComment: boolean;
  };
  updatedAt?: string;
  updatedBy?: string;
};

export default function AdminSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  const [activeTab, setActiveTab] = useState<"smtp" | "branding" | "notifications" | "zalo" | "discord" | "diagnostics">("smtp");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showZaloSecret, setShowZaloSecret] = useState(false);

  // Success / Error Alerts
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Test Email state
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Test Zalo state
  const [testZaloUserId, setTestZaloUserId] = useState("");
  const [testZaloPhone, setTestZaloPhone] = useState("");
  const [sendingZaloTest, setSendingZaloTest] = useState<"OA" | "ZNS" | null>(null);
  const [zaloTestResult, setZaloTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Test Discord state
  const [testDiscordUserId, setTestDiscordUserId] = useState("");
  const [sendingDiscordTest, setSendingDiscordTest] = useState<"DM" | "WEBHOOK" | null>(null);
  const [discordTestResult, setDiscordTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showDiscordSecret, setShowDiscordSecret] = useState(false);

  // Config State
  const [config, setConfig] = useState<SystemConfigState>({
    smtp: {
      host: "",
      port: 587,
      user: "",
      pass: "",
      secure: false,
      from: "no-reply@kztek.net",
      fromName: "KZTEK Work Management",
    },
    branding: {
      systemName: "KZTEK Work Management",
      companyName: "CÔNG TY CỔ PHẦN CÔNG NGHỆ KZTEK",
      hotline: "024 3782 2288",
      supportEmail: "support@kztek.net",
      website: "https://kztek.net",
      appUrl: "http://localhost:3000",
    },
    notifications: {
      notifyOnAssign: true,
      notifyOnStatusChange: true,
      notifyOnComment: true,
      enableRealtimeSse: true,
    },
    zalo: {
      enabled: false,
      appId: "",
      appSecret: "",
      oaId: "",
      oaSecretKey: "",
      accessToken: "",
      refreshToken: "",
      tokenExpiresAt: null,
      znsTemplateId: "",
      notifyOnAssign: false,
      notifyOnStatusChange: false,
      notifyOnComment: false,
    },
    discord: {
      enabled: false,
      clientId: "",
      clientSecret: "",
      botToken: "",
      webhookUrl: "",
      notifyOnAssign: false,
      notifyOnStatusChange: false,
      notifyOnComment: false,
      webhookOnAssign: false,
      webhookOnStatusChange: false,
      webhookOnComment: false,
    },
  });

  async function fetchConfig() {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/system/config");
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "Không thể tải cấu hình hệ thống");
      }
    } catch {
      setErrorMessage("Lỗi kết nối tới máy chủ cấu hình");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: setState chỉ chạy sau await, rule không phân tích được biên async
    fetchConfig();

    // Xử lý kết quả redirect về từ Zalo OAuth callback (?zalo_oauth=connected|error)
    const searchParams = new URLSearchParams(window.location.search);
    const zaloOauthStatus = searchParams.get("zalo_oauth");
    if (zaloOauthStatus === "connected") {
      setActiveTab("zalo");
      setSuccessMessage("✓ Kết nối Zalo OA thành công! Access token đã được lưu vào CSDL.");
    } else if (zaloOauthStatus === "error") {
      setActiveTab("zalo");
      setErrorMessage(searchParams.get("zalo_oauth_message") || "Kết nối Zalo OA thất bại");
    }
    if (zaloOauthStatus) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleSaveConfig(e?: React.FormEvent | React.MouseEvent) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const res = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage("✓ Lưu cấu hình hệ thống vào CSDL PostgreSQL thành công!");
        if (data.config) {
          setConfig(data.config);
        }
        setTimeout(() => setSuccessMessage(""), 5000);
      } else {
        setErrorMessage(data.error || "Lỗi khi lưu cấu hình");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage("Không thể kết nối máy chủ để lưu cấu hình: " + msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!testEmail) {
      alert("Vui lòng nhập địa chỉ email nhận kiểm tra");
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/notifications/email-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: testEmail,
          recipientName: "Quản trị viên Kiểm thử",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult({
          success: true,
          message: data.message || "Gửi email thử nghiệm thành công! Kiểm tra hộp thư.",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Gửi email thử nghiệm thất bại.",
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Lỗi kết nối khi gửi thử nghiệm email",
      });
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendZaloTest(channel: "OA" | "ZNS") {
    if (channel === "OA" && !testZaloUserId) {
      alert("Vui lòng nhập Zalo User ID để gửi thử qua OA");
      return;
    }
    if (channel === "ZNS" && !testZaloPhone) {
      alert("Vui lòng nhập số điện thoại để gửi thử qua ZNS");
      return;
    }

    setSendingZaloTest(channel);
    setZaloTestResult(null);

    try {
      const res = await fetch("/api/integrations/zalo/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          zaloUserId: channel === "OA" ? testZaloUserId : undefined,
          phone: channel === "ZNS" ? testZaloPhone : undefined,
        }),
      });
      const data = await res.json();
      setZaloTestResult({
        success: res.ok,
        message: res.ok ? data.message || "Gửi thử thành công!" : data.error || "Gửi thử thất bại",
      });
    } catch {
      setZaloTestResult({ success: false, message: "Lỗi kết nối khi gửi thử Zalo" });
    } finally {
      setSendingZaloTest(null);
    }
  }

  function getZaloAuthorizationUrl(): string {
    const redirectUri = `${(config.branding.appUrl || window.location.origin).replace(/\/+$/, "")}/api/integrations/zalo/oauth/callback`;
    const params = new URLSearchParams({
      app_id: config.zalo.appId,
      redirect_uri: redirectUri,
      state: projectId,
    });
    return `https://oauth.zaloapp.com/v4/oa/permission?${params.toString()}`;
  }

  async function handleSendDiscordTest(channel: "DM" | "WEBHOOK") {
    if (channel === "DM" && !testDiscordUserId) {
      alert("Vui lòng nhập Discord User ID để gửi thử qua DM");
      return;
    }

    setSendingDiscordTest(channel);
    setDiscordTestResult(null);

    try {
      const res = await fetch("/api/integrations/discord/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          discordUserId: channel === "DM" ? testDiscordUserId : undefined,
        }),
      });
      const data = await res.json();
      setDiscordTestResult({
        success: res.ok,
        message: res.ok ? data.message || "Gửi thử thành công!" : data.error || "Gửi thử thất bại",
      });
    } catch {
      setDiscordTestResult({ success: false, message: "Lỗi kết nối khi gửi thử Discord" });
    } finally {
      setSendingDiscordTest(null);
    }
  }

  function applyPreset(type: "gmail" | "office365" | "custom") {
    if (type === "gmail") {
      setConfig((prev) => ({
        ...prev,
        smtp: {
          ...prev.smtp,
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
        },
      }));
    } else if (type === "office365") {
      setConfig((prev) => ({
        ...prev,
        smtp: {
          ...prev.smtp,
          host: "smtp.office365.com",
          port: 587,
          secure: false,
        },
      }));
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-muted">
          <RefreshCw className="h-8 w-8 animate-spin text-accent" />
          <p className="text-xs font-semibold">Đang tải cấu hình hệ thống từ PostgreSQL...</p>
        </div>
      </div>
    );
  }

  // Access Denied Screen if user is not ADMIN
  if (accessDenied) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-2xl border border-accent/30 bg-surface p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle text-accent mb-4 ring-8 ring-accent/5">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <h2 className="text-lg font-bold text-foreground">Truy Cập Bị Từ Chối</h2>
          <p className="text-xs text-muted leading-relaxed mt-2">
            Trang Cấu hình Hệ thống được bảo vệ nghiêm ngặt. Chỉ có tài khoản với quyền <strong>Quản Trị Viên (ADMIN)</strong> mới có quyền xem và điều chỉnh các thông số này.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Button
              onClick={() => router.push(boardHref(projectId))}
              className="font-bold text-xs gap-1.5 cursor-pointer bg-accent hover:bg-accent/90"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại Board Công Việc
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[#d44715] text-white shadow-lg shadow-accent/25 ring-4 ring-accent/10">
            <Settings className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Trung Tâm Cấu Hình Hệ Thống</h1>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-black text-accent border border-accent/30 flex items-center gap-1 shrink-0">
                <ShieldCheck className="h-3 w-3" /> CHỈ ADMIN
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Quản lý máy chủ Email SMTP, nhận diện thương hiệu công ty và quy tắc thông báo giao việc
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="w-full sm:w-auto font-bold text-xs gap-2 bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/20 cursor-pointer h-9 px-4 rounded-xl"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? "Đang lưu CSDL..." : "Lưu Toàn Bộ Cấu Hình"}</span>
          </Button>
        </div>
      </div>

      {/* Status Alerts */}
      {successMessage && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-600 font-semibold flex items-center justify-between gap-2 animate-fade-in-up shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <span className="text-[10px] font-mono opacity-70">Đã đồng bộ PostgreSQL</span>
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl bg-accent-subtle border border-accent/30 p-3.5 text-xs text-accent font-semibold flex items-center gap-2 animate-fade-in-up shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-px">
        <button
          onClick={() => setActiveTab("smtp")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap rounded-t-xl ${
            activeTab === "smtp"
              ? "border-accent text-accent bg-accent/5 font-extrabold"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-2"
          }`}
        >
          <Mail className="h-4 w-4 shrink-0" />
          <span>Máy Chủ Email (SMTP)</span>
        </button>

        <button
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap rounded-t-xl ${
            activeTab === "branding"
              ? "border-accent text-accent bg-accent/5 font-extrabold"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-2"
          }`}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span>Thương Hiệu & Base URL</span>
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap rounded-t-xl ${
            activeTab === "notifications"
              ? "border-accent text-accent bg-accent/5 font-extrabold"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-2"
          }`}
        >
          <BellRing className="h-4 w-4 shrink-0" />
          <span>Quy Tắc Thông Báo</span>
        </button>

        <button
          onClick={() => setActiveTab("zalo")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap rounded-t-xl ${
            activeTab === "zalo"
              ? "border-accent text-accent bg-accent/5 font-extrabold"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-2"
          }`}
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span>Zalo (ZNS/OA)</span>
          {!config.zalo.enabled && (
            <span className="px-1.5 py-0.1 rounded text-[8px] font-black bg-surface-3 text-muted border border-line font-mono">
              CHƯA BẬT
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("discord")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap rounded-t-xl ${
            activeTab === "discord"
              ? "border-accent text-accent bg-accent/5 font-extrabold"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-2"
          }`}
        >
          <Bot className="h-4 w-4 shrink-0" />
          <span>Discord</span>
          {!config.discord.enabled && (
            <span className="px-1.5 py-0.1 rounded text-[8px] font-black bg-surface-3 text-muted border border-line font-mono">
              CHƯA BẬT
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer whitespace-nowrap rounded-t-xl ${
            activeTab === "diagnostics"
              ? "border-accent text-accent bg-accent/5 font-extrabold"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-2"
          }`}
        >
          <Activity className="h-4 w-4 shrink-0" />
          <span>Chẩn Đoán & Trạng Thái</span>
        </button>
      </div>

      {/* Tab 1: Cấu hình Email & SMTP */}
      {activeTab === "smtp" && (
        <div key="smtp" className="space-y-6">
          {/* Quick Presets */}
          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-accent/10 text-accent">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">Thiết Lập Nhanh Nhà Cung Cấp Email</div>
                <div className="text-[11px] text-muted">Chọn mẫu cấu hình máy chủ phổ biến để tự động điền thông số kết nối</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("gmail")}
                className="text-xs h-8 cursor-pointer font-semibold bg-surface-2 hover:bg-line"
              >
                Google Gmail
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("office365")}
                className="text-xs h-8 cursor-pointer font-semibold bg-surface-2 hover:bg-line"
              >
                Microsoft 365
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cột 1: Thông số kết nối */}
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                  <Server className="h-4 w-4 text-accent" /> Thông Số Kết Nối Máy Chủ SMTP
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">SMTP Host (Máy chủ gửi) *</Label>
                  <Input
                    placeholder="VD: smtp.gmail.com hoặc mail.kztek.net"
                    value={config.smtp.host}
                    onChange={(e) =>
                      setConfig({ ...config, smtp: { ...config.smtp, host: e.target.value } })
                    }
                    className="h-9 text-xs bg-surface-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Cổng (Port) *</Label>
                    <Input
                      type="number"
                      placeholder="587 hoặc 465"
                      value={config.smtp.port}
                      onChange={(e) =>
                        setConfig({ ...config, smtp: { ...config.smtp, port: Number(e.target.value) } })
                      }
                      className="h-9 text-xs bg-surface-2"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                      <input
                        type="checkbox"
                        checked={config.smtp.secure}
                        onChange={(e) =>
                          setConfig({ ...config, smtp: { ...config.smtp, secure: e.target.checked } })
                        }
                        className="rounded border-line text-accent h-4 w-4"
                      />
                      <span className="text-xs font-medium">Bật SSL/TLS (Port 465)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tài khoản gửi (Username / Email) *</Label>
                  <Input
                    placeholder="VD: notification@kztek.net"
                    value={config.smtp.user}
                    onChange={(e) =>
                      setConfig({ ...config, smtp: { ...config.smtp, user: e.target.value } })
                    }
                    className="h-9 text-xs bg-surface-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Mật khẩu / App Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu ứng dụng..."
                      value={config.smtp.pass || ""}
                      onChange={(e) =>
                        setConfig({ ...config, smtp: { ...config.smtp, pass: e.target.value } })
                      }
                      className="h-9 text-xs bg-surface-2 pr-9 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer p-1"
                      title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-accent" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">
                    Với Gmail/Office365, hãy sử dụng <strong>App Password (Mật khẩu ứng dụng 16 ký tự)</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-line flex justify-end">
                <Button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="font-bold text-xs gap-1.5 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9"
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu Cấu Hình SMTP"}
                </Button>
              </div>
            </div>

            {/* Cột 2: Thông tin hiển thị & Thử nghiệm */}
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                  <Mail className="h-4 w-4 text-accent" /> Thông Tin Người Gửi & Thử Nghiệm
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Email hiển thị người gửi (From Address) *</Label>
                  <Input
                    placeholder="VD: no-reply@kztek.net"
                    value={config.smtp.from}
                    onChange={(e) =>
                      setConfig({ ...config, smtp: { ...config.smtp, from: e.target.value } })
                    }
                    className="h-9 text-xs bg-surface-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tên người gửi đại diện (From Name) *</Label>
                  <Input
                    placeholder="VD: KZTEK Work Management"
                    value={config.smtp.fromName}
                    onChange={(e) =>
                      setConfig({ ...config, smtp: { ...config.smtp, fromName: e.target.value } })
                    }
                    className="h-9 text-xs bg-surface-2"
                  />
                </div>

                <div className="rounded-xl border border-dashed border-line bg-surface-2/60 p-4 space-y-3 mt-4">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-accent" /> Gửi Thử Nghiệm Email Kết Nối
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Nhập email nhận kiểm tra..."
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="h-9 text-xs bg-surface"
                    />
                    <Button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={sendingTest || !testEmail}
                      className="shrink-0 text-xs font-bold gap-1 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9 px-3"
                    >
                      {sendingTest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      <span>Gửi Thử</span>
                    </Button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-2.5 rounded-lg text-xs font-medium ${
                        testResult.success
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
                          : "bg-accent-subtle border border-accent/20 text-accent"
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-[11px] text-muted space-y-1">
                <div className="font-bold text-accent">📌 Lưu ý về máy chủ gửi Email:</div>
                <div>
                  Toàn bộ cấu hình SMTP được lưu vào CSDL PostgreSQL và duy trì vĩnh viễn qua các lần khởi động lại máy chủ.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Cấu hình Thương hiệu & Base URL */}
      {activeTab === "branding" && (
        <div key="branding" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Nhận diện doanh nghiệp */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                <Building2 className="h-4 w-4 text-accent" /> Nhận Diện Thương Hiệu Doanh Nghiệp
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tên hệ thống ứng dụng</Label>
                <Input
                  value={config.branding.systemName}
                  onChange={(e) =>
                    setConfig({ ...config, branding: { ...config.branding, systemName: e.target.value } })
                  }
                  className="h-9 text-xs bg-surface-2"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tên công ty / Doanh nghiệp</Label>
                <Input
                  value={config.branding.companyName}
                  onChange={(e) =>
                    setConfig({ ...config, branding: { ...config.branding, companyName: e.target.value } })
                  }
                  className="h-9 text-xs bg-surface-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted" /> Hotline hỗ trợ
                  </Label>
                  <Input
                    value={config.branding.hotline}
                    onChange={(e) =>
                      setConfig({ ...config, branding: { ...config.branding, hotline: e.target.value } })
                    }
                    className="h-9 text-xs bg-surface-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted" /> Email hỗ trợ
                  </Label>
                  <Input
                    value={config.branding.supportEmail}
                    onChange={(e) =>
                      setConfig({ ...config, branding: { ...config.branding, supportEmail: e.target.value } })
                    }
                    className="h-9 text-xs bg-surface-2"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Globe className="h-3 w-3 text-muted" /> Trang web công ty (Website URL)
                </Label>
                <Input
                  placeholder="https://kztek.net"
                  value={config.branding.website}
                  onChange={(e) =>
                    setConfig({ ...config, branding: { ...config.branding, website: e.target.value } })
                  }
                  className="h-9 text-xs bg-surface-2"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <Button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="font-bold text-xs gap-1.5 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu Thông Tin Thương Hiệu"}
              </Button>
            </div>
          </div>

          {/* Card 2: App Base URL & Live Preview */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                <Globe className="h-4 w-4 text-accent" /> Cấu Hình Địa Chỉ Web/App (App Base URL)
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-accent flex items-center gap-1.5">
                    <span>Địa chỉ Web/App hệ thống (Base URL) *</span>
                  </Label>
                  <span className="text-[10px] text-muted font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-line">
                    Dùng cho nút bấm trong Email
                  </span>
                </div>
                <Input
                  placeholder="VD: http://192.168.21.48:3000 hoặc https://work.kztek.net"
                  value={config.branding.appUrl}
                  onChange={(e) =>
                    setConfig({ ...config, branding: { ...config.branding, appUrl: e.target.value } })
                  }
                  className="h-9.5 text-xs bg-surface-2 font-mono font-bold text-accent border-accent/40 focus:border-accent"
                  required
                />
              </div>

              {/* Live Preview Card */}
              <div className="rounded-xl border border-line bg-surface-2/70 p-4 space-y-2.5">
                <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-accent" /> Mô phỏng liên kết trong Email người dùng:
                </div>
                <div className="p-3 rounded-lg bg-surface border border-line space-y-2">
                  <div className="text-xs font-semibold text-foreground">
                    📋 Bạn có một công việc mới: <strong>Triển khai module cấu hình CSDL</strong>
                  </div>
                  <div className="text-[11px] text-muted">
                    Bấm vào nút dưới đây để truy cập trực tiếp vào hệ thống:
                  </div>
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold shadow-sm">
                      Xem công việc →
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-muted truncate border-t border-line/60 pt-1.5">
                    🔗 URL thực tế: <span className="text-accent font-semibold">{config.branding.appUrl || "http://localhost:3000"}</span>/projects/{projectId}/board?taskId=...
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-[11px] text-muted space-y-1">
                <div className="font-bold text-accent flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" /> Hướng dẫn cấu hình IP / Domain:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li><strong>Mạng LAN nội bộ:</strong> Nhập IP máy chủ kèm cổng (VD: <code className="font-mono text-foreground font-semibold">http://192.168.21.48:3000</code>).</li>
                  <li><strong>Tên miền Internet:</strong> Nhập Domain kèm giao thức HTTPS (VD: <code className="font-mono text-foreground font-semibold">https://work.kztek.net</code>).</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <Button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="font-bold text-xs gap-1.5 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu Base URL & Thương Hiệu"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Quy tắc Thông báo */}
      {activeTab === "notifications" && (
        <div key="notifications" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Email Triggers */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                <BellRing className="h-4 w-4 text-accent" /> Quy Tắc Kích Hoạt Email Tự Động
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.notifications.notifyOnAssign}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        notifications: { ...config.notifications, notifyOnAssign: e.target.checked },
                      })
                    }
                    className="rounded border-line text-accent h-4.5 w-4.5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-foreground">Gửi email khi giao việc (Task Assignment)</div>
                    <div className="text-[11px] text-muted mt-0.5 leading-relaxed">
                      Tự động gửi email thông báo chi tiết đến người được chỉ định phụ trách công việc mới hoặc nhận bàn giao.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.notifications.notifyOnStatusChange}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        notifications: { ...config.notifications, notifyOnStatusChange: e.target.checked },
                      })
                    }
                    className="rounded border-line text-accent h-4.5 w-4.5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-foreground">Gửi email khi thay đổi trạng thái (Status Changed)</div>
                    <div className="text-[11px] text-muted mt-0.5 leading-relaxed">
                      Thông báo cho người tạo và người phụ trách khi task chuyển cột (TODO, IN_PROGRESS, DONE).
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.notifications.notifyOnComment}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        notifications: { ...config.notifications, notifyOnComment: e.target.checked },
                      })
                    }
                    className="rounded border-line text-accent h-4.5 w-4.5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-foreground">Gửi email khi có bình luận mới (Task Comments)</div>
                    <div className="text-[11px] text-muted mt-0.5 leading-relaxed">
                      Thông báo cho những người liên quan khi có thành viên trao đổi, thảo luận trong công việc.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <Button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="font-bold text-xs gap-1.5 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu Quy Tắc Thông Báo"}
              </Button>
            </div>
          </div>

          {/* Card 2: Real-time SSE & Live Stream */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                <Radio className="h-4 w-4 text-accent" /> Cơ Chế Cập Nhật Thời Gian Thực (Real-Time)
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifications.enableRealtimeSse}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      notifications: { ...config.notifications, enableRealtimeSse: e.target.checked },
                    })
                  }
                  className="rounded border-line text-accent h-4.5 w-4.5 mt-0.5 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>Kích hoạt Server-Sent Events (SSE)</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Khuyến nghị
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Tự động làm mới bảng Kanban và nhận thông báo In-App trong thời gian thực khi có thay đổi từ đồng nghiệp mà không cần nhấn F5.
                  </div>
                </div>
              </label>

              <div className="rounded-xl border border-line bg-surface-2/70 p-4 space-y-2 text-xs">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-accent" /> Trạng thái kênh truyền tải:
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-surface border border-line">
                    <div className="text-muted text-[10px]">Kênh In-App:</div>
                    <div className="font-bold text-emerald-600 font-mono mt-0.5 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Hoạt động
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-line">
                    <div className="text-muted text-[10px]">Kênh Email SMTP:</div>
                    <div className="font-bold text-emerald-600 font-mono mt-0.5 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Sẵn sàng
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-[11px] text-muted">
              <div>
                💡 Thiết lập thông báo được áp dụng trên phạm vi toàn hệ thống cho tất cả các dự án.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Tích hợp Zalo (ZNS/OA) */}
      {activeTab === "zalo" && (
        <div key="zalo" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Thông số kết nối App/OA */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3 justify-between">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-accent" /> Thông Số Ứng Dụng Zalo Developer
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.zalo.enabled}
                    onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, enabled: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-semibold">Bật tích hợp</span>
                </label>
              </div>

              <div className="rounded-xl border border-dashed border-line bg-surface-2/60 p-3 text-[11px] text-muted leading-relaxed">
                Tạo App tại <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" className="text-accent font-semibold underline">developers.zalo.me</a>, gắn với Official Account đã đăng ký tại <a href="https://oa.zalo.me" target="_blank" rel="noreferrer" className="text-accent font-semibold underline">oa.zalo.me</a>. Sau đó khai báo <strong>Webhook URL</strong> = <code className="font-mono text-foreground">{(config.branding.appUrl || "").replace(/\/+$/, "")}/api/integrations/zalo/webhook</code> và <strong>OAuth Redirect URL</strong> = <code className="font-mono text-foreground">{(config.branding.appUrl || "").replace(/\/+$/, "")}/api/integrations/zalo/oauth/callback</code> trong cấu hình App.
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">App ID</Label>
                <Input
                  placeholder="VD: 1234567890123456789"
                  value={config.zalo.appId}
                  onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, appId: e.target.value } })}
                  className="h-9 text-xs bg-surface-2 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">App Secret Key</Label>
                <div className="relative">
                  <Input
                    type={showZaloSecret ? "text" : "password"}
                    placeholder="Secret Key từ developers.zalo.me"
                    value={config.zalo.appSecret}
                    onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, appSecret: e.target.value } })}
                    className="h-9 text-xs bg-surface-2 pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowZaloSecret(!showZaloSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer p-1"
                  >
                    {showZaloSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-accent" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Official Account ID</Label>
                  <Input
                    placeholder="OA ID"
                    value={config.zalo.oaId}
                    onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, oaId: e.target.value } })}
                    className="h-9 text-xs bg-surface-2 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">OA Secret Key (verify webhook)</Label>
                  <Input
                    type="password"
                    placeholder="OA Secret Key"
                    value={config.zalo.oaSecretKey}
                    onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, oaSecretKey: e.target.value } })}
                    className="h-9 text-xs bg-surface-2 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ZNS Template ID (đã được Zalo duyệt)</Label>
                <Input
                  placeholder="VD: 123456"
                  value={config.zalo.znsTemplateId}
                  onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, znsTemplateId: e.target.value } })}
                  className="h-9 text-xs bg-surface-2 font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <Button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="font-bold text-xs gap-1.5 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu Cấu Hình Zalo"}
              </Button>
            </div>
          </div>

          {/* Card 2: Kết nối OAuth, Quy tắc thông báo & Gửi thử */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                <Link2 className="h-4 w-4 text-accent" /> Kết Nối OAuth & Trạng Thái Token
              </div>

              <div className="p-3 rounded-xl bg-surface-2/70 border border-line space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Access Token:</span>
                  <span className={`font-bold font-mono ${config.zalo.accessToken ? "text-emerald-600" : "text-muted"}`}>
                    {config.zalo.accessToken ? "Đã có • •" : "Chưa kết nối"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">Hết hạn lúc:</span>
                  <span className="font-semibold font-mono text-foreground">
                    {config.zalo.tokenExpiresAt ? new Date(config.zalo.tokenExpiresAt).toLocaleString("vi-VN") : "—"}
                  </span>
                </div>
              </div>

              {config.zalo.appId ? (
                <a
                  href={getZaloAuthorizationUrl()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold h-9 px-4 transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" /> Kết Nối OA (OAuth Zalo)
                </a>
              ) : (
                <div className="text-[11px] text-muted italic">Nhập & lưu App ID trước khi kết nối OAuth.</div>
              )}
              <p className="text-[11px] text-muted leading-relaxed">
                Cần lưu App ID/Secret trước, App phải khai báo đúng Redirect URL ở trên tại developers.zalo.me. Access token hết hạn sau 1 giờ, hệ thống tự làm mới bằng refresh_token khi gửi tin.
              </p>

              <div className="border-t border-line/60 pt-3 space-y-3">
                <div className="text-xs font-bold text-foreground">Quy Tắc Kích Hoạt Thông Báo Zalo</div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.zalo.notifyOnAssign}
                    onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, notifyOnAssign: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-medium">Giao việc mới</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.zalo.notifyOnStatusChange}
                    onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, notifyOnStatusChange: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-medium">Đổi trạng thái công việc</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.zalo.notifyOnComment}
                    onChange={(e) => setConfig({ ...config, zalo: { ...config.zalo, notifyOnComment: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-medium">Bình luận & nhắc đến (@mention)</span>
                </label>
              </div>

              <div className="rounded-xl border border-dashed border-line bg-surface-2/60 p-4 space-y-3 mt-2">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-accent" /> Gửi Thử Nghiệm
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Zalo User ID (đã follow OA)"
                    value={testZaloUserId}
                    onChange={(e) => setTestZaloUserId(e.target.value)}
                    className="h-9 text-xs bg-surface font-mono"
                  />
                  <Button
                    type="button"
                    onClick={() => handleSendZaloTest("OA")}
                    disabled={sendingZaloTest !== null}
                    className="shrink-0 text-xs font-bold gap-1 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9 px-3"
                  >
                    {sendingZaloTest === "OA" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    <span>OA</span>
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Số điện thoại (ZNS)"
                    value={testZaloPhone}
                    onChange={(e) => setTestZaloPhone(e.target.value)}
                    className="h-9 text-xs bg-surface font-mono"
                  />
                  <Button
                    type="button"
                    onClick={() => handleSendZaloTest("ZNS")}
                    disabled={sendingZaloTest !== null}
                    className="shrink-0 text-xs font-bold gap-1 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9 px-3"
                  >
                    {sendingZaloTest === "ZNS" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                    <span>ZNS</span>
                  </Button>
                </div>

                {zaloTestResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium ${
                      zaloTestResult.success
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
                        : "bg-accent-subtle border border-accent/20 text-accent"
                    }`}
                  >
                    {zaloTestResult.message}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-[11px] text-muted space-y-1">
              <div className="font-bold text-accent flex items-center gap-1">
                <Unlink className="h-3.5 w-3.5" /> Cách người dùng liên kết tài khoản Zalo:
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Tự liên kết (miễn phí, dùng kênh OA):</strong> user vào menu tài khoản → &quot;Kết nối Zalo&quot; → gửi mã 6 số tới OA.</li>
                <li><strong>Admin nhập tay (dùng kênh ZNS, tính phí):</strong> nhập số điện thoại cho user tại trang Quản trị Cơ cấu & Phân quyền.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Tích hợp Discord (Bot DM + Webhook kênh chung) */}
      {activeTab === "discord" && (
        <div key="discord" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Thông số Application/Bot Discord */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3 justify-between">
                <span className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-accent" /> Thông Số Discord Application & Bot
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.discord.enabled}
                    onChange={(e) => setConfig({ ...config, discord: { ...config.discord, enabled: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-semibold">Bật tích hợp</span>
                </label>
              </div>

              <div className="rounded-xl border border-dashed border-line bg-surface-2/60 p-3 text-[11px] text-muted leading-relaxed">
                Tạo Application + Bot tại <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-accent font-semibold underline">discord.com/developers/applications</a>. Mời Bot vào server của KZTEK (OAuth2 URL Generator, scope <code className="font-mono text-foreground">bot</code>). Khai báo <strong>OAuth2 Redirect URL</strong> = <code className="font-mono text-foreground">{(config.branding.appUrl || "").replace(/\/+$/, "")}/api/integrations/discord/oauth/callback</code> trong tab OAuth2 của Application. Lưu ý: Bot chỉ DM được user nào cùng ở server với Bot.
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Application (Client) ID</Label>
                <Input
                  placeholder="VD: 1234567890123456789"
                  value={config.discord.clientId}
                  onChange={(e) => setConfig({ ...config, discord: { ...config.discord, clientId: e.target.value } })}
                  className="h-9 text-xs bg-surface-2 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client Secret (OAuth2)</Label>
                <div className="relative">
                  <Input
                    type={showDiscordSecret ? "text" : "password"}
                    placeholder="Client Secret từ tab OAuth2"
                    value={config.discord.clientSecret}
                    onChange={(e) => setConfig({ ...config, discord: { ...config.discord, clientSecret: e.target.value } })}
                    className="h-9 text-xs bg-surface-2 pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDiscordSecret(!showDiscordSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer p-1"
                  >
                    {showDiscordSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-accent" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Bot Token</Label>
                <Input
                  type="password"
                  placeholder="Bot Token từ tab Bot"
                  value={config.discord.botToken}
                  onChange={(e) => setConfig({ ...config, discord: { ...config.discord, botToken: e.target.value } })}
                  className="h-9 text-xs bg-surface-2 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Webhook className="h-3 w-3 text-muted" /> Webhook URL (kênh chung)
                </Label>
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={config.discord.webhookUrl}
                  onChange={(e) => setConfig({ ...config, discord: { ...config.discord, webhookUrl: e.target.value } })}
                  className="h-9 text-xs bg-surface-2 font-mono"
                />
                <p className="text-[11px] text-muted">Tạo tại: Cài đặt kênh Discord → Tích hợp → Webhook → Tạo Webhook mới.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <Button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving}
                className="font-bold text-xs gap-1.5 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu Cấu Hình Discord"}
              </Button>
            </div>
          </div>

          {/* Card 2: Quy tắc thông báo & Gửi thử */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                <MessageCircle className="h-4 w-4 text-accent" /> DM Cá Nhân (chỉ user đã tự liên kết)
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.discord.notifyOnAssign}
                  onChange={(e) => setConfig({ ...config, discord: { ...config.discord, notifyOnAssign: e.target.checked } })}
                  className="rounded border-line text-accent h-4 w-4"
                />
                <span className="text-[11px] font-medium">Giao việc mới</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.discord.notifyOnStatusChange}
                  onChange={(e) => setConfig({ ...config, discord: { ...config.discord, notifyOnStatusChange: e.target.checked } })}
                  className="rounded border-line text-accent h-4 w-4"
                />
                <span className="text-[11px] font-medium">Đổi trạng thái công việc</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.discord.notifyOnComment}
                  onChange={(e) => setConfig({ ...config, discord: { ...config.discord, notifyOnComment: e.target.checked } })}
                  className="rounded border-line text-accent h-4 w-4"
                />
                <span className="text-[11px] font-medium">Bình luận & nhắc đến (@mention)</span>
              </label>

              <div className="border-t border-line/60 pt-3 space-y-3">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Webhook className="h-3.5 w-3.5 text-accent" /> Đăng Vào Kênh Chung (Webhook)
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.discord.webhookOnAssign}
                    onChange={(e) => setConfig({ ...config, discord: { ...config.discord, webhookOnAssign: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-medium">Giao việc mới</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.discord.webhookOnStatusChange}
                    onChange={(e) => setConfig({ ...config, discord: { ...config.discord, webhookOnStatusChange: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-medium">Đổi trạng thái công việc</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.discord.webhookOnComment}
                    onChange={(e) => setConfig({ ...config, discord: { ...config.discord, webhookOnComment: e.target.checked } })}
                    className="rounded border-line text-accent h-4 w-4"
                  />
                  <span className="text-[11px] font-medium">Bình luận mới</span>
                </label>
              </div>

              <div className="rounded-xl border border-dashed border-line bg-surface-2/60 p-4 space-y-3 mt-2">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-accent" /> Gửi Thử Nghiệm
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Discord User ID (cùng server với Bot)"
                    value={testDiscordUserId}
                    onChange={(e) => setTestDiscordUserId(e.target.value)}
                    className="h-9 text-xs bg-surface font-mono"
                  />
                  <Button
                    type="button"
                    onClick={() => handleSendDiscordTest("DM")}
                    disabled={sendingDiscordTest !== null}
                    className="shrink-0 text-xs font-bold gap-1 bg-accent hover:bg-accent/90 text-white cursor-pointer h-9 px-3"
                  >
                    {sendingDiscordTest === "DM" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    <span>DM</span>
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSendDiscordTest("WEBHOOK")}
                  disabled={sendingDiscordTest !== null}
                  className="w-full text-xs font-bold gap-1.5 bg-surface-2 hover:bg-line cursor-pointer h-9"
                >
                  {sendingDiscordTest === "WEBHOOK" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Webhook className="h-3.5 w-3.5" />}
                  Gửi Thử Webhook Kênh Chung
                </Button>

                {discordTestResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium ${
                      discordTestResult.success
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
                        : "bg-accent-subtle border border-accent/20 text-accent"
                    }`}
                  >
                    {discordTestResult.message}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-[11px] text-muted space-y-1">
              <div className="font-bold text-accent flex items-center gap-1">
                <Unlink className="h-3.5 w-3.5" /> Cách người dùng liên kết tài khoản Discord:
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Tự liên kết (qua OAuth):</strong> user vào menu tài khoản → &quot;Kết nối Discord&quot; → đăng nhập Discord xác thực.</li>
                <li><strong>Admin nhập tay:</strong> nhập Discord User ID (bật Chế độ Nhà phát triển trong Discord để copy ID) tại trang Quản trị Cơ cấu & Phân quyền.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Chẩn đoán & Trạng thái */}
      {activeTab === "diagnostics" && (
        <div key="diagnostics" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Thông số môi trường */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
              <Activity className="h-4 w-4 text-accent" /> Thông Số Môi Trường Ứng Dụng
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2.5 border-b border-line/50">
                <span className="text-muted font-medium">Phiên bản hệ thống:</span>
                <span className="font-bold font-mono text-foreground">v2.4.0-enterprise (Build 2026.08)</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-line/50">
                <span className="text-muted font-medium">Framework & Engine:</span>
                <span className="font-bold font-mono text-foreground">Next.js 16 (App Router) + React 19</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-line/50">
                <span className="text-muted font-medium">Cơ sở dữ liệu CSDL:</span>
                <span className="font-bold font-mono text-emerald-600 flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" /> PostgreSQL (WorkingManager)
                </span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-line/50">
                <span className="text-muted font-medium">Dịch vụ Email Engine:</span>
                <span className="font-bold font-mono text-emerald-600">SMTP Engine RFC 5321 (Nodemailer Pool)</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted font-medium">App Base URL hiện hành:</span>
                <span className="font-bold font-mono text-accent">{config.branding.appUrl || "http://localhost:3000"}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Lịch sử Cập nhật CSDL */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-bold text-xs text-foreground flex items-center gap-2 border-b border-line/60 pb-3">
                <Database className="h-4 w-4 text-accent" /> Trạng Thái Lưu Trữ & Đồng Bộ CSDL
              </div>

              <div className="p-4 rounded-xl bg-surface-2/60 border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted font-medium">Bảng lưu trữ:</span>
                  <span className="font-mono text-xs font-bold text-foreground">dbo.SystemSetting</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted font-medium">Khóa chính (Primary Key):</span>
                  <span className="font-mono text-xs font-bold text-accent">id = &quot;default&quot;</span>
                </div>
                <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
                  <span className="text-xs text-muted font-medium">Cập nhật lần cuối:</span>
                  <span className="font-semibold text-xs text-foreground">
                    {config.updatedAt ? new Date(config.updatedAt).toLocaleString("vi-VN") : "Chưa ghi nhận"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted font-medium">Người thực hiện:</span>
                  <span className="font-semibold text-xs text-foreground">
                    {config.updatedBy || "Quản trị viên KZTEK"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={fetchConfig}
                className="font-bold text-xs gap-1.5 bg-surface-2 hover:bg-line cursor-pointer h-9"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Đồng Bộ Lại Từ PostgreSQL
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
