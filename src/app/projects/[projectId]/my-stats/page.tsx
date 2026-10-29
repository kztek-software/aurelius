"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock,
  FolderKanban,
  Inbox,
  Layers,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  startOfQuarter,
  parseISO,
} from "date-fns";
import { useTabCache } from "@/lib/tab-cache";
import { useTheme } from "@/lib/theme-context";
import { priorityMeta, statusMeta } from "@/lib/constants";

type TaskItem = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  storyPoints: number | null;
  dueDate: string | null;
  project: { id: string; name: string; key: string };
  assignee: { id: string; name: string; avatarColor: string } | null;
};

type TeamOption = {
  id: string;
  name: string;
  code: string;
  color: string;
  members: { id: string; name: string; avatarColor: string; title: string | null }[];
};

type MemberStat = {
  userId: string;
  name: string;
  avatarColor: string;
  title: string | null;
  assigned: number;
  completed: number;
  completedPoints: number;
  inProgress: number;
  open: number;
  overdue: number;
  onTimeRate: number | null;
};

type MyStats = {
  range: { from: string; to: string; granularity: "day" | "week" };
  scope: "me" | "team";
  team: { id: string; name: string; code: string; color: string } | null;
  teams: TeamOption[];
  memberDist: MemberStat[];
  projects: { id: string; name: string; key: string }[];
  summary: {
    assigned: number;
    completed: number;
    completedPoints: number;
    completedWithDue: number;
    completedOnTime: number;
    onTimeRate: number | null;
    inProgress: number;
    open: number;
    overdue: number;
    upcoming: number;
    scopedTotal: number;
  };
  trend: { bucket: string; completed: number; assigned: number; points: number }[];
  statusDist: { status: string; count: number }[];
  priorityDist: { priority: string; count: number }[];
  projectDist: { projectId: string; name: string; key: string; total: number; done: number; open: number }[];
  overdueTasks: TaskItem[];
  upcomingTasks: TaskItem[];
};

type Preset = "lastWeek" | "thisWeek" | "month" | "quarter" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "lastWeek", label: "Tuần trước" },
  { id: "thisWeek", label: "Tuần này" },
  { id: "month", label: "Tháng này" },
  { id: "quarter", label: "Quý này" },
  { id: "custom", label: "Tùy chọn" },
];

const tooltipStyle = {
  backgroundColor: "#181E2E",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: 10,
  fontSize: 12,
  color: "#F1F4F9",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
};

const DATE_INPUT = "yyyy-MM-dd";

// Tính khoảng [from, to] (giờ địa phương) theo preset
function presetRange(preset: Exclude<Preset, "custom">): { from: Date; to: Date } {
  const now = new Date();
  const to = endOfDay(now);
  switch (preset) {
    // Tuần tính từ thứ Hai đến Chủ nhật
    case "lastWeek": {
      const lastWeek = subWeeks(now, 1);
      return { from: startOfWeek(lastWeek, { weekStartsOn: 1 }), to: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    }
    case "thisWeek":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to };
    case "month":
      return { from: startOfMonth(now), to };
    case "quarter":
      return { from: startOfQuarter(now), to };
  }
}

function fmtDue(iso: string | null) {
  return iso ? format(parseISO(iso.slice(0, 10)), "dd/MM/yyyy") : "—";
}

