import { notFound } from "next/navigation";
import { getTvEvent } from "@/lib/tv-data";
import { MAIN_PROMO_YT_ID } from "./_catalog";
import VideoPortal from "./_video-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Main SalesGeek Hampden promo. Override via NEXT_PUBLIC_TV_VIDEO_YOUTUBE_ID
// without redeploying.
const YT_ID = process.env.NEXT_PUBLIC_TV_VIDEO_YOUTUBE_ID ?? MAIN_PROMO_YT_ID;

export default async function TvVideoPage({ searchParams }: { searchParams: { event?: string } }) {
  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  return <VideoPortal ytId={YT_ID} badge="FROM IMPRESSIONS TO INFLUENCE" />;
}
