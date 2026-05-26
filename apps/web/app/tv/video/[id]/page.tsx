import { notFound } from "next/navigation";
import { getTvEvent } from "@/lib/tv-data";
import { findVideo } from "../_catalog";
import VideoPortal from "../_video-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TvVideoByIdPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { event?: string };
}) {
  // Only embed video ids we explicitly catalogue, so this route can't be
  // abused to embed arbitrary YouTube content on the salesgeek domain.
  const video = findVideo(params.id);
  if (!video) notFound();

  const slug = searchParams.event ?? "sge-2026";
  const event = await getTvEvent(slug);
  if (!event) notFound();

  return <VideoPortal ytId={video.ytId} badge={video.badge} />;
}
