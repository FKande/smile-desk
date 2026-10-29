/* Times on the queue read relative ("3 min ago") with the absolute time one
 * hover away, in the browser's locale and time zone (the office's own). */

export function relativeTime(iso: string, now: number): string {
  const seconds = Math.round((now - Date.parse(iso)) / 1000);
  // Under 45 s, or a timestamp slightly ahead of this clock.
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
