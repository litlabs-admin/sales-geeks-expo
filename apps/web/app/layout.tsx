import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SalesGeek Scotland Event App",
  description: "SalesGeek Scotland's event app for Scottish Growth Expo 2026"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
