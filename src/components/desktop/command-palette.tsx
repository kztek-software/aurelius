"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Search,
  Plus,
  Calculator,
  FileText,
  LayoutDashboard,
  KanbanSquare,
  Ticket,
  Users,
  Settings,
  Sparkles,
  ArrowRight,
  Monitor,
  CheckCircle2,
  Clock,
  ExternalLink,
  Keyboard,
  Layers,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalculator?: () => void;
  onOpenScratchpad?: () => void;
  onOpenShortcuts?: () => void;
  onOpenNewTask?: () => void;
  projects?: any[];
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenCalculator,
  onOpenScratchpad,
  onOpenShortcuts,
  onOpenNewTask,
  projects = [],
}: CommandPaletteProps) {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.projectId as string) || (projects.length > 0 ? projects[0].id : "");

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset ô tìm kiếm mỗi lần bảng lệnh được mở.
  // Điều chỉnh trong lúc render để lần render đầu đã sạch, không nhấp nháy
  // kết quả của lượt mở trước.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  // Focus input là tác vụ trên DOM ngoài React -> giữ trong effect.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Core Quick Actions
  const staticActions = [
    {
      id: "act-new-task",
      category: "⚡ Hành động Nhanh",
      title: "Tạo công việc mới (New Task)",
      subtitle: "Mở hộp thoại tạo task nhanh trong dự án",
      icon: Plus,
      action: () => {
        onClose();
        if (onOpenNewTask) onOpenNewTask();
      },
    },
    {
      id: "act-open-calc",
      category: "⚡ Hành động Nhanh",
      title: "Mở Máy Tính Nổi (Smart Work Calculator)",
      subtitle: "Tính toán số học, Story Points & Sprint Capacity",
      icon: Calculator,
      action: () => {
        onClose();
        if (onOpenCalculator) onOpenCalculator();
      },
    },
    {
      id: "act-open-scratchpad",
      category: "⚡ Hành động Nhanh",
      title: "Mở Ghi Chú Nhanh (Desktop Scratchpad)",
      subtitle: "Ghi chép ý tưởng và việc cần làm tạm thời",
      icon: FileText,
      action: () => {
        onClose();
        if (onOpenScratchpad) onOpenScratchpad();
      },
    },
    {
      id: "act-open-desktop",
      category: "🧭 Điều Hướng",
      title: "Chế độ Máy Tính Chuyên Dụng (Desktop Workstation)",
      subtitle: "Làm việc đa nhiệm với màn hình chia đôi (Split-View)",
      icon: Monitor,
      action: () => {
        onClose();
        router.push("/desktop");
      },
    },
    {
      id: "act-open-board",
      category: "🧭 Điều Hướng",
      title: "Bảng Kanban Công Việc (Kanban Board)",
      subtitle: "Xem các cột TODO, IN PROGRESS, DONE",
      icon: KanbanSquare,
      action: () => {
        onClose();
        if (projectId) router.push(`/projects/${projectId}/board`);
        else router.push("/");
      },
    },
    {
      id: "act-open-dashboard",
      category: "🧭 Điều Hướng",
      title: "Dashboard Thống Kê KPI",
      subtitle: "Xem tiến độ tổng thể và biểu đồ dự án",
      icon: LayoutDashboard,
      action: () => {
        onClose();
        if (projectId) router.push(`/projects/${projectId}/dashboard`);
        else router.push("/");
      },
    },
    {
      id: "act-open-tickets",
      category: "🧭 Điều Hướng",
      title: "Quản Lý Báo Lỗi Khách Hàng (Customer Tickets)",
      subtitle: "Xem và điều phối các sự cố khách hàng gửi",
      icon: Ticket,
      action: () => {
        onClose();
        if (projectId) router.push(`/projects/${projectId}/tickets`);
        else router.push("/portal");
      },
    },
    {
      id: "act-open-shortcuts",
      category: "⚡ Trợ Giúp",
      title: "Bảng Tra Cứu Phím Tắt (Shortcuts Cheat-sheet)",
      subtitle: "Xem danh sách phím tắt thao tác nhanh trên máy tính",
      icon: Keyboard,
      action: () => {
        onClose();
        if (onOpenShortcuts) onOpenShortcuts();
      },
    },
  ];

  // Dynamic filter and search
  const filteredItems = React.useMemo(() => {
    if (!query.trim()) {
      return staticActions;
    }

    const q = query.toLowerCase().trim();
    const matchedActions = staticActions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );

    // Project items
    const matchedProjects = (projects || [])
      .filter((p) => p.name?.toLowerCase().includes(q) || p.key?.toLowerCase().includes(q))
      .map((p) => ({
        id: `proj-${p.id}`,
        category: "📁 Dự Án",
        title: `${p.name} (${p.key || "KZ"})`,
        subtitle: `Chuyển không gian làm việc sang ${p.name}`,
        icon: Layers,
        action: () => {
          onClose();
          router.push(`/projects/${p.id}/dashboard`);
        },
      }));

    return [...matchedActions, ...matchedProjects];
  }, [query, staticActions, projects, router, onClose]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-line bg-surface-2/60">
          <Search className="w-5 h-5 text-accent mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Tìm kiếm hành động, dự án, công việc... (Esc để đóng)"
            className="w-full bg-transparent text-foreground placeholder:text-muted text-sm focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-mono bg-surface-2 border border-line rounded text-muted">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 max-h-[60vh]">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-muted text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-accent" />
              Không tìm thấy lệnh hoặc công việc nào khớp với &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const IconComp = item.icon || ArrowRight;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-accent text-white shadow-md shadow-accent/25 font-medium"
                      : "hover:bg-surface-2 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-accent/10 text-accent border border-accent/20"
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.category && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-surface-2 text-muted border border-line"
                            }`}
                          >
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          isSelected ? "text-white/80" : "text-muted"
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${
                      isSelected ? "translate-x-1 opacity-100 text-white" : "opacity-0"
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-surface-2/80 border-t border-line flex items-center justify-between text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface border border-line rounded font-mono text-[10px] text-foreground">
                ↑
              </kbd>{" "}
              <kbd className="px-1.5 py-0.5 bg-surface border border-line rounded font-mono text-[10px] text-foreground">
                ↓
              </kbd>{" "}
              để chọn
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface border border-line rounded font-mono text-[10px] text-foreground">
                ↵
              </kbd>{" "}
              để mở
            </span>
          </div>
          <span className="hidden sm:inline font-medium">KZTEK Desktop Workstation</span>
        </div>
      </div>
    </div>
  );
}
