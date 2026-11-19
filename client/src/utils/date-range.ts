export type DateRangeKey = "all" | "today" | "week" | "month" | "year";

export function rangeStart(key: DateRangeKey): Date | null {
  const now = new Date();
  if (key === "all") return null;
  if (key === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (key === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (key === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

export function isWithinRange(
  date: string | Date | undefined | null,
  key: DateRangeKey,
): boolean {
  if (!date) return key === "all";
  const start = rangeStart(key);
  if (!start) return true;
  const d = typeof date === "string" ? new Date(date) : date;
  return !Number.isNaN(d.getTime()) && d >= start;
}
