import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskDto, MemberDto, TaskProjectTag } from "@/lib/types";
import { TaskCard } from "./task-card";

function SortableTaskCardComponent({
  task,
  onClick,
  members,
  onAssign,
  projectTag,
  dragDisabled,
}: {
  task: TaskDto;
  onClick: () => void;
  members?: MemberDto[];
  onAssign?: (taskId: string, userId: string | null) => void;
  projectTag?: TaskProjectTag;
  // Khoá kéo thả riêng thẻ này (vd. user chỉ là Viewer ở dự án của task)
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition || "transform 220ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease",
    touchAction: "manipulation",
    willChange: transform ? "transform, opacity" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onClick();
      }}
      className={`cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
        isDragging
          ? "opacity-30 scale-[0.98] border-2 border-dashed border-accent/60 rounded-xl bg-accent/10"
          : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <TaskCard task={task} members={members} onAssign={onAssign} projectTag={projectTag} />
    </div>
  );
}

export const SortableTaskCard = memo(SortableTaskCardComponent, (prev, next) => {
  return (
    prev.task === next.task &&
    prev.onClick === next.onClick &&
    prev.members === next.members &&
    prev.onAssign === next.onAssign &&
    prev.projectTag === next.projectTag &&
    prev.dragDisabled === next.dragDisabled
  );
});
