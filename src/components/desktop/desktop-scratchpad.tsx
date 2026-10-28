"use client";

import React, { useState } from "react";
import {
  FileText,
  X,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { useLocalStorageRaw, writeLocalStorage } from "@/lib/client-store";

const SCRATCHPAD_KEY = "kztek_desktop_scratchpad";

interface DesktopScratchpadProps {
  onClose: () => void;
}

export function DesktopScratchpad({ onClose }: DesktopScratchpadProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("");

  // Nội dung đã lưu được đọc qua external store nên không cần hydrate bằng
  // setState trong useEffect. `draft` giữ nội dung đang gõ của phiên hiện tại và
  // được ưu tiên, nhờ đó vẫn gõ được khi localStorage bị chặn.
  const stored = useLocalStorageRaw(SCRATCHPAD_KEY);
  const [draft, setDraft] = useState<string | null>(null);
  const content = draft ?? stored ?? "";

  // Auto-save to localStorage
  const handleChange = (val: string) => {
    setDraft(val);
    writeLocalStorage(SCRATCHPAD_KEY, val);
    setLastSaved(new Date().toLocaleTimeString("vi-VN"));
  };

  const handleCopy = async () => {
    try {
      // Strip HTML if copying
      const tempEl = document.createElement("div");
      tempEl.innerHTML = content;
      const plain = tempEl.innerText || tempEl.textContent || content;
      await navigator.clipboard.writeText(plain);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClear = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ ghi chú nhanh này?")) {
      handleChange("");
    }
  };

  const lineCount = content ? content.split("\n").length : 0;
  const charCount = content.length;

  return (
    <div className="absolute right-6 top-16 z-40 w-[440px] bg-surface/95 backdrop-blur-md border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-5 duration-150 text-foreground">
      {/* Header */}
      <div className="bg-surface-2/80 px-4 py-3 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Ghi Chú Nhanh (Scratchpad)
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-normal">
                Auto-saved
              </span>
            </div>
            <div className="text-[10px] text-muted">
              {lastSaved ? `Đã lưu lúc ${lastSaved}` : "Tự động lưu vào máy tính"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-muted hover:text-foreground transition-colors cursor-pointer"
            title="Sao chép toàn bộ"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-muted hover:text-accent transition-colors cursor-pointer"
            title="Xóa nội dung"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-muted hover:text-foreground transition-colors cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Body with live WYSIWYG */}
      <div className="p-3 bg-surface">
        <WysiwygEditor
          value={content}
          onChange={handleChange}
          placeholder="Viết ghi chú, ý tưởng, checklist việc cần làm (1. 2. 3., in đậm, màu sắc... Tự động lưu)"
          minHeight="240px"
          autoFocus
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-surface-2/60 border-t border-line flex items-center justify-between text-[10px] text-muted">
        <div className="flex items-center gap-3">
          <span>{lineCount} dòng</span>
          <span>{charCount} ký tự</span>
        </div>
        <span>Phím tắt: Alt+S</span>
      </div>
    </div>
  );
}

