"use client";

import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";

type UnitDef = { key: string; label: string; factor: number };
type Category = { key: string; label: string; units: UnitDef[] };

// Hệ số quy đổi về đơn vị gốc của từng nhóm (nhiệt độ xử lý riêng)
const CATEGORIES: Category[] = [
  {
    key: "length",
    label: "Độ dài",
    units: [
      { key: "mm", label: "Milimét (mm)", factor: 0.001 },
      { key: "cm", label: "Centimét (cm)", factor: 0.01 },
      { key: "m", label: "Mét (m)", factor: 1 },
      { key: "km", label: "Kilômét (km)", factor: 1000 },
      { key: "in", label: "Inch (in)", factor: 0.0254 },
      { key: "ft", label: "Feet (ft)", factor: 0.3048 },
      { key: "yd", label: "Yard (yd)", factor: 0.9144 },
      { key: "mi", label: "Dặm (mi)", factor: 1609.344 },
    ],
  },
  {
    key: "mass",
    label: "Khối lượng",
    units: [
      { key: "mg", label: "Miligam (mg)", factor: 0.000001 },
      { key: "g", label: "Gam (g)", factor: 0.001 },
      { key: "kg", label: "Kilôgam (kg)", factor: 1 },
      { key: "t", label: "Tấn (t)", factor: 1000 },
      { key: "oz", label: "Ounce (oz)", factor: 0.028349523125 },
      { key: "lb", label: "Pound (lb)", factor: 0.45359237 },
    ],
  },
  {
    key: "area",
    label: "Diện tích",
    units: [
      { key: "cm2", label: "cm²", factor: 0.0001 },
      { key: "m2", label: "m²", factor: 1 },
      { key: "ha", label: "Hecta (ha)", factor: 10000 },
      { key: "km2", label: "km²", factor: 1000000 },
      { key: "ft2", label: "ft²", factor: 0.09290304 },
      { key: "acre", label: "Acre", factor: 4046.8564224 },
    ],
  },
  {
    key: "volume",
    label: "Thể tích",
    units: [
      { key: "ml", label: "Mililít (ml)", factor: 0.001 },
      { key: "l", label: "Lít (l)", factor: 1 },
      { key: "m3", label: "m³", factor: 1000 },
      { key: "gal", label: "Gallon US (gal)", factor: 3.785411784 },
    ],
  },
  {
    key: "temperature",
    label: "Nhiệt độ",
    units: [
      { key: "C", label: "Độ C (°C)", factor: 1 },
      { key: "F", label: "Độ F (°F)", factor: 1 },
      { key: "K", label: "Kelvin (K)", factor: 1 },
    ],
  },
  {
    key: "time",
    label: "Thời gian",
    units: [
      { key: "ms", label: "Mili giây (ms)", factor: 0.001 },
      { key: "s", label: "Giây (s)", factor: 1 },
      { key: "min", label: "Phút", factor: 60 },
      { key: "h", label: "Giờ", factor: 3600 },
      { key: "d", label: "Ngày", factor: 86400 },
      { key: "wk", label: "Tuần", factor: 604800 },
    ],
  },
  {
    key: "data",
    label: "Dữ liệu",
    units: [
      { key: "bit", label: "Bit", factor: 0.125 },
      { key: "B", label: "Byte (B)", factor: 1 },
      { key: "KB", label: "Kilobyte (KB)", factor: 1024 },
      { key: "MB", label: "Megabyte (MB)", factor: 1024 ** 2 },
      { key: "GB", label: "Gigabyte (GB)", factor: 1024 ** 3 },
      { key: "TB", label: "Terabyte (TB)", factor: 1024 ** 4 },
    ],
  },
  {
    key: "speed",
    label: "Tốc độ",
    units: [
      { key: "mps", label: "m/s", factor: 1 },
      { key: "kmh", label: "km/h", factor: 1 / 3.6 },
      { key: "mph", label: "mph", factor: 0.44704 },
      { key: "kn", label: "Hải lý/giờ (knot)", factor: 0.514444 },
    ],
  },
];

function toCelsius(value: number, unit: string) {
  if (unit === "F") return ((value - 32) * 5) / 9;
  if (unit === "K") return value - 273.15;
  return value;
}

function fromCelsius(value: number, unit: string) {
  if (unit === "F") return (value * 9) / 5 + 32;
  if (unit === "K") return value + 273.15;
  return value;
}

