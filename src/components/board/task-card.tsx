import { memo } from "react";
import { Calendar, MessageSquare, CheckSquare, AlertTriangle, Plus, Check } from "lucide-react";
import { format } from "date-fns";
import type { TaskDto, MemberDto, TaskProjectTag } from "@/lib/types";
import { priorityMeta, typeMeta } from "@/lib/constants";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { PriorityIcon } from "./priority-icon";
import { TypeIcon } from "./type-icon";
import { AssigneeQuickSelect } from "./assignee-quick-select";

function TaskCardComponent({
  task,
  overlay,
  members,
  onAssign,
  projectTag,
}: {
  task: TaskDto;
  overlay?: boolean;
  members?: MemberDto[];
  onAssign?: (taskId: string, userId: string | null) => void;
  // Chỉ truyền khi Board đang xem nhiều dự án — hiển thị mã dự án để phân biệt
  projectTag?: TaskProjectTag;
}) {
  const priority = priorityMeta(task.priority);
  const type = typeMeta(task.type);
  const subtasks = task.subtasks ?? [];
  const labels = task.labels ?? [];
  const doneSubtasks = subtasks.filter((s) => s.done).length;
  const isOverdue = task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();
  const subtaskProgress = subtasks.length > 0 ? (doneSubtasks / subtasks.length) * 100 : 0;
  const isTicket = task.title.startsWith("[TK-");

  // The avatar/assignee slot doubles as a quick-assign trigger when members + onAssign are wired in.
  const assigneeSlot = task.assignee ? (
    <Avatar className="h-[22px] w-[22px] border border-white/10 shadow-sm shrink-0" title={`Phụ trách: ${task.assignee.name}`}>
      <AvatarFallback color={task.assignee.avatarColor} className="text-[9px] font-bold">
        {initials(task.assignee.name)}
      </AvatarFallback>
    </Avatar>
  ) : (
    <div
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted/70"
      title="Chưa giao"
    >
      <Plus className="h-3 w-3" />
    </div>
  );

  return (
    <div
      className={`group relative rounded-xl border p-2.5 sm:p-3 transition-all duration-200 ${
        overlay
          ? "rotate-2 scale-[1.03] shadow-2xl shadow-black/80 ring-2 ring-accent border-accent bg-surface/95 backdrop-blur-xl cursor-grabbing z-50 overflow-hidden"
          : "border-line bg-surface/80 hover:bg-surface hover:border-line-strong hover:shadow-md shadow-sm cursor-grab active:cursor-grabbing active:scale-[0.98]"
      }`}
    >
      {/* Priority strip — the single strong color cue on the card */}
      <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ backgroundColor: priority.color }} />

      {/* Drag affordance — purely visual, the whole card stays draggable */}
      <div className="pointer-events-none absolute left-2.5 top-2.5 flex gap-0.5 opacity-0 group-hover:opacity-40 transition-opacity">
        <span className="h-[3px] w-[3px] rounded-full bg-muted" />
        <span className="h-[3px] w-[3px] rounded-full bg-muted" />
        <span className="h-[3px] w-[3px] rounded-full bg-muted" />
      </div>

      {/* Top row: Type + code & Priority */}
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <TypeIcon type={task.type} />
          {projectTag && (
            <span
              className="shrink-0 rounded px-1 py-0.2 text-[9.5px] font-mono font-bold bg-surface-3 border border-line-strong text-muted-light"
              title={`Dự án: ${projectTag.name}`}
            >
              {projectTag.key}
            </span>
          )}
          <span className="truncate text-[10.5px] font-bold text-muted">
            #{task.number} · {type.label}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {task.storyPoints != null && (
            <span className="rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted">
              {task.storyPoints} pts
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
            style={{ backgroundColor: `${priority.color}18`, color: priority.color, border: `1px solid ${priority.color}40` }}
          >
            <PriorityIcon priority={task.priority} className="h-2.5 w-2.5" />
            {priority.label}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-1.5 text-[12.5px] sm:text-[13px] font-semibold text-foreground leading-snug group-hover:text-accent transition-colors line-clamp-2">
        {task.title}
      </h3>

      {/* Labels — only rendered when labels exist */}
      {(isTicket || labels.length > 0) && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {isTicket && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-accent/20 text-accent border border-accent/30">
              Ticket KH
            </span>
          )}
          {labels.slice(0, 3).map(({ label }) => (
            <span
              key={label.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight"
              style={{ backgroundColor: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40` }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: due date, comments, checklist chips + assignee — compact and tight */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-line/40">
        <div className="flex flex-wrap items-center gap-1">
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${
                isOverdue
                  ? "bg-accent-subtle text-accent border border-accent/30 font-bold"
                  : "bg-surface-2 text-muted border border-line"
              }`}
            >
              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              {isOverdue ? "Quá hạn " : ""}
              {format(new Date(task.dueDate), "dd/MM")}
            </span>
          )}

          {task._count.comments > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-[10.5px] font-semibold text-muted">
              <MessageSquare className="h-3 w-3" />
              {task._count.comments}
            </span>
          )}

          {subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-[10.5px] font-semibold text-muted">
              <CheckSquare className="h-3 w-3" />
              {doneSubtasks}/{subtasks.length}
            </span>
          )}
        </div>

        {members && onAssign ? (
          <AssigneeQuickSelect
            taskId={task.id}
            currentAssigneeId={task.assigneeId ?? null}
            currentAssignee={task.assignee ?? null}
            members={members}
            onAssign={onAssign}
          />
        ) : (
          assigneeSlot
        )}
      </div>

      {/* Ambient checklist progress rail along the bottom edge */}
      {subtasks.length > 0 && (
        <div className="absolute left-0 right-0 bottom-0 h-[2.5px] bg-surface-2">
          <div
            className={`h-full transition-all duration-300 ${subtaskProgress === 100 ? "bg-emerald-500" : "bg-accent"}`}
            style={{ width: `${subtaskProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent, (prev, next) => {
  return (
    prev.overlay === next.overlay &&
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.status === next.task.status &&
    prev.task.priority === next.task.priority &&
    prev.task.position === next.task.position &&
    prev.task.dueDate === next.task.dueDate &&
    prev.task.storyPoints === next.task.storyPoints &&
    prev.task.assigneeId === next.task.assigneeId &&
    prev.task._count?.comments === next.task._count?.comments &&
    prev.task.subtasks?.length === next.task.subtasks?.length &&
    prev.task.labels?.length === next.task.labels?.length &&
    prev.members === next.members &&
    prev.onAssign === next.onAssign &&
    prev.projectTag === next.projectTag
  );
});
