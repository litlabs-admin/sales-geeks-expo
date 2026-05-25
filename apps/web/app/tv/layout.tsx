export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TvLayout({ children }: { children: React.ReactNode }) {
  // Light theme — white grounding with yellow + ink accents. Looks crisp on
  // modern stadium LED TVs and avoids the "black hole" effect of dark portals
  // when lights drop during keynotes.
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#FFFFFF",
      color: "#0A0E14",
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}