export default function MyStatsPage() {
  const params = useParams<{ projectId: string }>();
  const currentProjectId = params.projectId;
  const { theme } = useTheme();

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(() => format(subDays(new Date(), 29), DATE_INPUT));
  const [customTo, setCustomTo] = useState(() => format(new Date(), DATE_INPUT));
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  // Phạm vi xem: "ME" = cá nhân, còn lại là id nhóm người dùng quản lý
  const [viewScope, setViewScope] = useState<string>("ME");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  // Giữ danh sách nhóm giữa các lần tải để bộ chọn không nhấp nháy khi đổi phạm vi
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const selectedTeam = teams.find((t) => t.id === viewScope) ?? null;

  // Khoảng thời gian thực tế gửi lên API (ISO, theo giờ địa phương của trình duyệt)
  const range = useMemo(() => {
    if (preset !== "custom") return presetRange(preset);
    if (!customFrom || !customTo || customFrom > customTo) return null;
    return { from: startOfDay(parseISO(customFrom)), to: endOfDay(parseISO(customTo)) };
  }, [preset, customFrom, customTo]);

  const apiUrl = useMemo(() => {
    if (!range) return null;
    const qs = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      // Phút lệch so với UTC (VN = 420) để server gom theo ngày địa phương
      tz: String(-new Date().getTimezoneOffset()),
    });
    if (projectFilter !== "ALL") qs.set("projectId", projectFilter);
    if (viewScope !== "ME") {
      qs.set("scope", "team");
      qs.set("teamId", viewScope);
      if (memberFilter !== "ALL") qs.set("memberId", memberFilter);
    }
    return `/api/me/stats?${qs.toString()}`;
  }, [range, projectFilter, viewScope, memberFilter]);

  const handleScopeChange = (value: string) => {
    setViewScope(value);
    setMemberFilter("ALL");
    setProjectFilter("ALL");
  };

  const fetchStats = useCallback(async (): Promise<MyStats> => {
    if (!apiUrl) throw new Error("Khoảng thời gian không hợp lệ");
    const res = await fetch(apiUrl);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Không tải được thống kê");
    return json;
  }, [apiUrl]);

  const { data, loading, isValidating, error, revalidate } = useTabCache<MyStats>(apiUrl, fetchStats, {
    staleTime: 15000,
  });

  // Cập nhật danh sách nhóm ngay khi có dữ liệu mới (điều chỉnh state trong render, không cần effect)
  if (data?.teams && data.teams !== teams) setTeams(data.teams);

  const isTeamView = data?.scope === "team";

  // Màu series "được giao": Navy nhạt trên nền sáng, Navy rất nhạt trên nền tối (đủ tương phản)
  const assignedColor = theme === "light" ? "#4A3F8C" : "#B8B3D6";
  const gridColor = theme === "light" ? "#CBCBCB" : "#262b36";

  const trendData = useMemo(
    () =>
      (data?.trend ?? []).map((r) => ({
        ...r,
        label:
          data?.range.granularity === "week"
            ? `T${format(parseISO(r.bucket), "dd/MM")}`
            : format(parseISO(r.bucket), "dd/MM"),
      })),
    [data]
  );

  const s = data?.summary;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row min-h-14 shrink-0 sm:items-center justify-between border-b border-line px-3 sm:px-4 py-2 sm:py-0 gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h1 className="text-sm font-bold">Thống kê công việc</h1>
          <span className="hidden md:inline text-xs text-muted">
            —{" "}
            {selectedTeam
              ? memberFilter === "ALL"
                ? `nhóm ${selectedTeam.name} (${selectedTeam.members.length} thành viên)`
                : `${selectedTeam.members.find((m) => m.id === memberFilter)?.name ?? "thành viên"} • nhóm ${selectedTeam.name}`
              : "task được giao cho bạn trên các dự án"}
          </span>
        </div>
        <button
          onClick={() => revalidate()}
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-2 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
        {/* Bộ lọc: thời gian + dự án */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarRange className="h-4 w-4 text-muted" />
            <div className="flex items-center rounded-lg bg-surface-2 p-1 border border-line overflow-x-auto no-scrollbar">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    preset === p.id
                      ? "bg-accent text-white shadow-sm font-semibold"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-foreground"
                />
                <span className="text-muted">→</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-foreground"
                />
              </div>
            )}
          </div>

          {teams.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap lg:ml-auto">
              <Users className="h-4 w-4 text-muted" />
              <select
                value={viewScope}
                onChange={(e) => handleScopeChange(e.target.value)}
                className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-foreground cursor-pointer max-w-[220px]"
              >
                <option value="ME">Cá nhân (của tôi)</option>
                <optgroup label="Nhóm quản lý">
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      Nhóm {t.name} ({t.members.length})
                    </option>
                  ))}
                </optgroup>
              </select>
              {selectedTeam && (
                <select
                  value={memberFilter}
                  onChange={(e) => {
                    setMemberFilter(e.target.value);
                    setProjectFilter("ALL");
                  }}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-foreground cursor-pointer max-w-[200px]"
                >
                  <option value="ALL">Tất cả thành viên</option>
                  {selectedTeam.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className={`flex items-center gap-2 ${teams.length > 0 ? "" : "lg:ml-auto"}`}>
            <FolderKanban className="h-4 w-4 text-muted" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-foreground cursor-pointer max-w-[240px]"
            >
              <option value="ALL">Tất cả dự án</option>
              {(data?.projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.key}] {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!range && (
          <div className="rounded-xl border border-accent/40 bg-accent-subtle p-3 text-xs text-accent">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
          </div>
        )}

        {range && !data && (
          <div className="flex h-60 items-center justify-center text-sm text-muted">
            {loading ? "Đang tải thống kê..." : error ? String((error as Error).message ?? error) : ""}
          </div>
        )}

        {data && s && (
          <>
            {error != null && (
              <div className="rounded-xl border border-accent/40 bg-accent-subtle p-3 text-xs text-accent">
                {String((error as Error).message ?? error)}
              </div>
            )}

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Kpi
                label="Được giao trong kỳ"
                value={s.assigned}
                hint="task mới"
                icon={<Inbox className="h-4 w-4 text-muted" />}
              />
              <Kpi
                label="Hoàn thành trong kỳ"
                value={s.completed}
                hint="task"
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                valueClass="text-emerald-600"
              />
              <Kpi
                label="Đang làm / review"
                value={s.inProgress}
                hint={`/ ${s.open} đang mở`}
                icon={<Clock className="h-4 w-4 text-amber-600" />}
                valueClass="text-amber-600"
              />
              <Kpi
                label="Quá hạn (hiện tại)"
                value={s.overdue}
                hint="task"
                icon={<AlertTriangle className={`h-4 w-4 ${s.overdue > 0 ? "text-accent" : "text-muted"}`} />}
                valueClass={s.overdue > 0 ? "text-accent" : "text-foreground"}
                highlight={s.overdue > 0}
              />
              <Kpi
                label="Đúng hạn"
                value={s.onTimeRate === null ? "—" : `${s.onTimeRate}%`}
                hint={s.completedWithDue > 0 ? `${s.completedOnTime}/${s.completedWithDue} có hạn` : "chưa có task có hạn"}
                icon={<Target className="h-4 w-4 text-accent" />}
              />
              <Kpi
                label="Story points hoàn thành"
                value={s.completedPoints}
                hint="pts"
                icon={<Zap className="h-4 w-4 text-accent" />}
                valueClass="text-accent"
              />
            </div>

            {/* Xu hướng */}
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold">
                  Xu hướng theo {data.range.granularity === "day" ? "ngày" : "tuần"}
                </h2>
                <span className="text-xs text-muted">
                  {format(new Date(data.range.from), "dd/MM/yyyy")} – {format(new Date(data.range.to), "dd/MM/yyyy")}
                  {data.range.granularity === "week" && " (mỗi điểm = tuần bắt đầu từ thứ Hai)"}
                </span>
              </div>
              {trendData.some((r) => r.completed > 0 || r.assigned > 0) ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8b93a3" }} minTickGap={12} />
                    <YAxis tick={{ fontSize: 10, fill: "#8b93a3" }} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name="Hoàn thành"
                      stroke="#F05922"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#F05922" }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="assigned"
                      name="Được giao mới"
                      stroke={assignedColor}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, fill: assignedColor }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-60 items-center justify-center text-xs text-muted">
                  Không có task được giao hoặc hoàn thành trong khoảng thời gian này
                </div>
              )}
            </div>

            {/* So sánh thành viên trong nhóm */}
            {isTeamView && data.memberDist.length > 0 && (
              <MemberTable
                rows={data.memberDist}
                selectedId={memberFilter}
                onSelect={(id) => {
                  setMemberFilter(id);
                  setProjectFilter("ALL");
                }}
              />
            )}

            {/* Phân bố */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Trạng thái */}
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold">Theo trạng thái</h2>
                  <span className="text-xs text-muted">({s.scopedTotal} task)</span>
                </div>
                <DistBars
                  rows={data.statusDist.map((d) => ({
                    key: d.status,
                    label: statusMeta(d.status).label,
                    color: statusMeta(d.status).color,
                    count: d.count,
                  }))}
                  gridColor={gridColor}
                />
              </div>

              {/* Độ ưu tiên */}
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold">Theo độ ưu tiên</h2>
                </div>
                <DistBars
                  rows={data.priorityDist.map((d) => ({
                    key: d.priority,
                    label: priorityMeta(d.priority).label,
                    color: priorityMeta(d.priority).color,
                    count: d.count,
                  }))}
                  gridColor={gridColor}
                />
              </div>

              {/* Dự án */}
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold">Theo dự án</h2>
                </div>
                {data.projectDist.length > 0 ? (
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {data.projectDist.map((p) => (
                      <div key={p.projectId}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium truncate pr-2">
                            <span className="text-muted">[{p.key}]</span> {p.name}
                          </span>
                          <span className="shrink-0 text-muted">
                            {p.done}/{p.total} xong
                          </span>
                        </div>
                        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2">
                          {p.done > 0 && (
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${(p.done / p.total) * 100}%` }}
                              title={`Hoàn thành: ${p.done}`}
                            />
                          )}
                          {p.open > 0 && (
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${(p.open / p.total) * 100}%` }}
                              title={`Chưa xong: ${p.open}`}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-3 pt-1 text-[11px] text-muted">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Hoàn thành
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-accent" /> Chưa xong
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-xs text-muted">Chưa có dữ liệu</div>
                )}
              </div>
            </div>

            {/* Danh sách quá hạn / sắp đến hạn */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TaskList
                title="Task quá hạn"
                icon={<AlertTriangle className="h-4 w-4 text-accent" />}
                tasks={data.overdueTasks}
                total={s.overdue}
                emptyText="Không có task nào quá hạn."
                danger
                currentProjectId={currentProjectId}
                showAssignee={isTeamView}
              />
              <TaskList
                title="Sắp đến hạn (7 ngày tới)"
                icon={<CalendarClock className="h-4 w-4 text-amber-600" />}
                tasks={data.upcomingTasks}
                total={s.upcoming}
                emptyText="Không có task nào đến hạn trong 7 ngày tới."
                currentProjectId={currentProjectId}
                showAssignee={isTeamView}
              />
            </div>

            <p className="text-[11px] text-muted">
              Ghi chú: “Được giao trong kỳ” tính theo ngày tạo task (đang được giao cho {isTeamView ? "thành viên" : "bạn"}); “Hoàn thành” theo thời
              điểm chuyển sang Hoàn thành. Phân bố trạng thái/ưu tiên/dự án gồm các task còn mở hoặc hoàn thành trong kỳ.
              Quá hạn & sắp đến hạn là số liệu tại thời điểm hiện tại.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  valueClass = "text-foreground",
  highlight = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: ReactNode;
  valueClass?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 ${
        highlight ? "border-accent/40 bg-accent-subtle" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-xl sm:text-2xl font-bold ${valueClass}`}>{value}</span>
        {hint && <span className="text-[11px] text-muted truncate">{hint}</span>}
      </div>
    </div>
  );
}

function MemberTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: MemberStat[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Hiệu suất theo thành viên</h2>
        </div>
        {selectedId !== "ALL" && (
          <button
            onClick={() => onSelect("ALL")}
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            Xem cả nhóm
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-4 py-2 font-medium">Thành viên</th>
              <th className="px-3 py-2 font-medium text-right">Được giao</th>
              <th className="px-3 py-2 font-medium text-right">Hoàn thành</th>
              <th className="px-3 py-2 font-medium text-right">Points</th>
              <th className="px-3 py-2 font-medium text-right">Đang làm</th>
              <th className="px-3 py-2 font-medium text-right">Đang mở</th>
              <th className="px-3 py-2 font-medium text-right">Quá hạn</th>
              <th className="px-4 py-2 font-medium text-right">Đúng hạn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr
                key={m.userId}
                onClick={() => onSelect(m.userId)}
                title="Xem chi tiết thành viên"
                className={`border-t border-line cursor-pointer transition-colors hover:bg-surface-2 ${
                  selectedId === m.userId ? "bg-accent-subtle" : ""
                }`}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: m.avatarColor }}
                    >
                      {m.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{m.name}</div>
                      {m.title && <div className="text-[10px] text-muted truncate">{m.title}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">{m.assigned}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-600">{m.completed}</td>
                <td className="px-3 py-2 text-right text-accent">{m.completedPoints}</td>
                <td className="px-3 py-2 text-right">{m.inProgress}</td>
                <td className="px-3 py-2 text-right">{m.open}</td>
                <td className={`px-3 py-2 text-right ${m.overdue > 0 ? "font-bold text-accent" : "text-muted"}`}>
                  {m.overdue}
                </td>
                <td className="px-4 py-2 text-right">{m.onTimeRate === null ? "—" : `${m.onTimeRate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DistBars({
  rows,
  gridColor,
}: {
  rows: { key: string; label: string; color: string; count: number }[];
  gridColor: string;
}) {
  if (rows.every((r) => r.count === 0)) {
    return <div className="flex h-[200px] items-center justify-center text-xs text-muted">Chưa có dữ liệu</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#8b93a3" }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#8b93a3" }} width={110} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(184, 179, 214, 0.12)" }} />
        <Bar dataKey="count" name="Số task" radius={[0, 4, 4, 0]} barSize={14}>
          {rows.map((r) => (
            <Cell key={r.key} fill={r.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TaskList({
  title,
  icon,
  tasks,
  total,
  emptyText,
  danger = false,
  currentProjectId,
  showAssignee = false,
}: {
  title: string;
  icon: ReactNode;
  tasks: TaskItem[];
  total: number;
  emptyText: string;
  danger?: boolean;
  currentProjectId: string;
  showAssignee?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        {total > 0 && <span className={danger ? "text-accent font-bold" : "text-foreground"}>{total}</span>}
      </h2>
      {tasks.length > 0 ? (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {tasks.map((t) => {
            const pr = priorityMeta(t.priority);
            return (
              <Link
                key={t.id}
                href={`/projects/${t.project.id || currentProjectId}/board?taskId=${t.id}`}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors hover:bg-surface-2 ${
                  danger ? "border-accent/40 bg-accent-subtle" : "border-line"
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-medium text-foreground truncate">
                    <span className="text-muted">
                      {t.project.key}-{t.number}
                    </span>{" "}
                    {t.title}
                  </div>
                  <div
                    className={`text-[11px] flex items-center gap-1.5 mt-0.5 ${danger ? "text-accent" : "text-muted"}`}
                  >
                    <Clock className="h-3 w-3" />
                    {showAssignee && t.assignee && `${t.assignee.name} • `}
                    Hạn: {fmtDue(t.dueDate)} • {statusMeta(t.status).label}
                    {t.storyPoints != null && ` • ${t.storyPoints} pts`}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold"
                  style={{ color: pr.color, backgroundColor: `${pr.color}22` }}
                >
                  {pr.label}
                </span>
              </Link>
            );
          })}
          {total > tasks.length && (
            <div className="text-center text-[11px] text-muted">… và {total - tasks.length} task khác</div>
          )}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
          {emptyText}
        </div>
      )}
    </div>
  );
}
