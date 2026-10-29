"use client";

import React, { useState } from "react";
import { Copy, Check, CheckCircle2, AlertTriangle } from "lucide-react";

type Indent = "2" | "4" | "tab";

// Tính dòng/cột từ vị trí lỗi mà JSON.parse trả về (nếu trình duyệt có cung cấp)
function describeJsonError(text: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const lineCol = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineCol) return `JSON không hợp lệ tại dòng ${lineCol[1]}, cột ${lineCol[2]}`;
  const match = message.match(/position\s+(\d+)/i);
  if (!match) return "JSON không hợp lệ";
  const pos = Number(match[1]);
  const before = text.slice(0, pos);
  const line = before.split("\n").length;
  const column = pos - before.lastIndexOf("\n");
  return `JSON không hợp lệ tại dòng ${line}, cột ${column}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    // Object.fromEntries giữ được cả key đặc biệt như "__proto__"
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, sortKeysDeep(child)])
    );
  }
  return value;
}

export function CalculatorJsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [indent, setIndent] = useState<Indent>("2");
  const [copied, setCopied] = useState(false);

  const run = (action: "FORMAT" | "MINIFY" | "SORT") => {
    if (!input.trim()) {
      setOutput("");
      setStatus(null);
      return;
    }
    try {
      let parsed = JSON.parse(input);
      if (action === "SORT") parsed = sortKeysDeep(parsed);
      const space = action === "MINIFY" ? undefined : indent === "tab" ? "\t" : Number(indent);
      const result = JSON.stringify(parsed, null, space);
      setOutput(result);
      setStatus({ ok: true, message: `JSON hợp lệ • ${result.length.toLocaleString("vi-VN")} ký tự` });
    } catch (err) {
      setOutput("");
      setStatus({ ok: false, message: describeJsonError(input, err) });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Trình duyệt chặn clipboard -> bỏ qua
    }
  };

  const actionClass =
    "flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all";

  return (
    <div className="space-y-3 text-xs">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='Dán JSON vào đây, ví dụ: {"name":"KZTEK","active":true}'
        spellCheck={false}
        className="w-full h-28 px-2.5 py-2 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-mono text-[11px] resize-none focus:outline-none focus:border-primary"
      />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => run("FORMAT")}
          className={`${actionClass} bg-[#F05922] hover:bg-[#d94e1d] text-white border-transparent`}
        >
          Format
        </button>
        <button
          type="button"
          onClick={() => run("MINIFY")}
          className={`${actionClass} bg-[#251C53] hover:bg-[#342775] text-zinc-200 border-[#3E2D82]`}
        >
          Minify
        </button>
        <button
          type="button"
          onClick={() => run("SORT")}
          className={`${actionClass} bg-[#251C53] hover:bg-[#342775] text-zinc-200 border-[#3E2D82]`}
        >
          Sắp xếp key
        </button>
        <select
          value={indent}
          onChange={(e) => setIndent(e.target.value as Indent)}
          title="Thụt lề"
          className="px-1.5 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white text-[11px] focus:outline-none"
        >
          <option value="2">2 space</option>
          <option value="4">4 space</option>
          <option value="tab">Tab</option>
        </select>
      </div>

      {status && (
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium ${
            status.ok ? "text-emerald-400" : "text-[#FFAA80]"
          }`}
        >
          {status.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {status.message}
        </div>
      )}

      {output && (
        <div className="relative">
          <pre className="max-h-48 overflow-auto px-2.5 py-2 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-zinc-200 font-mono text-[11px] whitespace-pre">
            {output}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            title="Sao chép"
            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-[#251C53] hover:bg-[#342775] text-zinc-300"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  );
}
