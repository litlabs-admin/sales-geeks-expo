export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TvLayout({ children }: { children: React.ReactNode }) {
  // No chrome, no nav — TV portals are full-screen. Dark grounding because
  // bright stadium lighting washes out white backgrounds; yellow + white on
  // near-black reads from 10m away.
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0A0E14",
      color: "#FFFFFF",
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}
