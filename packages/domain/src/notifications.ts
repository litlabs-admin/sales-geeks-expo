export type NotificationAudience = {
  type: "all" | "checked_in" | "verified";
};

export function parseAudience(value: unknown): NotificationAudience {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value.type === "all" || value.type === "checked_in" || value.type === "verified")
  ) {
    return { type: value.type };
  }

  return { type: "all" };
}

export function isDue(scheduledAt: string | null, now = new Date()) {
  return !scheduledAt || new Date(scheduledAt).getTime() <= now.getTime();
}
