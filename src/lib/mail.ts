import net from "node:net";
import tls from "node:tls";
import { getEffectiveSmtpConfig, getAppBaseUrl } from "@/lib/system-config";

export type EmailLogType = "TASK_ASSIGNED" | "STATUS_CHANGED" | "COMMENTED" | "TASK_MENTION" | "TEST" | "SYSTEM";
export type EmailLogStatus = "SENT" | "SIMULATED" | "FAILED";

export type EmailLogEntry = {
  id: string;
  to: string;
  toName?: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  type: EmailLogType;
  status: EmailLogStatus;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type SmtpConfig = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  fromName?: string;
  secure?: boolean;
  rejectUnauthorized?: boolean;
};

export type SendMailOptions = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  type?: EmailLogType;
  metadata?: Record<string, unknown>;
  // Nội dung lưu vào Outbox Log thay cho html/text thật (dùng khi email chứa thông tin nhạy cảm như mật khẩu)
  logHtml?: string;
  logText?: string;
};

export type TaskEmailPayload = {
  taskNumber: number;
  taskTitle: string;
  taskDescription?: string | null;
  taskType: string;
  priority: string;
  dueDate?: string | null;
  projectName: string;
  projectKey: string;
  projectId: string;
  taskId?: string;
  assignorName: string;
  assigneeName: string;
  assigneeEmail: string;
  taskUrl?: string;
};

export type StatusChangeEmailPayload = {
  taskNumber: number;
  taskTitle: string;
  projectName: string;
  projectId: string;
  taskId?: string;
  oldStatus: string;
  newStatus: string;
  actorName: string;
  recipientName: string;
  recipientEmail: string;
  taskUrl?: string;
};

export type CommentEmailPayload = {
  taskNumber: number;
  taskTitle: string;
  projectName: string;
  projectId: string;
  taskId?: string;
  authorName: string;
  commentBody: string;
  recipientName: string;
  recipientEmail: string;
  taskUrl?: string;
};

export type TaskMentionEmailPayload = {
  taskNumber: number;
  taskTitle: string;
  projectName: string;
  projectKey: string;
  projectId: string;
  taskId: string;
  authorName: string;
  commentBody: string;
  recipientName: string;
  recipientEmail: string;
  taskUrl?: string;
};

// Global in-memory email outbox (persists across API calls in the Node process)
const emailOutbox: EmailLogEntry[] = [];
const MAX_OUTBOX_SIZE = 200;

function getSmtpConfig(): SmtpConfig {
  return getEffectiveSmtpConfig();
}

export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
}

export function getEmailLogs(): EmailLogEntry[] {
  return [...emailOutbox];
}

export function clearEmailLogs(): void {
  emailOutbox.length = 0;
}

function saveEmailLog(entry: EmailLogEntry) {
  emailOutbox.unshift(entry);
  if (emailOutbox.length > MAX_OUTBOX_SIZE) {
    emailOutbox.pop();
  }
}

/**
 * Gửi email qua SMTP socket chuẩn (RFC 5321) với hỗ trợ TLS/STARTTLS và AUTH LOGIN
 */
