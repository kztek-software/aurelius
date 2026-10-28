"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  ArrowRight,
  ListTodo,
  FileCheck,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import type { NotionDatabaseInfo, NotionTaskItem } from "@/lib/notion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { boardHref } from "@/lib/board-link";

export default function NotionMigrationPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();

  const [apiKey, setApiKey] = useState("");
  const [step, setStep] = useState<"token" | "databases" | "inspect">("token");

  // State kiểm tra kết nối
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    botName?: string;
    workspaceName?: string;
    error?: string;
  } | null>(null);

  // State danh sách Database
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [databases, setDatabases] = useState<NotionDatabaseInfo[]>([]);
  const [selectedDb, setSelectedDb] = useState<NotionDatabaseInfo | null>(null);

  // State danh sách Tasks từ Notion
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasks, setTasks] = useState<NotionTaskItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // State Import
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState("");

  // 1. Kiểm tra kết nối Token
  async function handleTestConnection() {
    if (!apiKey.trim()) {
      setErrorMsg("Vui lòng nhập Notion API Key (Internal Integration Token)");
      return;
    }
    setErrorMsg("");
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/integrations/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, error: data.error ?? "Không thể kết nối tới Notion" });
        return;
      }

      setTestResult({
        success: true,
        botName: data.botName,
        workspaceName: data.workspaceName,
      });

      // Tự động load danh sách Database sau khi test thành công
      await handleFetchDatabases();
    } catch {
      setTestResult({ success: false, error: "Lỗi kết nối mạng tới máy chủ" });
    } finally {
      setTesting(false);
    }
  }

  // 2. Tải danh sách Database
  async function handleFetchDatabases() {
    setLoadingDatabases(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/integrations/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "databases", apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Không lấy được danh sách Database từ Notion");
        return;
      }
      setDatabases(data.databases || []);
      setStep("databases");
    } catch {
      setErrorMsg("Lỗi khi tải Database từ Notion");
    } finally {
      setLoadingDatabases(false);
    }
  }

  // 3. Đọc dữ liệu tasks từ Database được chọn
  async function handleInspectDatabase(db: NotionDatabaseInfo) {
    setSelectedDb(db);
    setLoadingTasks(true);
    setErrorMsg("");
    setStep("inspect");
    try {
      const res = await fetch("/api/integrations/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tasks",
          apiKey,
          databaseId: db.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Không tải được tasks từ Database này");
        return;
      }
      setTasks(data.tasks || []);
    } catch {
      setErrorMsg("Lỗi khi đọc danh sách task từ Notion");
    } finally {
      setLoadingTasks(false);
    }
  }

  // 4. Nhập tasks vào Board KZTEK
  async function handleImportTasks() {
    if (!tasks.length) return;
    setImporting(true);
    setErrorMsg("");
    setImportSuccessMsg("");

    try {
      const res = await fetch(`/api/projects/${projectId}/notion/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Không thể nhập task từ Notion");
        return;
      }

      setImportSuccessMsg(`🎉 Đã nhập thành công ${data.importedCount} tasks từ Notion vào Board!`);
    } catch {
      setErrorMsg("Lỗi kết nối khi nhập dữ liệu");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Top Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-800 text-white font-bold text-xs shadow-sm border border-neutral-700">
            N
          </div>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              Chuyển đổi & Nhập dữ liệu từ Notion (Notion Migration Hub)
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                Live API Sync
              </span>
            </h1>
          </div>
        </div>

        {testResult?.success && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Đã kết nối: <strong>{testResult.workspaceName}</strong> ({testResult.botName})
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full space-y-4">
        {/* Step Progression Tabs */}
        <div className="grid grid-cols-3 gap-2 border-b border-line pb-3">
          <div
            onClick={() => setStep("token")}
            className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
              step === "token"
                ? "border-accent bg-accent/10 text-foreground"
                : "border-line bg-surface text-muted hover:border-line hover:text-foreground"
            }`}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === "token" ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              1
            </div>
            <div>
              <div className="text-xs font-semibold">Kết nối API Token</div>
              <div className="text-[11px] text-muted">Xác thực Notion Integration</div>
            </div>
          </div>

          <div
            onClick={() => databases.length > 0 && setStep("databases")}
            className={`flex items-center gap-2.5 rounded-xl border p-3 transition-all ${
              databases.length === 0
                ? "opacity-50 cursor-not-allowed border-line bg-surface text-muted"
                : step === "databases"
                ? "border-accent bg-accent/10 text-foreground cursor-pointer"
                : "border-line bg-surface text-muted hover:border-line hover:text-foreground cursor-pointer"
            }`}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === "databases" ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              2
            </div>
            <div>
              <div className="text-xs font-semibold">Chọn Database</div>
              <div className="text-[11px] text-muted">
                {databases.length > 0 ? `${databases.length} Database tìm thấy` : "Duyệt kho dữ liệu"}
              </div>
            </div>
          </div>

          <div
            onClick={() => selectedDb && setStep("inspect")}
            className={`flex items-center gap-2.5 rounded-xl border p-3 transition-all ${
              !selectedDb
                ? "opacity-50 cursor-not-allowed border-line bg-surface text-muted"
                : step === "inspect"
                ? "border-accent bg-accent/10 text-foreground cursor-pointer"
                : "border-line bg-surface text-muted hover:border-line hover:text-foreground cursor-pointer"
            }`}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === "inspect" ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              3
            </div>
            <div>
              <div className="text-xs font-semibold">Xem trước & Nhập Task</div>
              <div className="text-[11px] text-muted">
                {tasks.length > 0 ? `${tasks.length} tasks sẵn sàng` : "Kiểm tra dữ liệu"}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-accent-subtle p-3.5 text-xs text-foreground border border-accent/40 animate-fade-in-up">
            <AlertCircle className="h-4 w-4 shrink-0 text-accent" />
            <span>{errorMsg}</span>
          </div>
        )}

        {importSuccessMsg && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 p-3.5 text-xs text-emerald-600 border border-emerald-500/30 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{importSuccessMsg}</span>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(boardHref(projectId))}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Xem trên Board →
            </Button>
          </div>
        )}

        {/* STEP 1: TOKEN & CONNECTION */}
        {step === "token" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-xl border border-line bg-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notionToken" className="text-xs font-semibold text-foreground">
                    Notion Internal Integration Token (Secret Key)
                  </Label>
                  <span className="text-[11px] text-muted">Hỗ trợ định dạng `secret_...` hoặc `ntn_...`</span>
                </div>

                <div className="flex gap-2">
                  <Input
                    id="notionToken"
                    type="password"
                    placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <Button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="shrink-0"
                    size="sm"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Kiểm tra kết nối
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={`rounded-xl border p-4 text-xs space-y-2 mt-3 ${
                      testResult.success
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600"
                        : "border-accent/30 bg-accent-subtle text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Kết nối Notion API thành công!
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-accent" />
                          Kết nối thất bại
                        </>
                      )}
                    </div>
                    {testResult.success ? (
                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div>
                          <span className="text-muted">Tên Bot:</span>{" "}
                          <strong className="text-foreground">{testResult.botName}</strong>
                        </div>
                        <div>
                          <span className="text-muted">Workspace:</span>{" "}
                          <strong className="text-foreground">{testResult.workspaceName}</strong>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-accent">{testResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Guide Card */}
            <div className="rounded-xl border border-line bg-surface/60 p-4 space-y-3 text-xs text-muted">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <HelpCircle className="h-4 w-4 text-accent" />
                Hướng dẫn lấy Token Notion:
              </div>
              <ol className="list-decimal pl-4 space-y-2 text-[11px] leading-relaxed">
                <li>
                  Truy cập{" "}
                  <a
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline inline-flex items-center gap-0.5 font-medium"
                  >
                    notion.so/my-integrations <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </li>
                <li>Tạo một <strong>New integration</strong> đặt tên ví dụ: <code>KZTEK Sync</code>.</li>
                <li>Sao chép mã <strong>Internal Integration Secret</strong> và dán vào ô bên cạnh.</li>
                <li>
                  Mở trang Database công việc trên Notion $\rightarrow$ Bấm nút <code>...</code> (góc trên bên phải) $\rightarrow$ Chọn <strong>Add connections</strong> và chọn Bot vừa tạo.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* STEP 2: SELECT DATABASE */}
        {step === "databases" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                Danh sách Database trong Workspace Notion của bạn
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFetchDatabases}
                disabled={loadingDatabases}
                className="h-7 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${loadingDatabases ? "animate-spin" : ""}`} />
                Làm mới danh sách
              </Button>
            </div>

            {loadingDatabases ? (
              <div className="flex h-48 items-center justify-center text-xs text-muted">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Đang truy vấn Database từ Notion...
              </div>
            ) : databases.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface p-8 text-center text-xs text-muted space-y-2">
                <Database className="h-8 w-8 mx-auto text-muted/60" />
                <p className="font-semibold text-foreground text-sm">Không tìm thấy Database nào được cấp quyền</p>
                <p className="max-w-md mx-auto">
                  Bạn vui lòng mở Database trên Notion $\rightarrow$ Bấm <code>...</code> góc phải $\rightarrow$ Chọn <strong>Add connections</strong> và chọn Bot <strong>{testResult?.botName || "của bạn"}</strong>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {databases.map((db) => (
                  <div
                    key={db.id}
                    onClick={() => handleInspectDatabase(db)}
                    className="group rounded-xl border border-line bg-surface p-4 hover:border-accent/60 hover:bg-surface-2 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-foreground group-hover:text-accent flex items-center gap-2">
                          <Database className="h-4 w-4 text-accent shrink-0" />
                          {db.title}
                        </h4>
                        <a
                          href={db.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted hover:text-foreground"
                          title="Mở trên Notion"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {Object.values(db.properties).slice(0, 5).map((p, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-surface-2 group-hover:bg-line px-2 py-0.5 text-[10px] text-muted font-mono"
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end text-xs font-semibold text-accent">
                      Kiểm tra & Nhập dữ liệu <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: LIVE PREVIEW & IMPORT */}
        {step === "inspect" && selectedDb && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-surface p-3.5 rounded-xl border border-line">
              <div>
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Database className="h-4 w-4 text-accent" />
                  Database: <span className="text-accent">{selectedDb.title}</span>
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Đã tải trực tiếp <strong>{tasks.length} tasks</strong> từ Notion sẵn sàng chuyển đổi vào Board
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInspectDatabase(selectedDb)}
                  disabled={loadingTasks}
                  className="h-8 text-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingTasks ? "animate-spin" : ""}`} />
                  Tải lại
                </Button>
                <Button
                  size="sm"
                  onClick={handleImportTasks}
                  disabled={importing || tasks.length === 0}
                  className="h-8 text-xs font-semibold bg-accent hover:bg-accent/90"
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-amber-300 mr-1.5" />
                  )}
                  Bắt đầu Migrate ({tasks.length}) Task sang Board
                </Button>
              </div>
            </div>

            {loadingTasks ? (
              <div className="flex h-56 items-center justify-center text-xs text-muted">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Đang đọc toàn bộ dữ liệu từ Notion...
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface p-8 text-center text-xs text-muted space-y-2">
                <ListTodo className="h-8 w-8 mx-auto text-muted/60" />
                <p className="font-semibold text-foreground">Database này chưa có Task nào</p>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-surface-2 text-muted uppercase text-[10px] font-semibold border-b border-line">
                      <tr>
                        <th className="p-3">Tiêu đề Task (Notion)</th>
                        <th className="p-3">Trạng thái ánh xạ</th>
                        <th className="p-3">Mức độ ưu tiên</th>
                        <th className="p-3">Người phụ trách</th>
                        <th className="p-3">Hạn chót</th>
                        <th className="p-3 text-right">Notion Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {tasks.map((t) => (
                        <tr key={t.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="p-3 font-medium text-foreground max-w-[280px] truncate">
                            {t.title}
                          </td>
                          <td className="p-3">
                            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-foreground">
                              {t.status || "TODO"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-[11px] text-muted">{t.priority || "MEDIUM"}</span>
                          </td>
                          <td className="p-3 text-muted truncate max-w-[140px]">
                            {t.assigneeName || "Chưa giao"}
                          </td>
                          <td className="p-3 text-muted">
                            {t.dueDate ? t.dueDate.slice(0, 10) : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-accent hover:underline text-[11px]"
                            >
                              Xem trang <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
