/**
 * Link tới Board Công Việc (/board) với dự án được chọn sẵn.
 * `extra`: query bổ sung, vd. { sprintId } hoặc { taskId }.
 */
export function boardHref(projectId: string, extra?: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams({ projects: projectId });
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  return `/board?${params.toString()}`;
}
