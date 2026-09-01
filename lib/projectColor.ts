import { defaultProjectColor, getProjectMeta } from "@/lib/projectMeta";

export function colorForProject(id: string): string {
  return getProjectMeta(id)?.color || defaultProjectColor(id);
}
