export function archiveAccessClosesAt(eventEndsAt: string | Date) {
  const endsAt = typeof eventEndsAt === "string" ? new Date(eventEndsAt) : eventEndsAt;
  return new Date(endsAt.getTime() + 10 * 24 * 60 * 60 * 1000);
}

export function isArchiveAccessOpen(input: {
  eventEndsAt: string | Date;
  now?: Date;
  overrideUntil?: string | Date | null;
}) {
  const now = input.now ?? new Date();
  const overrideUntil =
    input.overrideUntil == null
      ? null
      : typeof input.overrideUntil === "string"
        ? new Date(input.overrideUntil)
        : input.overrideUntil;

  if (overrideUntil && overrideUntil.getTime() >= now.getTime()) {
    return true;
  }

  return archiveAccessClosesAt(input.eventEndsAt).getTime() >= now.getTime();
}
