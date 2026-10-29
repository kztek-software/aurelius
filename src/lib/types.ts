export type UserLite = {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
  title?: string | null;
  role?: string;
  team?: { id: string; name: string; code?: string; color: string } | null;
};

export type LabelDto = {
  id: string;
  name: string;
  color: string;
};

export type SubtaskDto = {
  id: string;
  title: string;
  done: boolean;
};

export type AttachmentDto = {
  id: string;
  projectId?: string | null;
  taskId?: string | null;
  ticketId?: string | null;
  uploaderId?: string | null;
  fileName: string;
  fileUrl: string;
  fileType: "image" | "video" | "document" | "other" | string;
  fileSize?: number | null;
  mimeType?: string | null;
  createdAt: string;
  uploader?: UserLite | null;
};

export type TaskDto = {
  id: string;
  projectId: string;
  sprintId: string | null;
  number: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  storyPoints: number | null;
  position: number;
  assigneeId: string | null;
  creatorId: string;
  dueDate: string | null;
  notionUrl?: string | null;
  notionPageId?: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserLite | null;
  labels: { label: LabelDto }[];
  subtasks: SubtaskDto[];
  attachments?: AttachmentDto[];
  customerTicket?: {
    id: string;
    trackingCode: string;
    customerName: string;
    customerEmail: string;
  } | null;
  _count: { comments: number; attachments?: number };
};

export type SprintDto = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

export type ProjectDto = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status?: string; // PLANNING | IN_PROGRESS | ON_HOLD | COMPLETED | CANCELLED
  ownerId?: string;
  owner?: UserLite;
  createdAt?: string;
  updatedAt?: string;
  attachments?: AttachmentDto[];
  _count?: {
    tasks?: number;
    members?: number;
    customerTickets?: number;
    attachments?: number;
  };
};

export type MemberDto = {
  id: string;
  role: string;
  user: UserLite;
};

export type ProjectDashboardData = {
  project: ProjectDto & {
    members: {
      id: string;
      role: string;
      user: UserLite & {
        team?: { id: string; name: string; code: string; color: string } | null;
      };
    }[];
  };
  currentRole: string;
  summary: {
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    inReviewTasks: number;
    todoTasks: number;
    backlogTasks: number;
    overdueTasks: number;
    urgentTasks: number;
    completionRate: number;
    totalStoryPoints: number;
    doneStoryPoints: number;
    remainingStoryPoints: number;
    pointsCompletionRate: number;
  };
  activeSprint: {
    id: string;
    name: string;
    goal: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    daysRemaining: number | null;
    totalTasks: number;
    doneTasks: number;
    totalPoints: number;
    donePoints: number;
  } | null;
  statusDistribution: { status: string; label: string; count: number; color: string }[];
  priorityDistribution: { priority: string; label: string; count: number; color: string }[];
  typeDistribution: { type: string; label: string; count: number; color: string }[];
  memberWorkloads: {
    userId: string;
    name: string;
    avatarColor: string;
    title: string | null;
    role: string;
    teamName: string | null;
    teamColor: string | null;
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    storyPoints: number;
    completionRate: number;
  }[];
  teamBreakdown: {
    id: string;
    name: string;
    code: string;
    color: string;
    memberCount: number;
    totalTasks: number;
    doneTasks: number;
  }[];
  urgentAndOverdueTasks: {
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string;
    type: string;
    dueDate: string | null;
    isOverdue: boolean;
    assignee: UserLite | null;
    storyPoints: number | null;
  }[];
  recentActivities: {
    id: string;
    action: string;
    detail: string | null;
    createdAt: string;
    actor: UserLite;
    task: {
      id: string;
      number: number;
      title: string;
    };
  }[];
  ticketStats: {
    total: number;
    open: number;
    triaged: number;
    inProgress: number;
    resolved: number;
    closed: number;
    resolutionRate: number;
  };
};

export type CommentDto = {
  id: string;
  body: string;
  createdAt: string;
  author: UserLite;
};

export type ActivityDto = {
  id: string;
  action?: string;
  detail?: string | null;
  content?: string;
  createdAt: string;
  actor?: UserLite;
  user?: UserLite;
};

export type TicketCommentDto = {
  id: string;
  ticketId: string;
  authorName: string;
  authorEmail?: string | null;
  isStaff: boolean;
  isInternalOnly: boolean;
  message: string;
  createdAt: string;
};

export type CustomerTicketDto = {
  id: string;
  trackingCode: string;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
  title: string;
  description: string;
  type: string; // BUG | SUPPORT | INQUIRY | FEATURE_REQ
  status: string; // OPEN | TRIAGED | IN_PROGRESS | RESOLVED | CLOSED | REJECTED
  priority: string; // LOW | MEDIUM | HIGH | URGENT
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerCompany?: string | null;
  environment?: string | null;
  convertedTaskId?: string | null;
  convertedTask?: {
    id: string;
    number: number;
    title: string;
    status: string;
    type: string;
  } | null;
  internalNotes?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: TicketCommentDto[];
  attachments?: AttachmentDto[];
  _count?: { comments: number };
};

export type BoardData = {
  project: ProjectDto;
  tasks: TaskDto[];
  sprints: SprintDto[];
  labels: LabelDto[];
  members: MemberDto[];
  currentRole?: string;
};

// Board Công Việc đa dự án (GET /api/board): dữ liệu phẳng, mỗi bản ghi mang projectId
export type BoardProjectDto = ProjectDto & { currentRole: string };

export type MultiBoardData = {
  projects: BoardProjectDto[];
  tasks: TaskDto[];
  sprints: (SprintDto & { projectId: string })[];
  labels: (LabelDto & { projectId: string })[];
  members: (MemberDto & { projectId: string })[];
};

// Nhãn dự án hiển thị trên thẻ task khi Board xem nhiều dự án
export type TaskProjectTag = { key: string; name: string };
