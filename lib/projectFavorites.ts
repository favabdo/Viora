const FAVORITES_KEY = "viora-favorite-projects";

export function readFavoriteProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isFavoriteProject(projectId: string): boolean {
  return readFavoriteProjectIds().includes(projectId);
}

export function toggleFavoriteProject(projectId: string): boolean {
  const next = readFavoriteProjectIds();
  const exists = next.includes(projectId);
  const updated = exists ? next.filter((id) => id !== projectId) : [...next, projectId];
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return !exists;
}
