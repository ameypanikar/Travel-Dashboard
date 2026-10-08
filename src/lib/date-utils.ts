// Robust date parsing for the dashboard.
// API returns mixed formats: ISO ("2026-05-19T07:25"), dd/mm/yyyy, "7:25 am", "22:05:00".

export function parseAnyDate(value?: string | null): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  // ISO-like
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/\\-](\d{1,2})[/\\-](\d{4})/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = Number(m[3]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isWithinRange(day: Date, start: Date, end: Date): boolean {
  const t = startOfDay(day).getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value?: string | null): string {
  if (!value) return "";
  const s = String(value).trim();
  // If like "22:05:00", drop seconds; if "7:25 am", keep as is.
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return s;
}

// Returns "Today", "Tomorrow", or the original DD/MM/YYYY string unchanged otherwise.
// Used for the small date label shown above upcoming cards in list views.
export function getRelativeDateLabel(ddmmyyyy?: string): string {
  if (!ddmmyyyy) return "";
  const d = parseAnyDate(ddmmyyyy);
  if (!d) return ddmmyyyy;

  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return ddmmyyyy;
}