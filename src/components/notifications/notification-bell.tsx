"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Mail,
  Sparkles,
  AtSign,
  ClipboardList,
  MessageSquare,
  ArrowRightLeft,
  Trash2,
  Filter,
} from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmailLogModal } from "@/components/notifications/email-log-modal";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    avatarColor: string;
  } | null;
};

type FilterCategory = "ALL" | "ASSIGNED" | "MENTIONED" | "COMMENTED" | "STATUS_CHANGED";

export function NotificationBell({
  projectId,
  currentUserEmail,
  placement = "bottom",
}: {
  projectId?: string;
  currentUserEmail?: string;
  placement?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterCategory>("ALL");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: setState chỉ chạy sau await, rule không phân tích được biên async
    fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, 15000); // 15s poll when tab is visible
    return () => clearInterval(interval);
  }, []);

  // Close when click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markAsRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  async function clearReadNotifications() {
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => !n.read));
    } catch {
      // ignore
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Vừa xong";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  function getTypeBadge(type: string) {
    switch (type) {
      case "MENTIONED":
        return {
          label: "Nhắc đến (@)",
          icon: <AtSign className="h-3 w-3" />,
          color: "text-amber-400 bg-amber-500/15 border-amber-500/30",
        };
      case "ASSIGNED":
        return {
          label: "Giao việc",
          icon: <ClipboardList className="h-3 w-3" />,
          color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
        };
      case "COMMENTED":
        return {
          label: "Bình luận",
          icon: <MessageSquare className="h-3 w-3" />,
          color: "text-blue-400 bg-blue-500/15 border-blue-500/30",
        };
      case "STATUS_CHANGED":
        return {
          label: "Đổi trạng thái",
          icon: <ArrowRightLeft className="h-3 w-3" />,
          color: "text-purple-400 bg-purple-500/15 border-purple-500/30",
        };
      default:
        return {
          label: "Thông báo",
          icon: <Bell className="h-3 w-3" />,
          color: "text-muted bg-line border-line",
        };
    }
  }

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (onlyUnread && n.read) return false;
    if (activeTab === "ALL") return true;
    if (activeTab === "ASSIGNED") return n.type === "ASSIGNED";
    if (activeTab === "MENTIONED") return n.type === "MENTIONED";
    if (activeTab === "COMMENTED") return n.type === "COMMENTED";
    if (activeTab === "STATUS_CHANGED") return n.type === "STATUS_CHANGED";
    return true;
  });

  // Calculate counts per tab
  const assignedCount = notifications.filter((n) => n.type === "ASSIGNED" && !n.read).length;
  const mentionCount = notifications.filter((n) => n.type === "MENTIONED" && !n.read).length;
  const commentCount = notifications.filter((n) => n.type === "COMMENTED" && !n.read).length;
  const statusCount = notifications.filter((n) => n.type === "STATUS_CHANGED" && !n.read).length;

  return (
    <>
      <div className="relative" ref={popoverRef}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) fetchNotifications();
          }}
          className="relative h-8 w-8 text-muted hover:text-foreground cursor-pointer"
          title="Trung tâm thông báo"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>

        {open && (
          <div
            className={`fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 ${
              placement === "bottom" ? "sm:top-[calc(100%+8px)]" : "sm:bottom-full sm:mb-2"
            } w-auto sm:w-[480px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface-2 p-0 shadow-2xl z-50 animate-fade-in-up overflow-hidden ring-1 ring-black/50`}
          >
            {/* Header */}
            <div className="border-b border-line p-3 bg-surface/90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/20 text-accent">
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <span>Trung Tâm Thông Báo</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] text-accent font-bold border border-accent/30">
                      {unreadCount} chưa đọc
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                      title="Đánh dấu tất cả đã đọc"
                    >
                      <CheckCheck className="h-3 w-3" /> Đọc hết
                    </button>
                  )}

                  <button
                    onClick={() => setOnlyUnread((v) => !v)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      onlyUnread ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground"
                    }`}
                  >
                    <Filter className="h-2.5 w-2.5" /> Chưa đọc
                  </button>
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex items-center justify-between gap-1 pt-2.5 mt-1 border-t border-line/60">
                <button
                  type="button"
                  onClick={() => setActiveTab("ALL")}
                  className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all text-center justify-center cursor-pointer ${
                    activeTab === "ALL"
                      ? "bg-accent text-white shadow-sm shadow-accent/20"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  Tất cả ({notifications.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("ASSIGNED")}
                  className={`flex-1 px-1.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeTab === "ASSIGNED"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <ClipboardList className="h-3 w-3 shrink-0" />
                  <span className="truncate">Việc giao</span>
                  {assignedCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-emerald-400/30 px-1 text-[9px]">
                      {assignedCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("MENTIONED")}
                  className={`flex-1 px-1.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeTab === "MENTIONED"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <AtSign className="h-3 w-3 shrink-0" />
                  <span className="truncate">Gắn thẻ</span>
                  {mentionCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-amber-400/30 px-1 text-[9px]">
                      {mentionCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("COMMENTED")}
                  className={`flex-1 px-1.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeTab === "COMMENTED"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">Bình luận</span>
                  {commentCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-blue-400/30 px-1 text-[9px]">
                      {commentCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("STATUS_CHANGED")}
                  className={`flex-1 px-1.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    activeTab === "STATUS_CHANGED"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <ArrowRightLeft className="h-3 w-3 shrink-0" />
                  <span className="truncate">Trạng thái</span>
                  {statusCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-purple-400/30 px-1 text-[9px]">
                      {statusCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-84 overflow-y-auto divide-y divide-line/60">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted space-y-1.5">
                  <Bell className="h-7 w-7 mx-auto text-muted/40 mb-1" />
                  <p className="font-semibold text-foreground">Không có thông báo nào trong mục này</p>
                  <p className="text-[11px] max-w-xs mx-auto">
                    {onlyUnread
                      ? "Bạn đã đọc hết các thông báo."
                      : "Các hoạt động giao việc, nhắc tên (@) và bình luận sẽ hiển thị ở đây."}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const badge = getTypeBadge(n.type);
                  return (
                    <div
                      key={n.id}
                      className={`p-3 transition-colors flex items-start gap-2.5 ${
                        n.read ? "bg-transparent opacity-85" : "bg-accent/5 font-medium border-l-2 border-accent"
                      } hover:bg-surface`}
                    >
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5 border border-white/10">
                        <AvatarFallback color={n.actor?.avatarColor || "#6366f1"} className="text-[9px] font-bold">
                          {n.actor ? initials(n.actor.name) : "KZ"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] font-bold border ${badge.color}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                            <span className="text-xs font-bold text-foreground truncate">{n.title}</span>
                          </div>
                          <span className="text-[10px] text-muted shrink-0">{formatTime(n.createdAt)}</span>
                        </div>

                        <p className="text-[11px] text-muted leading-relaxed break-words line-clamp-2">
                          {n.message}
                        </p>

                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          {n.link ? (
                            <Link
                              href={n.link}
                              onClick={() => {
                                markAsRead(n.id);
                                setOpen(false);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"
                            >
                              Mở công việc <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ) : (
                            <span />
                          )}

                          {!n.read && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="h-5 px-1.5 rounded bg-line hover:bg-line/80 text-[10px] font-semibold text-muted hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                              title="Đánh dấu đã đọc"
                            >
                              <Check className="h-2.5 w-2.5" /> Đã đọc
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Email Outbox & Clear Read Action */}
            <div className="p-2.5 border-t border-line bg-surface flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearReadNotifications}
                className="text-[10px] text-muted hover:text-accent flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-line/40 transition-colors"
                title="Xóa các thông báo đã đọc"
              >
                <Trash2 className="h-3 w-3" /> Dọn đã đọc
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmailModalOpen(true);
                  setOpen(false);
                }}
                className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1.5 cursor-pointer py-1 px-3 rounded-lg hover:bg-accent/10 transition-colors"
              >
                <Mail className="h-3.5 w-3.5 text-accent" />
                Hộp Thư Gửi & Quản Lý Email Service
              </button>
            </div>
          </div>
        )}
      </div>

      <EmailLogModal
        visible={emailModalOpen}
        onHide={() => setEmailModalOpen(false)}
        currentUserEmail={currentUserEmail}
      />
    </>
  );
}
