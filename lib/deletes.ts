import { supabase } from "./supabase";

function isMissingRpc(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST202" || /could not find the function/i.test(error.message || "");
}

export async function deleteOwnedTask(taskId: string): Promise<string | null> {
  const { error } = await supabase.rpc("delete_task", { p_task_id: taskId });
  if (!error) return null;
  if (isMissingRpc(error)) {
    const { error: fallback } = await supabase.from("tasks").delete().eq("id", taskId);
    return fallback?.message || null;
  }
  return error.message || null;
}

export async function deleteOwnedProject(projectId: string): Promise<string | null> {
  const { error } = await supabase.rpc("delete_project", { p_project_id: projectId });
  if (!error) return null;
  if (isMissingRpc(error)) {
    const { error: fallback } = await supabase.from("projects").delete().eq("id", projectId);
    return fallback?.message || null;
  }
  return error.message || null;
}

