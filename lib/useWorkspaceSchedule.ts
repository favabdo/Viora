"use client";

import { useEffect, useState } from "react";
import { supabase, Project, Task } from "@/lib/supabase";
import { hydrateProjectMetas } from "@/lib/projectMeta";
import { normalizeTask } from "@/lib/taskShape";

export function useWorkspaceSchedule() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: projectRows, error } = await supabase.from("projects").select("*").order("created_at", { ascending: true });
      if (cancelled) return;
      if (error || !projectRows) {
        setProjects([]);
        setTasks([]);
        setLoading(false);
        return;
      }
      const list = projectRows as Project[];
      setProjects(list);
      await hydrateProjectMetas(list.map((p) => p.id));
      if (cancelled) return;
      if (list.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }
      const { data: taskRows } = await supabase
        .from("tasks")
        .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
        .in(
          "project_id",
          list.map((p) => p.id)
        );
      if (cancelled) return;
      setTasks((taskRows || []).map(normalizeTask));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { projects, tasks, loading };
}
