"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const YLW = "#FFD000";
const BLK = "#17191d";

const TABS = [
  {
    href: "home",
    label: "Home",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? YLW : "#8b8fa8"} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "agenda",
    label: "Agenda",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? YLW : "#8b8fa8"} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    href: "geeks",
    label: "Geeks",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? YLW : "#8b8fa8"} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "rewards",
    label: "Rewards",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? YLW : "#8b8fa8"} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
  },
  {
    href: "leaderboard",
    label: "Board",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? YLW : "#8b8fa8"} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" x2="18" y1="20" y2="10"/>
        <line x1="12" x2="12" y1="20" y2="4"/>
        <line x1="6" x2="6" y1="20" y2="14"/>
      </svg>
    ),
  },
];

export default function AttendeeNav({ slug, eventId }: { slug: string; eventId: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Attendee navigation"
      style={{
        position: "fixed", insetInline: 0, bottom: 0, zIndex: 40,
        background: "rgba(23,25,29,0.97)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid #222",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{
        maxWidth: 576, margin: "0 auto",
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
        paddingBottom: "max(env(safe-area-inset-bottom,0px), 8px)",
      }}>
        {TABS.map((tab) => {
          const active = pathname.startsWith(`/${slug}/${tab.href}`);
          return (
            <Link
              key={tab.href}
              href={`/${slug}/${tab.href}`}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4,
                padding: "10px 4px",
                textAlign: "center",
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.04em",
                color: active ? YLW : "#8b8fa8",
                textDecoration: "none",
                transition: "color 150ms, transform 100ms",
                WebkitTapHighlightColor: "transparent",
                position: "relative",
              }}
            >
              {active && (
                <span style={{
                  position: "absolute", top: 0, left: "50%",
                  transform: "translateX(-50%)",
                  width: 28, height: 2, background: YLW,
                  borderRadius: "0 0 2px 2px",
                }} />
              )}
              {tab.icon(active)}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
