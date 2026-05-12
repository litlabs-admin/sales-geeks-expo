export type EventScopedRecord = {
  eventId: string;
};

export function scopeToEvent<T extends EventScopedRecord>(records: T[], eventId: string) {
  return records.filter((record) => record.eventId === eventId);
}