async function sendViaSmtpSocket(config: SmtpConfig, options: SendMailOptions): Promise<void> {
  if (!config.host) throw new Error("SMTP host is not defined");

  return new Promise((resolve, reject) => {
    let client: net.Socket | tls.TLSSocket;
    let step = 0;
    const timeout = 10000;

    const fromAddress = config.from || "no-reply@kztek.net";
    const fromName = config.fromName || "KZTEK Work Management";

    function send(cmd: string) {
      client.write(cmd + "\r\n");
    }

    const timer = setTimeout(() => {
      if (client) client.destroy();
      reject(new Error("SMTP connection timed out"));
    }, timeout);

    const onData = (data: Buffer) => {
      const response = data.toString();
      const code = parseInt(response.slice(0, 3), 10);

      // Handle standard SMTP responses
      if (code >= 400) {
        clearTimeout(timer);
        client.destroy();
        return reject(new Error(`SMTP Error [${code}]: ${response.trim()}`));
      }

      if (step === 0 && code === 220) {
        // Initial greeting -> send EHLO
        step++;
        send("EHLO localhost");
      } else if (step === 1 && code === 250) {
        if (!config.secure && (config.port === 587 || response.includes("STARTTLS"))) {
          // Send STARTTLS
          step = 10;
          send("STARTTLS");
        } else if (config.user && config.pass) {
          step = 2;
          send("AUTH LOGIN");
        } else {
          step = 4;
          send(`MAIL FROM:<${fromAddress}>`);
        }
      } else if (step === 10 && code === 220) {
        // Upgrade socket to TLS
        client.removeAllListeners("data");
        const secureSocket = tls.connect(
          {
            socket: client as net.Socket,
            host: config.host,
            rejectUnauthorized: config.rejectUnauthorized ?? false,
          },
          () => {
            client = secureSocket;
            client.on("data", onData);
            step = 11;
            send("EHLO localhost");
          }
        );
        secureSocket.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      } else if (step === 11 && code === 250) {
        if (config.user && config.pass) {
          step = 2;
          send("AUTH LOGIN");
        } else {
          step = 4;
          send(`MAIL FROM:<${fromAddress}>`);
        }
      } else if (step === 2 && code === 334) {
        // Username
        step = 3;
        send(Buffer.from(config.user || "").toString("base64"));
      } else if (step === 3 && code === 334) {
        // Password
        step = 4;
        send(Buffer.from(config.pass || "").toString("base64"));
      } else if (step === 4 && (code === 235 || code === 250)) {
        // Auth success -> MAIL FROM
        step = 5;
        send(`MAIL FROM:<${fromAddress}>`);
      } else if (step === 5 && code === 250) {
        // RCPT TO
        step = 6;
        send(`RCPT TO:<${options.to}>`);
      } else if (step === 6 && code === 250) {
        // DATA
        step = 7;
        send("DATA");
      } else if (step === 7 && code === 354) {
        // Send email body
        step = 8;
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const headers = [
          `From: =?UTF-8?B?${Buffer.from(fromName).toString("base64")}?= <${fromAddress}>`,
          `To: ${options.toName ? `=?UTF-8?B?${Buffer.from(options.toName).toString("base64")}?= ` : ""}<${options.to}>`,
          `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString("base64")}?=`,
          `MIME-Version: 1.0`,
          `Date: ${new Date().toUTCString()}`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          `Content-Transfer-Encoding: 8bit`,
          "",
          options.text || options.subject,
          "",
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: 8bit`,
          "",
          options.html,
          "",
          `--${boundary}--`,
          ".",
        ].join("\r\n");

        send(headers);
      } else if (step === 8 && code === 250) {
        // Email sent -> QUIT
        step = 9;
        send("QUIT");
        clearTimeout(timer);
        client.end();
        resolve();
      }
    };

    if (config.secure) {
      client = tls.connect(
        {
          host: config.host,
          port: config.port || 465,
          rejectUnauthorized: config.rejectUnauthorized ?? false,
        },
        () => {
          client.on("data", onData);
        }
      );
    } else {
      client = net.connect(
        {
          host: config.host,
          port: config.port || 587,
        },
        () => {
          client.on("data", onData);
        }
      );
    }

    client.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Gửi email chính với cơ chế fallback tự động sang Simulated Outbox Log
 */
export async function sendMail(options: SendMailOptions): Promise<EmailLogEntry> {
  const config = getSmtpConfig();
  const id = `mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const from = config.from || "no-reply@kztek.net";

  const logEntry: EmailLogEntry = {
    id,
    to: options.to,
    toName: options.toName,
    from,
    subject: options.subject,
    html: options.logHtml ?? options.html,
    text: options.logText ?? options.text,
    type: options.type || "SYSTEM",
    status: "SIMULATED",
    metadata: options.metadata,
    createdAt: new Date().toISOString(),
  };

  const configured = isSmtpConfigured();

  if (configured) {
    try {
      await sendViaSmtpSocket(config, options);
      logEntry.status = "SENT";
      console.log(`\n✅ [EMAIL SENT VIA SMTP] to ${options.to} - Subject: ${options.subject}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logEntry.status = "FAILED";
      logEntry.error = errorMsg;
      console.error(`\n❌ [EMAIL SMTP FAILED] ${errorMsg} - Fallback to Outbox Log`);
    }
  } else {
    // Mode Simulated (Khi chưa cấu hình biến môi trường SMTP)
    logEntry.status = "SIMULATED";
    console.log(`\n📧 [EMAIL SIMULATED (OUTBOX)]`);
    console.log(`   To: ${options.toName ? `${options.toName} ` : ""}<${options.to}>`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Type: ${options.type || "SYSTEM"}`);
    console.log(`   Time: ${logEntry.createdAt}\n`);
  }

  saveEmailLog(logEntry);
  return logEntry;
}

/* ========================================================================= */
/*                   BRANDED KZTEK HTML EMAIL TEMPLATES                      */
/* ========================================================================= */

const BRAND = {
  primary: "#251C53", // Tím than KZTEK
  accent: "#F05922", // Cam KZTEK
  background: "#f4f6fb",
  surface: "#ffffff",
  textMain: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#F05922", // Cam KZTEK (thay cho đỏ — brand KZTEK không dùng màu đỏ)
  info: "#3b82f6",
};

function getPriorityBadge(priority: string) {
  switch (priority.toUpperCase()) {
    case "URGENT":
      return { label: "Khẩn cấp", bg: "#FDE9E0", color: "#F05922", border: "#F9C7AA" };
    case "HIGH":
      return { label: "Cao", bg: "#fff7ed", color: "#ea580c", border: "#ffedd5" };
    case "MEDIUM":
      return { label: "Trung bình", bg: "#eff6ff", color: "#2563eb", border: "#dbeafe" };
    case "LOW":
    default:
      return { label: "Thấp", bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
  }
}

function getTypeBadge(type: string) {
  switch (type.toUpperCase()) {
    case "BUG":
      return { label: "Báo lỗi (Bug)", bg: "#FDE9E0", color: "#F05922" };
    case "STORY":
      return { label: "Story", bg: "#ecfdf5", color: "#059669" };
    case "EPIC":
      return { label: "Epic", bg: "#faf5ff", color: "#9333ea" };
    case "TASK":
    default:
      return { label: "Công việc (Task)", bg: "#eef2ff", color: "#4f46e5" };
  }
}

function wrapBaseLayout(title: string, preheader: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND.background}; color: ${BRAND.textMain}; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 24px auto; background: ${BRAND.surface}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(37, 28, 83, 0.08); border: 1px solid ${BRAND.border}; }
    .header { background: linear-gradient(135deg, ${BRAND.primary} 0%, #3b2d7d 100%); padding: 28px 32px; text-align: left; }
    .header-logo { display: inline-flex; align-items: center; gap: 10px; }
    .header-brand { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0; }
    .header-badge { display: inline-block; background: ${BRAND.accent}; color: #ffffff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; margin-left: 8px; }
    .content { padding: 32px; }
    .footer { background: #f8fafc; padding: 20px 32px; border-top: 1px solid ${BRAND.border}; text-align: center; font-size: 12px; color: ${BRAND.textMuted}; line-height: 1.6; }
    .btn { display: inline-block; background: linear-gradient(135deg, ${BRAND.accent} 0%, #d44715 100%); color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(240, 89, 34, 0.3); transition: transform 0.2s; text-align: center; }
    .card { background: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .meta-table td { padding: 8px 0; font-size: 13px; vertical-align: top; }
    .meta-label { color: ${BRAND.textMuted}; width: 130px; font-weight: 500; }
    .meta-val { color: ${BRAND.textMain}; font-weight: 600; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; mso-hide: all; }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div class="header-logo">
              <span class="header-brand">KZTEK WORK</span>
              <span class="header-badge">Hệ Thống Quản Lý</span>
            </div>
            <div style="color: #cbd5e1; font-size: 13px; margin-top: 4px;">Thông báo tự động từ dự án</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Content -->
    <div class="content">
      ${contentHtml}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div style="font-weight: 700; color: ${BRAND.primary}; margin-bottom: 4px;">CÔNG TY CỔ PHẦN CÔNG NGHỆ KZTEK</div>
      <div>Hệ thống điều hành và giao việc thông minh đa nền tảng</div>
      <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">Email này được gửi tự động. Vui lòng không trả lời trực tiếp email này.</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Tạo mẫu HTML Email Giao Việc Mới (Task Assignment)
 */
export function generateTaskAssignedEmailHtml(payload: TaskEmailPayload): string {
  const pBadge = getPriorityBadge(payload.priority);
  const tBadge = getTypeBadge(payload.taskType || "TASK");
  const taskCode = `${payload.projectKey}-${payload.taskNumber}`;
  const directLink = payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId || ""}`;

  const content = `
    <div style="font-size: 18px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 12px;">
      👋 Xin chào ${payload.assigneeName},
    </div>
    <div style="font-size: 14px; line-height: 1.6; color: ${BRAND.textMain};">
      Bạn vừa được <strong>${payload.assignorName}</strong> phân công phụ trách công việc mới trong dự án <strong>${payload.projectName}</strong>.
    </div>

    <!-- Task Detail Card -->
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 12px; font-weight: 800; color: ${BRAND.accent}; letter-spacing: 0.5px;">${taskCode}</span>
        <span class="tag" style="background: ${tBadge.bg}; color: ${tBadge.color};">${tBadge.label}</span>
      </div>

      <div style="font-size: 16px; font-weight: 700; color: ${BRAND.textMain}; margin-bottom: 12px; line-height: 1.4;">
        ${payload.taskTitle}
      </div>

      ${
        payload.taskDescription
          ? `<div style="font-size: 13px; color: ${BRAND.textMuted}; background: #ffffff; border: 1px solid ${BRAND.border}; border-radius: 8px; padding: 12px; margin-bottom: 16px; line-height: 1.5; white-space: pre-wrap;">${payload.taskDescription.slice(0, 300)}${payload.taskDescription.length > 300 ? "..." : ""}</div>`
          : ""
      }

      <table class="meta-table">
        <tr>
          <td class="meta-label">Mức độ ưu tiên:</td>
          <td class="meta-val">
            <span class="tag" style="background: ${pBadge.bg}; color: ${pBadge.color}; border: 1px solid ${pBadge.border};">
              ${pBadge.label}
            </span>
          </td>
        </tr>
        <tr>
          <td class="meta-label">Người giao việc:</td>
          <td class="meta-val">${payload.assignorName}</td>
        </tr>
        ${
          payload.dueDate
            ? `<tr>
                <td class="meta-label">Hạn hoàn thành:</td>
                <td class="meta-val" style="color: ${BRAND.accent}; font-weight: 700;">
                  📅 ${new Date(payload.dueDate).toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </td>
              </tr>`
            : ""
        }
        <tr>
          <td class="meta-label">Dự án:</td>
          <td class="meta-val">${payload.projectName} (${payload.projectKey})</td>
        </tr>
      </table>
    </div>

    <!-- Call to action -->
    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="${directLink}" class="btn" target="_blank">
        🚀 Xem & Xử Lý Công Việc Ngay
      </a>
    </div>

    <div style="text-align: center; font-size: 12px; color: ${BRAND.textMuted};">
      Hoặc sao chép liên kết: <a href="${directLink}" style="color: ${BRAND.accent}; word-break: break-all;">${directLink}</a>
    </div>
  `;

  return wrapBaseLayout(
    `[KZTEK Work] Giao việc mới: ${taskCode} - ${payload.taskTitle}`,
    `Bạn vừa được ${payload.assignorName} giao task ${taskCode}: ${payload.taskTitle}`,
    content
  );
}

/**
 * Tạo mẫu HTML Email Cập nhật Trạng thái (Status Changed)
 */
export function generateStatusChangedEmailHtml(payload: StatusChangeEmailPayload): string {
  const content = `
    <div style="font-size: 18px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 12px;">
      Thông báo Cập nhật Tiến độ Công việc
    </div>
    <div style="font-size: 14px; line-height: 1.6; color: ${BRAND.textMain};">
      Thành viên <strong>${payload.actorName}</strong> vừa chuyển trạng thái công việc <strong>#${payload.taskNumber}: ${payload.taskTitle}</strong> trong dự án <strong>${payload.projectName}</strong>.
    </div>

    <div class="card" style="text-align: center; padding: 24px;">
      <div style="font-size: 13px; color: ${BRAND.textMuted}; margin-bottom: 8px;">Thay đổi trạng thái:</div>
      <div style="font-size: 16px; font-weight: 700;">
        <span class="tag" style="background: #e2e8f0; color: #475569; font-size: 13px;">${payload.oldStatus}</span>
        <span style="margin: 0 10px; color: ${BRAND.accent}; font-size: 18px;">➔</span>
        <span class="tag" style="background: #dbeafe; color: #1d4ed8; font-size: 13px;">${payload.newStatus}</span>
      </div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId || ""}`}" class="btn" target="_blank">
        Truy Cập Bảng Công Việc
      </a>
    </div>
  `;

  return wrapBaseLayout(
    `[KZTEK Work] Cập nhật trạng thái task #${payload.taskNumber}`,
    `${payload.actorName} đã chuyển trạng thái task #${payload.taskNumber} sang ${payload.newStatus}`,
    content
  );
}

/**
 * Tạo mẫu HTML Email Bình luận mới (Task Comment)
 */
export function generateTaskCommentEmailHtml(payload: CommentEmailPayload): string {
  const directLink = payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId || ""}`;

  const content = `
    <div style="font-size: 18px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 12px;">
      💬 Bình luận mới trong công việc
    </div>
    <div style="font-size: 14px; line-height: 1.6; color: ${BRAND.textMain};">
      <strong>${payload.authorName}</strong> vừa để lại một bình luận trong task <strong>#${payload.taskNumber}: ${payload.taskTitle}</strong>:
    </div>

    <div class="card" style="border-left: 4px solid ${BRAND.accent}; background: #fff8f5;">
      <div style="font-size: 13px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 6px;">
        ${payload.authorName} viết:
      </div>
      <div style="font-size: 14px; color: ${BRAND.textMain}; line-height: 1.5; white-space: pre-wrap;">
        ${payload.commentBody}
      </div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${directLink}" class="btn" target="_blank">
        Xem & Trả Lời Bình Luận
      </a>
    </div>
  `;

  return wrapBaseLayout(
    `[KZTEK Work] Bình luận mới trên task #${payload.taskNumber}`,
    `${payload.authorName} vừa bình luận: "${payload.commentBody.slice(0, 80)}"`,
    content
  );
}

/**
 * Tạo mẫu HTML Email Kiểm tra Hệ thống (Test Email)
 */
export function generateTestEmailHtml(recipientName: string, recipientEmail: string): string {
  const isConfigured = isSmtpConfigured();
  const config = getSmtpConfig();
  const appUrl = getAppBaseUrl();

  const content = `
    <div style="font-size: 18px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 12px;">
      🎉 Kiểm tra Dịch vụ Email KZTEK thành công!
    </div>
    <div style="font-size: 14px; line-height: 1.6; color: ${BRAND.textMain};">
      Xin chào <strong>${recipientName}</strong>, đây là email kiểm tra tính năng gửi thông báo tự động từ hệ thống quản lý công việc KZTEK Work Management.
    </div>

    <div class="card">
      <div style="font-size: 14px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 10px;">
        Thông Tin Cấu Hình Dịch Vụ:
      </div>
      <table class="meta-table">
        <tr>
          <td class="meta-label">Trạng thái SMTP:</td>
          <td class="meta-val">
            <span class="tag" style="background: ${isConfigured ? "#ecfdf5" : "#fffbeb"}; color: ${isConfigured ? "#059669" : "#b45309"};">
              ${isConfigured ? "✓ Đã kết nối SMTP Server" : "⚡ Chế độ Simulated Outbox (Dev/Test)"}
            </span>
          </td>
        </tr>
        <tr>
          <td class="meta-label">SMTP Host:</td>
          <td class="meta-val">${config.host || "(Mặc định Local Simulated)"}</td>
        </tr>
        <tr>
          <td class="meta-label">Địa chỉ gửi:</td>
          <td class="meta-val">${config.from}</td>
        </tr>
        <tr>
          <td class="meta-label">Địa chỉ Web/App:</td>
          <td class="meta-val" style="font-weight: 700; color: ${BRAND.accent};">${appUrl}</td>
        </tr>
        <tr>
          <td class="meta-label">Người nhận thử:</td>
          <td class="meta-val">${recipientEmail}</td>
        </tr>
        <tr>
          <td class="meta-label">Thời gian gửi:</td>
          <td class="meta-val">${new Date().toLocaleString("vi-VN")}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}" class="btn" target="_blank">
        Quay Lại Trang Điều Hành
      </a>
    </div>
  `;

  return wrapBaseLayout(
    `[KZTEK Work] Thử nghiệm Dịch vụ Email Thông Báo`,
    `Email thử nghiệm hệ thống gửi thông báo tự động KZTEK Work Management`,
    content
  );
}

/**
 * Gửi email khi giao việc mới
 */
export async function sendTaskAssignedEmail(payload: TaskEmailPayload): Promise<EmailLogEntry> {
  const html = generateTaskAssignedEmailHtml(payload);
  const taskCode = `${payload.projectKey}-${payload.taskNumber}`;
  const subject = `[KZTEK Work] Giao việc: ${taskCode} - ${payload.taskTitle}`;
  const taskUrl = payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId || ""}`;

  return sendMail({
    to: payload.assigneeEmail,
    toName: payload.assigneeName,
    subject,
    html,
    text: `Bạn vừa được ${payload.assignorName} giao task ${taskCode}: ${payload.taskTitle}. Chi tiết: ${taskUrl}`,
    type: "TASK_ASSIGNED",
    metadata: {
      taskId: payload.taskNumber,
      projectId: payload.projectId,
      assignor: payload.assignorName,
      priority: payload.priority,
    },
  });
}

/**
 * Gửi email khi thay đổi trạng thái
 */
export async function sendStatusChangedEmail(payload: StatusChangeEmailPayload): Promise<EmailLogEntry> {
  const html = generateStatusChangedEmailHtml(payload);
  const subject = `[KZTEK Work] Task #${payload.taskNumber} đổi trạng thái sang ${payload.newStatus}`;
  const taskUrl = payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId || ""}`;

  return sendMail({
    to: payload.recipientEmail,
    toName: payload.recipientName,
    subject,
    html,
    text: `${payload.actorName} đã chuyển trạng thái task #${payload.taskNumber} (${payload.taskTitle}) sang ${payload.newStatus}. Chi tiết: ${taskUrl}`,
    type: "STATUS_CHANGED",
    metadata: {
      taskNumber: payload.taskNumber,
      projectId: payload.projectId,
      newStatus: payload.newStatus,
    },
  });
}

/**
 * Gửi email khi có bình luận mới
 */
export async function sendTaskCommentEmail(payload: CommentEmailPayload): Promise<EmailLogEntry> {
  const html = generateTaskCommentEmailHtml(payload);
  const subject = `[KZTEK Work] ${payload.authorName} đã bình luận trên task #${payload.taskNumber}`;
  const taskUrl = payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId || ""}`;

  return sendMail({
    to: payload.recipientEmail,
    toName: payload.recipientName,
    subject,
    html,
    text: `${payload.authorName} đã bình luận trên task #${payload.taskNumber}: ${payload.commentBody}. Chi tiết: ${taskUrl}`,
    type: "COMMENTED",
    metadata: {
      taskNumber: payload.taskNumber,
      projectId: payload.projectId,
      author: payload.authorName,
    },
  });
}

/**
 * Tạo mẫu HTML Email khi được Tag/Mention (@mention)
 */
export function generateTaskMentionEmailHtml(payload: TaskMentionEmailPayload): string {
  const taskCode = `${payload.projectKey}-${payload.taskNumber}`;
  const directLink = payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId}`;

  const content = `
    <div style="background: linear-gradient(135deg, rgba(240, 89, 34, 0.15), rgba(37, 28, 83, 0.1)); border: 1px solid rgba(240, 89, 34, 0.4); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center;">
      <div style="font-size: 20px; margin-right: 12px;">🏷️</div>
      <div>
        <div style="font-size: 14px; font-weight: 800; color: ${BRAND.accent}; text-transform: uppercase; letter-spacing: 0.5px;">
          Bạn vừa được gắn thẻ (@mention)
        </div>
        <div style="font-size: 12px; color: ${BRAND.textMuted};">
          <strong>${payload.authorName}</strong> đã nhắc đến bạn trong một bình luận
        </div>
      </div>
    </div>

    <div style="font-size: 18px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 12px;">
      Nội Dung Thảo Luận Công Việc
    </div>
    <div style="font-size: 14px; line-height: 1.6; color: ${BRAND.textMain};">
      Xin chào <strong>${payload.recipientName}</strong>, bạn được nhắc đến trong công việc <span style="font-family: monospace; font-weight: 700; color: ${BRAND.accent};">${taskCode}</span>: <strong>${payload.taskTitle}</strong> thuộc dự án <strong>${payload.projectName}</strong>.
    </div>

    <!-- Comment Blockquote Card -->
    <div class="card" style="border-left: 4px solid ${BRAND.accent}; background: #fffaf7; padding: 18px 20px; margin: 18px 0;">
      <div style="font-size: 12px; font-weight: 700; color: ${BRAND.accent}; margin-bottom: 8px; display: flex; align-items: center;">
        💬 Lời nhắn từ ${payload.authorName}:
      </div>
      <div style="font-size: 14px; color: #1e293b; line-height: 1.6; white-space: pre-wrap; font-style: normal;">
        ${payload.commentBody}
      </div>
    </div>

    <!-- Task Meta Table -->
    <div class="card">
      <div style="font-size: 13px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 10px;">
        Chi Tiết Công Việc:
      </div>
      <table class="meta-table">
        <tr>
          <td class="meta-label">Mã công việc:</td>
          <td class="meta-val"><span class="tag" style="background: rgba(37, 28, 83, 0.1); color: ${BRAND.primary}; font-weight: 700;">${taskCode}</span></td>
        </tr>
        <tr>
          <td class="meta-label">Tiêu đề:</td>
          <td class="meta-val" style="font-weight: 700;">${payload.taskTitle}</td>
        </tr>
        <tr>
          <td class="meta-label">Dự án:</td>
          <td class="meta-val">${payload.projectName} (${payload.projectKey})</td>
        </tr>
        <tr>
          <td class="meta-label">Người nhắc bạn:</td>
          <td class="meta-val" style="font-weight: 600; color: ${BRAND.accent};">${payload.authorName}</td>
        </tr>
      </table>
    </div>

    <!-- Call to action -->
    <div style="text-align: center; margin: 28px 0 12px 0;">
      <a href="${directLink}" class="btn" target="_blank">
        ⚡ Xem & Phản Hồi Bình Luận Ngay
      </a>
    </div>

    <div style="text-align: center; font-size: 12px; color: ${BRAND.textMuted};">
      Hoặc mở liên kết trực tiếp: <a href="${directLink}" style="color: ${BRAND.accent}; word-break: break-all;">${directLink}</a>
    </div>
  `;

  return wrapBaseLayout(
    `[KZTEK Work] [${taskCode}] ${payload.authorName} đã nhắc đến bạn`,
    `${payload.authorName} đã nhắc đến bạn trong task ${taskCode}: "${payload.commentBody.slice(0, 80)}"`,
    content
  );
}

/**
 * Gửi email khi có thành viên được Tag (@mention)
 */
export async function sendTaskMentionEmail(payload: TaskMentionEmailPayload): Promise<EmailLogEntry> {
  const html = generateTaskMentionEmailHtml(payload);
  const taskCode = `${payload.projectKey}-${payload.taskNumber}`;
  const subject = `[KZTEK Work] [${taskCode}] ${payload.authorName} đã nhắc đến bạn trong bình luận`;
  const taskUrl = payload.taskUrl || `${getAppBaseUrl()}/projects/${payload.projectId}/board?taskId=${payload.taskId}`;

  return sendMail({
    to: payload.recipientEmail,
    toName: payload.recipientName,
    subject,
    html,
    text: `[KZTEK] ${payload.authorName} đã nhắc đến bạn trong task ${taskCode} (${payload.taskTitle}):\n\n"${payload.commentBody}"\n\nXem chi tiết tại: ${taskUrl}`,
    type: "TASK_MENTION",
    metadata: {
      taskId: payload.taskId,
      taskNumber: payload.taskNumber,
      projectId: payload.projectId,
      author: payload.authorName,
      recipient: payload.recipientName,
    },
  });
}

/**
 * Gửi email thử nghiệm
 */
export async function sendTestEmail(recipientEmail: string, recipientName: string = "Quản trị viên"): Promise<EmailLogEntry> {
  const html = generateTestEmailHtml(recipientName, recipientEmail);
  const subject = `[KZTEK Work] Thử nghiệm Dịch vụ Email Thông Báo`;

  return sendMail({
    to: recipientEmail,
    toName: recipientName,
    subject,
    html,
    text: `Email thử nghiệm tính năng gửi thông báo tự động từ hệ thống KZTEK Work Management gửi đến ${recipientEmail}`,
    type: "TEST",
  });
}


export type AccountCredentialsEmailPayload = {
  recipientName: string;
  recipientEmail: string;
  password: string;
  senderName: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Tạo mẫu HTML Email Thông tin Tài khoản (gửi tài khoản + mật khẩu khởi tạo)
 */
export function generateAccountCredentialsEmailHtml(payload: AccountCredentialsEmailPayload): string {
  const loginUrl = `${getAppBaseUrl()}/login`;

  const content = `
    <div style="font-size: 18px; font-weight: 700; color: ${BRAND.primary}; margin-bottom: 12px;">
      🔐 Thông tin tài khoản KZTEK Work
    </div>
    <div style="font-size: 14px; line-height: 1.6; color: ${BRAND.textMain};">
      Xin chào <strong>${escapeHtml(payload.recipientName)}</strong>, quản trị viên <strong>${escapeHtml(payload.senderName)}</strong> đã cấp tài khoản truy cập hệ thống quản lý công việc KZTEK Work cho bạn.
    </div>

    <div class="card">
      <table class="meta-table">
        <tr>
          <td class="meta-label">Tài khoản:</td>
          <td class="meta-val" style="font-family: monospace;">${escapeHtml(payload.recipientEmail)}</td>
        </tr>
        <tr>
          <td class="meta-label">Mật khẩu:</td>
          <td class="meta-val" style="font-family: monospace; font-size: 15px; color: ${BRAND.accent};">${escapeHtml(payload.password)}</td>
        </tr>
      </table>
    </div>

    <div style="font-size: 13px; line-height: 1.6; color: ${BRAND.textMuted};">
      Vì lý do bảo mật, hệ thống sẽ <strong>yêu cầu bạn đổi mật khẩu</strong> ngay ở lần đăng nhập đầu tiên. Không chia sẻ email này cho người khác.
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${loginUrl}" class="btn" target="_blank">
        Đăng Nhập Ngay
      </a>
    </div>
  `;

  return wrapBaseLayout(
    `[KZTEK Work] Thông tin tài khoản đăng nhập`,
    `Tài khoản truy cập KZTEK Work của bạn đã sẵn sàng`,
    content
  );
}

/**
 * Gửi email thông tin tài khoản + mật khẩu khởi tạo. Outbox Log chỉ lưu bản đã che mật khẩu.
 */
export async function sendAccountCredentialsEmail(payload: AccountCredentialsEmailPayload): Promise<EmailLogEntry> {
  const loginUrl = `${getAppBaseUrl()}/login`;
  const masked = { ...payload, password: "••••••••" };

  return sendMail({
    to: payload.recipientEmail,
    toName: payload.recipientName,
    subject: `[KZTEK Work] Thông tin tài khoản đăng nhập`,
    html: generateAccountCredentialsEmailHtml(payload),
    text: `Tài khoản: ${payload.recipientEmail} - Mật khẩu: ${payload.password}. Đăng nhập tại ${loginUrl} và đổi mật khẩu ở lần đăng nhập đầu tiên.`,
    logHtml: generateAccountCredentialsEmailHtml(masked),
    logText: `Tài khoản: ${payload.recipientEmail} - Mật khẩu: ${masked.password}. Đăng nhập tại ${loginUrl}.`,
    type: "SYSTEM",
    metadata: { kind: "ACCOUNT_CREDENTIALS", sender: payload.senderName },
  });
}
