"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, FolderKanban, Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type BoardProjectOption = { id: string; name: string; key: string; status?: string };

// "ALL" = mọi dự án user là thành viên (kể cả dự án được thêm sau này); mảng = chọn tường minh
export type BoardProjectSelection = string[] | "ALL";

/**
 * Bộ chọn dự án ở header Board Công Việc:
 * - Bấm vào tên dự án => chỉ xem dự án đó (chuyển nhanh)
 * - Bấm ô tick => thêm/bớt dự án (xem nhiều dự án cùng lúc)
 * - "Tất cả dự án" => xem toàn bộ dự án user là thành viên. ADMIN vẫn thấy mọi dự án
 *   trong danh sách nhưng dự án không tham gia phải tick tường minh.
 */
export function BoardProjectPicker({
  projects,
  memberProjectIds,
  selection,
  onChange,
}: {
  projects: BoardProjectOption[];
  memberProjectIds: string[];
  selection: BoardProjectSelection;
  onChange: (next: BoardProjectSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  // Dropdown render qua portal (position: fixed) để không bị header (backdrop-blur tạo stacking context)
  // hay các thẻ task kéo thả đè lên -> tính lại vị trí theo nút bấm khi mở, cuộn, đổi kích thước
  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelWidth = Math.min(288, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12));
      setPanelPos({ top: rect.bottom + 6, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  // Đóng khi click ra ngoài hoặc bấm ESC
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isAll = selection === "ALL";
  const selectedIds = isAll ? memberProjectIds : selection;
  const selectedSet = new Set(selectedIds);
  const selectedProjects = projects.filter((p) => selectedSet.has(p.id));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? projects.filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
    : projects;

  function toggleProject(id: string) {
    const next = selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    // Luôn giữ tối thiểu 1 dự án được chọn
    if (next.length === 0) return;
    onChange(next);
  }

  function selectOnly(id: string) {
    onChange([id]);
    setOpen(false);
  }

  const triggerLabel = isAll
    ? `Tất cả dự án (${memberProjectIds.length})`
    : selectedProjects.length === 1
    ? selectedProjects[0].name
    : `${selectedProjects.length} dự án`;

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2 h-7 sm:h-7.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer min-w-0 max-w-[180px] sm:max-w-[280px]",
          open
            ? "bg-surface-3 border-accent ring-2 ring-accent/30 text-foreground"
            : "bg-surface border-line hover:border-line-strong hover:bg-surface-2 text-foreground"
        )}
        title="Chọn dự án hiển thị trên Board"
      >
        {isAll || selectedProjects.length > 1 ? (
          <Layers className="h-3.5 w-3.5 shrink-0 text-accent" />
        ) : (
          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-accent" />
        )}
        {!isAll && selectedProjects.length === 1 && (
          <span className="shrink-0 font-mono text-[10px] text-accent">{selectedProjects[0].key}</span>
        )}
        <span className="truncate">{triggerLabel}</span>
        <ChevronsUpDown className={cn("h-3.5 w-3.5 shrink-0 text-muted", open && "text-accent")} />
      </button>

      {open && panelPos && createPortal(
        <div
          ref={panelRef}
          style={{ top: panelPos.top, left: panelPos.left }}
          className="fixed z-[100] w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface p-2 shadow-2xl animate-fade-in-up ring-1 ring-line"
        >
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted flex items-center justify-between border-b border-line/50 pb-2">
            <span>Dự án trên Board</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[9px] font-mono text-muted-light">
              {selectedProjects.length}/{projects.length}
            </span>
          </div>

          {projects.length > 4 && (
            <div className="relative my-2 px-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Tìm tên hoặc mã dự án..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-7.5 rounded-lg border border-line bg-surface-2 pl-8 pr-2 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
          )}

          {/* Tất cả dự án */}
          <button
            type="button"
            onClick={() => {
              onChange("ALL");
              setOpen(false);
            }}
            className={cn(
              "mt-1 flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition-all cursor-pointer border",
              isAll
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-transparent text-foreground hover:bg-surface-2/90 hover:text-accent"
            )}
          >
            <span className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" />
              Tất cả dự án của tôi ({memberProjectIds.length})
            </span>
            {isAll && <Check className="h-3.5 w-3.5 stroke-[3]" />}
          </button>

          {/* Danh sách dự án */}
          <div className="space-y-0.5 max-h-64 overflow-y-auto py-1 pr-0.5 border-t border-line/50 mt-1">
            {filtered.map((p) => {
              const checked = selectedSet.has(p.id);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "group/item flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors",
                    checked ? "bg-surface-2/70" : "hover:bg-surface-2/90"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleProject(p.id)}
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 rounded-md border flex items-center justify-center transition-colors cursor-pointer",
                      checked ? "bg-accent border-accent text-white" : "border-line-strong bg-surface text-transparent"
                    )}
                    title={checked ? "Bỏ dự án khỏi Board" : "Thêm dự án vào Board"}
                  >
                    <Check className="h-3 w-3 stroke-[3]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectOnly(p.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer py-0.5"
                    title="Chỉ xem dự án này"
                  >
                    <span className="shrink-0 font-mono text-[10px] font-bold text-muted-light">{p.key}</span>
                    <span className="truncate text-xs font-semibold text-foreground group-hover/item:text-accent transition-colors">
                      {p.name}
                    </span>
                  </button>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-3 text-center text-xs text-muted">Không tìm thấy dự án phù hợp</div>
            )}
          </div>

          <div className="border-t border-line/60 pt-1.5 mt-1 px-2 text-[10px] text-muted">
            Bấm tên để chỉ xem 1 dự án, bấm ô tick để xem nhiều dự án.
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
