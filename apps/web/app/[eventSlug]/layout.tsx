import { headers } from "next/headers";

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const headerStore = headers();
  const primary = headerStore.get("x-brand-primary") ?? "18 110 130";
  const ink = headerStore.get("x-brand-ink") ?? "18 23 28";

  return (
    <div>
      <style>{`:root { --brand-primary: ${primary}; --brand-ink: ${ink}; }`}</style>
      {children}
    </div>
  );
}
