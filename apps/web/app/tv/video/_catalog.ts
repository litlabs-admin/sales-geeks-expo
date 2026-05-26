/* Single source of truth for every YouTube video that has a TV portal.
   The TV index lists these as portal tiles; /tv/video/[id] validates the
   ytId against this list before rendering (avoids letting any random
   YouTube id be embedded on the salesgeek domain).                       */

export type EventVideo = {
  ytId: string;
  label: string;
  badge: string;
};

export const MAIN_PROMO_YT_ID = "hxlD6wuVIhs";

export const EVENT_VIDEOS: EventVideo[] = [
  { ytId: "Hkm_2Ugw3E8", label: "Event Video 1",  badge: "EVENT VIDEO 1" },
  { ytId: "BmfBz6KXtRA", label: "Event Video 2",  badge: "EVENT VIDEO 2" },
  { ytId: "Yl4ATk46JVg", label: "Event Video 3",  badge: "EVENT VIDEO 3" },
  { ytId: "tGB9mHQWzwU", label: "Event Video 4",  badge: "EVENT VIDEO 4" },
  { ytId: "AcwEhYTVOco", label: "Event Video 5",  badge: "EVENT VIDEO 5" },
  { ytId: "I0ccqhvPuDQ", label: "Event Video 6",  badge: "EVENT VIDEO 6" },
  { ytId: "KPKdi6hnrmA", label: "Event Video 7",  badge: "EVENT VIDEO 7" },
  { ytId: "hTdEbdcQcIs", label: "Event Video 8",  badge: "EVENT VIDEO 8" },
  { ytId: "eIa8t0jfOZ8", label: "Event Video 9",  badge: "EVENT VIDEO 9" },
  { ytId: "Y-vzzL5JykQ", label: "Event Video 10", badge: "EVENT VIDEO 10" },
  { ytId: "9K9xu7DkL8Q", label: "Event Video 11", badge: "EVENT VIDEO 11" },
  { ytId: "LcshXOCxt1s", label: "Event Video 12", badge: "EVENT VIDEO 12" },
];

export function findVideo(ytId: string): EventVideo | null {
  return EVENT_VIDEOS.find((v) => v.ytId === ytId) ?? null;
}
