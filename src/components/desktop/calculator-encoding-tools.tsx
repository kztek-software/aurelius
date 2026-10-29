"use client";

import React, { useState } from "react";
import { ArrowDownUp, Copy, Check } from "lucide-react";

type CodecKey = "base64" | "base64url" | "url" | "hex" | "binary" | "html" | "unicode";

const CODECS: { key: CodecKey; label: string }[] = [
  { key: "base64", label: "Base64" },
  { key: "base64url", label: "Base64URL" },
  { key: "url", label: "URL" },
  { key: "hex", label: "Hex" },
  { key: "binary", label: "Nhị phân" },
  { key: "html", label: "HTML Entity" },
  { key: "unicode", label: "Unicode \\u" },
];

// Lỗi đầu vào có thông điệp hiển thị được cho người dùng
class InputError extends Error {}

// ---- Tiện ích byte <-> chuỗi (UTF-8) ----
function utf8Bytes(text: string) {
  return new TextEncoder().encode(text);
}

function bytesToUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string) {
  const clean = b64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encode(codec: CodecKey, text: string): string {
  switch (codec) {
    case "base64":
      return bytesToBase64(utf8Bytes(text));
    case "base64url":
      return bytesToBase64(utf8Bytes(text)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "url":
      return encodeURIComponent(text);
    case "hex":
      return Array.from(utf8Bytes(text), (b) => b.toString(16).padStart(2, "0")).join(" ");
    case "binary":
      return Array.from(utf8Bytes(text), (b) => b.toString(2).padStart(8, "0")).join(" ");
    case "html":
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    case "unicode":
      return Array.from(text)
        .map((ch) => {
          const code = ch.codePointAt(0) ?? 0;
          if (ch === "\\") return "\\\\";
          if (code < 128) return ch;
          if (code > 0xffff) return `\\u{${code.toString(16)}}`;
          return `\\u${code.toString(16).padStart(4, "0")}`;
        })
        .join("");
  }
}

function decode(codec: CodecKey, text: string): string {
  switch (codec) {
    case "base64":
      return bytesToUtf8(base64ToBytes(text));
    case "base64url": {
      let b64 = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4 !== 0) b64 += "=";
      return bytesToUtf8(base64ToBytes(b64));
    }
    case "url":
      return decodeURIComponent(text.replace(/\+/g, " "));
    case "hex": {
      const clean = text.replace(/0x/gi, "").replace(/[\s,:\-]/g, "");
      if (/[^0-9a-fA-F]/.test(clean)) throw new InputError("Chuỗi hex chứa ký tự không hợp lệ");
      if (clean.length % 2 !== 0) throw new InputError("Chuỗi hex phải có số ký tự chẵn");
      const bytes = new Uint8Array(clean.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
      return bytesToUtf8(bytes);
    }
    case "binary": {
      const clean = text.replace(/\s+/g, "");
      if (/[^01]/.test(clean)) throw new InputError("Chuỗi nhị phân chỉ được chứa 0 và 1");
      if (clean.length % 8 !== 0) throw new InputError("Chuỗi nhị phân phải là bội số của 8 bit");
      const bytes = new Uint8Array(clean.length / 8);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 8, i * 8 + 8), 2);
      return bytesToUtf8(bytes);
    }
    case "html": {
      // DOMParser không thực thi script nên an toàn để giải mã entity
      const doc = new DOMParser().parseFromString(text, "text/html");
      return doc.documentElement.textContent ?? "";
    }
    case "unicode":
      // Xử lý một lượt để "\\" (dấu \ đã escape) không bị hiểu nhầm thành \uXXXX
      return text.replace(
        /\\\\|\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g,
        (match, braced, plain) => {
          if (match === "\\\\") return "\\";
          const code = parseInt(braced ?? plain, 16);
          if (code > 0x10ffff) throw new InputError("Mã Unicode vượt quá U+10FFFF");
          return String.fromCodePoint(code);
        }
      );
  }
}

// ---- Chuyển đổi hệ cơ số ----
const BASES = [
  { base: 10, label: "DEC", pattern: /^-?[0-9]+$/ },
  { base: 16, label: "HEX", pattern: /^-?[0-9a-fA-F]+$/ },
  { base: 2, label: "BIN", pattern: /^-?[01]+$/ },
  { base: 8, label: "OCT", pattern: /^-?[0-7]+$/ },
];

const BASE_PREFIX: Record<number, RegExp> = { 16: /^0x/i, 2: /^0b/i, 8: /^0o/i };

function parseBigInt(value: string, base: number): bigint | null {
  const compact = value.trim().replace(/[\s_]/g, "");
  const negative = compact.startsWith("-");
  // Chỉ bỏ tiền tố đúng với hệ đang chọn (ở hệ HEX, "0b12" là số hợp lệ)
  const prefix = BASE_PREFIX[base];
  let digits = negative ? compact.slice(1) : compact;
  if (prefix) digits = digits.replace(prefix, "");
  const def = BASES.find((b) => b.base === base);
  if (!digits || digits.startsWith("-") || !def || !def.pattern.test(digits)) return null;
  let result = BigInt(0);
  const bigBase = BigInt(base);
  for (const ch of digits.toLowerCase()) result = result * bigBase + BigInt(parseInt(ch, base));
  return negative ? -result : result;
}