function convert(value: number, category: Category, from: string, to: string) {
  if (category.key === "temperature") return fromCelsius(toCelsius(value, from), to);
  const fromUnit = category.units.find((u) => u.key === from);
  const toUnit = category.units.find((u) => u.key === to);
  if (!fromUnit || !toUnit) return NaN;
  return (value * fromUnit.factor) / toUnit.factor;
}

function formatResult(n: number) {
  if (!Number.isFinite(n)) return "—";
  // Loại bỏ sai số dấu phẩy động (vd 0.30000000000000004)
  const rounded = parseFloat(n.toPrecision(15));
  // Giá trị quá nhỏ/quá lớn -> dạng khoa học để không bị hiển thị thành 0
  const abs = Math.abs(rounded);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return rounded.toExponential(6).replace(/\.?0+e/, "e").replace(".", ",");
  return rounded.toLocaleString("vi-VN", { maximumFractionDigits: 10 });
}

// Chấp nhận cả kiểu viết 1.000,5 (vi-VN) lẫn 1000.5; chuỗi lẫn chữ -> không hợp lệ
function parseInput(raw: string) {
  let text = raw.trim().replace(/\s/g, "");
  if (!text) return NaN;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  // Chỉ coi "." là phân cách nghìn khi có từ 2 dấu trở lên (1.000.000); "0.125" vẫn là số thập phân
  else if (/^-?[1-9]\d{0,2}(\.\d{3}){2,}$/.test(text)) text = text.replace(/\./g, "");
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(text)) return NaN;
  return Number(text);
}

const DEFAULT_PAIR: Record<string, [string, string]> = { length: ["m", "km"] };

function defaultUnits(category: Category): [string, string] {
  return DEFAULT_PAIR[category.key] ?? [category.units[0].key, category.units[1]?.key ?? category.units[0].key];
}

const selectClass =
  "w-full px-2 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white text-xs focus:outline-none focus:border-primary";

export function CalculatorUnitConverter() {
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[0].key);
  const category = CATEGORIES.find((c) => c.key === categoryKey) ?? CATEGORIES[0];
  const [fromUnit, setFromUnit] = useState(defaultUnits(category)[0]);
  const [toUnit, setToUnit] = useState(defaultUnits(category)[1]);
  const [input, setInput] = useState("1");

  const handleCategoryChange = (key: string) => {
    const next = CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
    const [from, to] = defaultUnits(next);
    setCategoryKey(next.key);
    setFromUnit(from);
    setToUnit(to);
  };

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const numericInput = parseInput(input);
  const result = Number.isNaN(numericInput) ? NaN : convert(numericInput, category, fromUnit, toUnit);

  return (
    <div className="space-y-3 text-xs">
      {/* Chọn nhóm đơn vị */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => handleCategoryChange(c.key)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
              c.key === categoryKey
                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                : "bg-[#120D2C] text-zinc-400 border-[#2B1F5E] hover:text-zinc-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-[11px] text-zinc-400 block">Giá trị cần đổi</label>
        <input
          type="text"
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full px-2.5 py-2 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">Từ</label>
          <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} className={selectClass}>
            {category.units.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSwap}
          title="Đảo chiều"
          className="p-2 rounded-lg bg-[#251C53] hover:bg-[#342775] text-orange-400 border border-[#3E2D82]"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">Sang</label>
          <select value={toUnit} onChange={(e) => setToUnit(e.target.value)} className={selectClass}>
            {category.units.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kết quả */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 via-[#251C53] to-orange-500/10 border border-orange-500/30">
        <div className="text-[10px] text-zinc-400">Kết quả</div>
        <div className="text-xl font-bold font-mono text-orange-400 mt-0.5 break-all">
          {formatResult(result)}
        </div>
      </div>

      {/* Bảng quy đổi nhanh sang mọi đơn vị trong nhóm */}
      {!Number.isNaN(numericInput) && (
        <div className="space-y-1">
          {category.units
            .filter((u) => u.key !== fromUnit)
            .map((u) => (
              <div
                key={u.key}
                className="px-2 py-1.5 rounded-lg bg-[#120D2C] border border-[#2B1F5E] flex items-center justify-between text-[11px]"
              >
                <span className="text-zinc-400">{u.label}</span>
                <span className="font-mono text-zinc-200">
                  {formatResult(convert(numericInput, category, fromUnit, u.key))}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
