"use client";

import React, { useState, useEffect } from "react";
import { Calculator, X, Layers, Delete } from "lucide-react";
import { CalculatorUnitConverter } from "./calculator-unit-converter";
import { CalculatorEncodingTools } from "./calculator-encoding-tools";
import { CalculatorJsonFormatter } from "./calculator-json-formatter";

interface SmartWorkCalculatorProps {
  onClose: () => void;
}

type CalculatorTab = "STANDARD" | "UNIT" | "ENCODE" | "JSON" | "SPRINT" | "KPI";

const TABS: { key: CalculatorTab; label: string }[] = [
  { key: "STANDARD", label: "Số Học" },
  { key: "UNIT", label: "Đổi Đơn Vị" },
  { key: "ENCODE", label: "Mã Hóa" },
  { key: "JSON", label: "JSON" },
  { key: "SPRINT", label: "Sprint & SP" },
  { key: "KPI", label: "Tiến Độ & KPI" },
];

// Loại bỏ sai số dấu phẩy động (0.1 + 0.2 = 0.30000000000000004 -> 0.3)
function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "0";
  return parseFloat(n.toPrecision(15)).toString();
}

export function SmartWorkCalculator({ onClose }: SmartWorkCalculatorProps) {
  const [activeTab, setActiveTab] = useState<CalculatorTab>("STANDARD");

  // Standard Calculator State
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewOperand, setWaitingForNewOperand] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // Sprint Capacity Estimator State
  const [teamMembers, setTeamMembers] = useState<number>(5);
  const [sprintDays, setSprintDays] = useState<number>(10);
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  const [focusFactor, setFocusFactor] = useState<number>(75); // 75%
  const [pointRatio, setPointRatio] = useState<number>(6); // 6 hours per story point

  // KPI & Progress State
  const [totalScopeTasks, setTotalScopeTasks] = useState<number>(30);
  const [completedTasks, setCompletedTasks] = useState<number>(18);
  const [remainingDays, setRemainingDays] = useState<number>(5);
  const [manDayRate, setManDayRate] = useState<number>(1500000); // 1.5M VND / man-day

  // Standard Calculator Handlers
  const handleDigit = (digit: string) => {
    if (waitingForNewOperand) {
      setDisplay(digit);
      setWaitingForNewOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const handleDecimal = () => {
    if (waitingForNewOperand) {
      setDisplay("0.");
      setWaitingForNewOperand(false);
    } else if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setPrevValue(null);
    setOperation(null);
    setWaitingForNewOperand(false);
  };

  // Xóa ký tự cuối cùng (nút ⌫ / phím Backspace)
  const handleBackspace = () => {
    // Đang hiển thị kết quả phép tính -> xóa kết quả về 0 (giữ phép toán đang chờ nếu có)
    if (waitingForNewOperand) {
      setDisplay("0");
      setWaitingForNewOperand(false);
      return;
    }
    // Số dạng mũ (1e+21) hoặc Infinity/NaN không xóa từng ký tự được -> về 0
    if (/[^0-9.\-]/.test(display)) {
      setDisplay("0");
      return;
    }
    const next = display.slice(0, -1);
    setDisplay(next === "" || next === "-" || next === "-0" ? "0" : next);
  };

  const handleToggleSign = () => {
    const val = parseFloat(display);
    setDisplay(formatNumber(val * -1));
  };

  const handlePercentage = () => {
    const val = parseFloat(display);
    setDisplay(formatNumber(val / 100));
  };

  const handleSqrt = () => {
    const val = parseFloat(display);
    if (val >= 0) {
      const result = formatNumber(Math.sqrt(val));
      setDisplay(result);
      setHistory((prev) => [`√(${val}) = ${result}`, ...prev.slice(0, 4)]);
    }
  };

  const performOperation = (nextOp: string) => {
    const inputValue = parseFloat(display);

    // Bấm 2 toán tử liên tiếp (vd "2 + -"): chỉ thay toán tử, không tính với chính số đang hiển thị
    if (waitingForNewOperand && operation && nextOp !== "=") {
      setOperation(nextOp);
      return;
    }

    if (prevValue !== null && operation) {
      const currentValue = prevValue;
      let result = 0;

      switch (operation) {
        case "+":
          result = currentValue + inputValue;
          break;
        case "-":
          result = currentValue - inputValue;
          break;
        case "×":
        case "*":
          result = currentValue * inputValue;
          break;
        case "÷":
        case "/":
          result = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
        default:
          result = inputValue;
      }

      const formatted = formatNumber(result);
      setHistory((prev) => [
        `${currentValue} ${operation} ${inputValue} = ${formatted}`,
        ...prev.slice(0, 4),
      ]);
      // Sau "=" kết thúc chuỗi phép tính: số nhập tiếp theo bắt đầu phép tính mới
      setPrevValue(nextOp === "=" ? null : parseFloat(formatted));
      setDisplay(formatted);
    } else {
      // Chưa có phép toán đang chờ: số hiện tại là toán hạng đầu; "=" thì không giữ lại giá trị nào
      setPrevValue(nextOp === "=" ? null : inputValue);
    }

    setWaitingForNewOperand(true);
    setOperation(nextOp === "=" ? null : nextOp);
  };

  // Keyboard support for standard calculator
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (activeTab !== "STANDARD") return;
      // Bỏ qua tổ hợp phím (Ctrl +/- zoom, Alt+C...) và khi đang gõ trong ô nhập
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
      else if (e.key === "Delete" || e.key === "Escape") handleClear();
      else if (e.key === ".") handleDecimal();
      else if (e.key === "+" || e.key === "-") performOperation(e.key);
      else if (e.key === "*") performOperation("×");
      else if (e.key === "/") performOperation("÷");
      else if (e.key === "Enter" || e.key === "=") performOperation("=");
      else return;
      // Chặn hành vi mặc định: tránh Enter kích hoạt thêm nút đang được focus
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeTab, display, prevValue, operation, waitingForNewOperand]);

  // Sprint Capacity Calculations
  const grossHours = teamMembers * sprintDays * hoursPerDay;
  const netCapacityHours = Math.round((grossHours * focusFactor) / 100);
  const estimatedStoryPoints = Math.round(netCapacityHours / pointRatio);

  // Fibonacci Scale Reference
  const fibonacciScale = [
    { pt: 1, label: "Rất dễ", time: "1–2 giờ", example: "Đổi màu nút, sửa typo, cập nhật config" },
    { pt: 2, label: "Dễ", time: "3–4 giờ", example: "Tạo form đơn giản, sửa bug nhỏ" },
    { pt: 3, label: "Trung bình", time: "1 ngày", example: "CRUD trang mới, validate dữ liệu" },
    { pt: 5, label: "Phức tạp", time: "2–3 ngày", example: "Tính năng mới có API + UI" },
    { pt: 8, label: "Rất khó", time: "4–5 ngày", example: "Tích hợp dịch vụ ngoài, refactor module" },
    { pt: 13, label: "Cực lớn (Nên chia nhỏ)", time: "> 1 tuần", example: "Kiến trúc hệ thống lớn" },
  ];

  // KPI Calculations
  const progressPercent = totalScopeTasks > 0 ? Math.round((completedTasks / totalScopeTasks) * 100) : 0;
  const remainingTasks = Math.max(0, totalScopeTasks - completedTasks);
  const velocityNeeded = remainingDays > 0 ? (remainingTasks / remainingDays).toFixed(1) : "0";
  const estimatedCost = Math.round(teamMembers * sprintDays * manDayRate);

  return (
    <div className="absolute right-6 top-16 z-40 w-[420px] max-w-[calc(100vw-3rem)] bg-[#181236]/95 backdrop-blur-md border border-[#3E2D82] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-5 duration-150 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#251C53] via-[#332570] to-[#251C53] px-4 py-3 border-b border-[#3E2D82] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              Máy Tính Năng Suất
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/30 text-orange-300 font-normal">
                Smart Calc
              </span>
            </div>
            <div className="text-[10px] text-zinc-400">Công cụ tính toán & ước lượng công việc</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          title="Đóng (Alt+C)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="grid grid-cols-3 gap-0.5 border-b border-[#312564] bg-[#120D2C] p-1 text-xs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`py-1.5 rounded-lg font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[#251C53] text-white shadow-sm border border-[#44318E]"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body Content */}
      <div className="p-4 max-h-[480px] overflow-y-auto">
        {/* TAB 1: STANDARD CALCULATOR */}
        {activeTab === "STANDARD" && (
          <div className="space-y-3">
            {/* Display screen */}
            <div className="p-3 rounded-xl bg-[#0F0B24] border border-[#2B1F5E] text-right font-mono">
              <div className="text-[11px] text-zinc-400 h-4 truncate">
                {history[0] || (operation ? `${prevValue} ${operation}` : "")}
              </div>
              <div className="text-2xl font-bold text-white tracking-wider truncate mt-1">
                {display}
              </div>
            </div>

            {/* Buttons Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={handleClear}
                title="Xóa tất cả (Esc / Delete)"
                className="col-span-2 py-2.5 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs border border-accent/30 transition-all"
              >
                C
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                title="Xóa ký tự cuối (Backspace)"
                className="col-span-2 py-2.5 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs border border-accent/30 transition-all flex items-center justify-center"
              >
                <Delete className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToggleSign}
                className="py-2.5 rounded-xl bg-[#251C53] hover:bg-[#342775] text-zinc-200 text-xs font-semibold border border-[#3E2D82]"
              >
                ±
              </button>
              <button
                type="button"
                onClick={handleSqrt}
                className="py-2.5 rounded-xl bg-[#251C53] hover:bg-[#342775] text-zinc-200 text-xs font-semibold border border-[#3E2D82]"
              >
                √
              </button>
              <button
                type="button"
                onClick={handlePercentage}
                className="py-2.5 rounded-xl bg-[#251C53] hover:bg-[#342775] text-zinc-200 text-xs font-semibold border border-[#3E2D82]"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => performOperation("÷")}
                className="py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold text-sm border border-orange-500/30"
              >
                ÷
              </button>

              {["7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="py-2.5 rounded-xl bg-[#1D1642] hover:bg-[#2A205E] text-white font-semibold text-sm border border-[#312564]"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => performOperation("×")}
                className="py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold text-sm border border-orange-500/30"
              >
                ×
              </button>

              {["4", "5", "6"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="py-2.5 rounded-xl bg-[#1D1642] hover:bg-[#2A205E] text-white font-semibold text-sm border border-[#312564]"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => performOperation("-")}
                className="py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold text-sm border border-orange-500/30"
              >
                -
              </button>

              {["1", "2", "3"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="py-2.5 rounded-xl bg-[#1D1642] hover:bg-[#2A205E] text-white font-semibold text-sm border border-[#312564]"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => performOperation("+")}
                className="py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold text-sm border border-orange-500/30"
              >
                +
              </button>

              <button
                type="button"
                onClick={() => handleDigit("0")}
                className="col-span-2 py-2.5 rounded-xl bg-[#1D1642] hover:bg-[#2A205E] text-white font-semibold text-sm border border-[#312564]"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDecimal}
                className="py-2.5 rounded-xl bg-[#1D1642] hover:bg-[#2A205E] text-white font-semibold text-sm border border-[#312564]"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => performOperation("=")}
                className="py-2.5 rounded-xl bg-[#F05922] hover:bg-[#d94e1d] text-white font-bold text-sm shadow-md"
              >
                =
              </button>
            </div>
          </div>
        )}

        {activeTab === "UNIT" && <CalculatorUnitConverter />}
        {activeTab === "ENCODE" && <CalculatorEncodingTools />}
        {activeTab === "JSON" && <CalculatorJsonFormatter />}

        {/* TAB 2: SPRINT & STORY POINTS ESTIMATOR */}
        {activeTab === "SPRINT" && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Số nhân sự (Dev/QA)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={teamMembers}
                  onChange={(e) => setTeamMembers(Number(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-bold text-xs focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Số ngày Sprint</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={sprintDays}
                  onChange={(e) => setSprintDays(Number(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-bold text-xs focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Focus Factor (%)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={focusFactor}
                  onChange={(e) => setFocusFactor(Number(e.target.value) || 50)}
                  className="w-full px-2.5 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-bold text-xs focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Giờ / 1 Story Point</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={pointRatio}
                  onChange={(e) => setPointRatio(Number(e.target.value) || 6)}
                  className="w-full px-2.5 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-bold text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Results Box */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 via-[#251C53] to-orange-500/10 border border-orange-500/30 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-300">Tổng công suất khả dụng:</span>
                <span className="font-mono font-bold text-orange-400 text-sm">
                  {netCapacityHours} giờ
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-white/10 pt-2">
                <span className="text-white font-semibold">Ước tính Story Points cam kết:</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  ~ {estimatedStoryPoints} SP
                </span>
              </div>
            </div>

            {/* Fibonacci Reference */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
                <Layers className="w-3 h-3 text-orange-400" />
                Thang Điểm Fibonacci Chuẩn KZTEK:
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {fibonacciScale.map((f) => (
                  <div
                    key={f.pt}
                    className="p-1.5 rounded-lg bg-[#120D2C] border border-[#2B1F5E] flex items-center justify-between text-[10px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-orange-500/20 text-orange-300 font-bold flex items-center justify-center font-mono">
                        {f.pt}
                      </span>
                      <span className="font-semibold text-zinc-200">{f.label} ({f.time})</span>
                    </div>
                    <span className="text-zinc-400 truncate max-w-[140px]">{f.example}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: KPI & PROGRESS CALCULATOR */}
        {activeTab === "KPI" && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Tổng Tasks</label>
                <input
                  type="number"
                  min={1}
                  value={totalScopeTasks}
                  onChange={(e) => setTotalScopeTasks(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-bold text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Đã Xong</label>
                <input
                  type="number"
                  min={0}
                  value={completedTasks}
                  onChange={(e) => setCompletedTasks(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-emerald-400 font-bold text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Ngày Còn</label>
                <input
                  type="number"
                  min={1}
                  value={remainingDays}
                  onChange={(e) => setRemainingDays(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1.5 bg-[#0F0B24] border border-[#2B1F5E] rounded-lg text-white font-bold text-xs"
                />
              </div>
            </div>

            {/* KPI Metrics Dashboard */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#120D2C] border border-[#2B1F5E]">
                <div className="text-[10px] text-zinc-400">Tỷ lệ hoàn thành</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">{progressPercent}%</div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div style={{ width: `${progressPercent}%` }} className="bg-emerald-400 h-full" />
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#120D2C] border border-[#2B1F5E]">
                <div className="text-[10px] text-zinc-400">Tốc độ cần đạt</div>
                <div className="text-xl font-bold text-orange-400 mt-0.5">{velocityNeeded}</div>
                <div className="text-[9px] text-zinc-500 mt-1">tasks / ngày</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0F0B24] border border-[#2B1F5E] space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-300">Ước tính Chi Phí Nhân Sự Sprint:</div>
              <div className="text-lg font-bold font-mono text-cyan-300">
                {estimatedCost.toLocaleString("vi-VN")} đ
              </div>
              <div className="text-[10px] text-zinc-400">
                ({teamMembers} nhân sự × {sprintDays} ngày @ {manDayRate.toLocaleString("vi-VN")} đ/ngày)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-[#0E0A24] border-t border-[#312564] flex items-center justify-between text-[10px] text-zinc-400">
        <span>KZTEK Work Productivity Suite</span>
        <span>Phím tắt: Alt+C</span>
      </div>
    </div>
  );
}