const textareaClass =
  "w-full h-24 px-2.5 py-2 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-mono text-[11px] resize-none focus:outline-none focus:border-primary";

export function CalculatorEncodingTools() {
  const [mode, setMode] = useState<"TEXT" | "BASE">("TEXT");

  // Mã hóa văn bản
  const [codec, setCodec] = useState<CodecKey>("base64");
  const [direction, setDirection] = useState<"ENCODE" | "DECODE">("ENCODE");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  // Hệ cơ số
  const [baseInput, setBaseInput] = useState("255");
  const [inputBase, setInputBase] = useState(10);

  let output = "";
  let error = "";
  if (input) {
    try {
      output = direction === "ENCODE" ? encode(codec, input) : decode(codec, input);
    } catch (err) {
      error = err instanceof InputError ? err.message : "Dữ liệu đầu vào không hợp lệ để giải mã";
    }
  }

  const handleSwap = () => {
    setDirection(direction === "ENCODE" ? "DECODE" : "ENCODE");
    if (output && !error) setInput(output);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Trình duyệt chặn clipboard -> bỏ qua
    }
  };

  const parsedNumber = parseBigInt(baseInput, inputBase);

  return (
    <div className="space-y-3 text-xs">
      <div className="flex gap-1 p-0.5 rounded-lg bg-[#120D2C] border border-[#2B1F5E]">
        <button
          type="button"
          onClick={() => setMode("TEXT")}
          className={`flex-1 py-1 rounded-md text-[11px] font-medium ${
            mode === "TEXT" ? "bg-[#251C53] text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Mã hóa / Giải mã văn bản
        </button>
        <button
          type="button"
          onClick={() => setMode("BASE")}
          className={`flex-1 py-1 rounded-md text-[11px] font-medium ${
            mode === "BASE" ? "bg-[#251C53] text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Hệ cơ số
        </button>
      </div>

      {mode === "TEXT" && (
        <>
          <div className="flex flex-wrap gap-1">
            {CODECS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCodec(c.key)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                  c.key === codec
                    ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                    : "bg-[#120D2C] text-zinc-400 border-[#2B1F5E] hover:text-zinc-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[11px] text-zinc-400 block mb-1">
              {direction === "ENCODE" ? "Văn bản gốc" : "Chuỗi đã mã hóa"}
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={direction === "ENCODE" ? "Nhập văn bản cần mã hóa..." : "Dán chuỗi cần giải mã..."}
              className={textareaClass}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-orange-300">
              {direction === "ENCODE" ? "Mã hóa (Encode)" : "Giải mã (Decode)"}
            </span>
            <button
              type="button"
              onClick={handleSwap}
              title="Đổi chiều Encode / Decode"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#251C53] hover:bg-[#342775] text-orange-400 border border-[#3E2D82] text-[11px]"
            >
              <ArrowDownUp className="w-3 h-3" />
              Đổi chiều
            </button>
          </div>

          <div className="relative">
            <textarea
              readOnly
              value={error ? "" : output}
              placeholder={error || "Kết quả sẽ hiển thị tại đây"}
              className={`${textareaClass} ${error ? "border-[#F05922]/60 placeholder:text-[#FFAA80]" : ""}`}
            />
            {output && !error && (
              <button
                type="button"
                onClick={() => handleCopy(output)}
                title="Sao chép"
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-[#251C53] hover:bg-[#342775] text-zinc-300"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </>
      )}

      {mode === "BASE" && (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="text"
              value={baseInput}
              onChange={(e) => setBaseInput(e.target.value)}
              className="w-full px-2.5 py-2 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-primary"
            />
            <select
              value={inputBase}
              onChange={(e) => setInputBase(Number(e.target.value))}
              className="px-2 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white text-xs focus:outline-none focus:border-primary"
            >
              {BASES.map((b) => (
                <option key={b.base} value={b.base}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {parsedNumber === null && baseInput.trim() !== "" && (
            <div className="text-[11px] text-[#FFAA80]">Giá trị không hợp lệ với hệ cơ số đã chọn</div>
          )}

          <div className="space-y-1">
            {BASES.map((b) => {
              const value = parsedNumber === null ? "—" : parsedNumber.toString(b.base).toUpperCase();
              return (
                <div
                  key={b.base}
                  className="px-2 py-1.5 rounded-lg bg-[#120D2C] border border-[#2B1F5E] flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="text-orange-300 font-semibold w-9 shrink-0">{b.label}</span>
                  <span className="font-mono text-zinc-200 break-all text-right flex-1">{value}</span>
                  {parsedNumber !== null && (
                    <button
                      type="button"
                      onClick={() => handleCopy(value)}
                      title="Sao chép"
                      className="p-0.5 rounded text-zinc-400 hover:text-white shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
