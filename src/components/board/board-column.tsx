"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, ListTodo } from "lucide-react";
import type { TaskDto, MemberDto, TaskProjectTag } from "@/lib/types";
import { SortableTaskCard } from "./sortable-task-card";

type Status = { id: string; label: string; color: string };

export function BoardColumn({
  status,
  tasks,
  onAddTask,
  onTaskClick,
  members,
  onAssign,
  membersByProject,
  projectTags,
  readOnlyProjectIds,
}: {
  status: Status;
  tasks: TaskDto[];
  onAddTask: () => void;
  onTaskClick: (id: string) => void;
  members?: MemberDto[];
  onAssign?: (taskId: string, userId: string | null) => void;
  // Board đa dự án: thành viên / nhãn dự án / quyền chỉ xem tra theo projectId của từng task
  membersByProject?: Record<string, MemberDto[]>;
  projectTags?: Record<string, TaskProjectTag>;
  readOnlyProjectIds?: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const points = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);

  return (
    <div
      id={`board-col-${status.id}`}
      className="flex w-[84vw] sm:w-auto sm:flex-1 sm:min-w-[220px] md:min-w-[240px] shrink-0 sm:shrink-0 lg:shrink flex-col h-full max-h-full rounded-2xl border border-line bg-surface/40 p-2 sm:p-2 backdrop-blur-sm shadow-sm transition-all overflow-hidden"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1.5 py-1 mb-1 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: status.color, boxShadow: `0 0 8px ${status.color}80` }}
          />
          <span className="text-[11.5px] sm:text-xs font-bold uppercase tracking-wider text-foreground">
            {status.label}
          </span>
          <span className="rounded-full bg-surface-2 border border-line px-1.5 py-0.2 text-[9.5px] sm:text-[10px] font-bold text-muted">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {points > 0 && (
            <span className="rounded-md bg-surface-2/80 px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-mono font-semibold text-muted border border-line">
              {points} pts
            </span>
          )}
          <button
            onClick={onAddTask}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer transition-colors"
            title="Thêm task mới vào cột này"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Task List / Drop Zone */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 min-h-0 space-y-1.5 sm:space-y-2 overflow-y-auto pr-1 rounded-xl transition-all duration-200 ${
            isOver
              ? "bg-accent/10 ring-2 ring-accent/60 border-2 border-dashed border-accent/60 scale-[1.01]"
              : ""
          }`}
        >
          {tasks.map((task) => {
            const readOnly = readOnlyProjectIds?.has(task.projectId) ?? false;
            return (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                members={membersByProject?.[task.projectId] ?? members}
                onAssign={readOnly ? undefined : onAssign}
                projectTag={projectTags?.[task.projectId]}
                dragDisabled={readOnly}
              />
            );
          })}

          {tasks.length === 0 && (
            <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-line/80 p-3 text-center text-xs text-muted/60 space-y-1">
              <ListTodo className="h-4.5 w-4.5 text-muted/40 mb-0.5" />
              <span className="font-semibold text-muted text-[11.5px]">Chưa có công việc</span>
              <span className="text-[9.5px] text-muted/70">Kéo thả thẻ vào đây hoặc bấm + để tạo mới</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
