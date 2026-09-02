import { supabase, type BoardColumn } from "./supabase";

export function isTodoColumnName(name: string) {
  const n = name.trim().toLowerCase();
  return n === "to do" || n === "todo" || n === "to-do" || n === "للتنفيذ";
}

export function findTodoColumn<T extends { name: string; is_done_column?: boolean }>(columns: T[]): T | undefined {
  return columns.find((col) => isTodoColumnName(col.name)) || columns.find((col) => !col.is_done_column);
}

export async function ensureTodoColumn(projectId: string): Promise<Pick<BoardColumn, "id" | "name"> | null> {
  const { data } = await supabase
    .from("board_columns")
    .select("id, name, position, is_done_column")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  const columns = (data || []) as Pick<BoardColumn, "id" | "name" | "position" | "is_done_column">[];
  const existing = findTodoColumn(columns);
  if (existing) return existing;
  const position = columns.length > 0 ? Math.max(...columns.map((col) => col.position)) + 1 : 1;
  const { data: created, error } = await supabase
    .from("board_columns")
    .insert({
      project_id: projectId,
      name: "To Do",
      color: "#3B82F6",
      position,
      is_done_column: false,
    })
    .select("id, name")
    .single();
  if (error || !created) return null;
  return created as Pick<BoardColumn, "id" | "name">;
}
