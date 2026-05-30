import { Suspense } from "react";
import LoginClient from "@/lib/login-client";

export default function StaffLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-medium text-brand">SalesGeek Scotland</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">Staff sign in</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Use a staff operations email. Admin accounts can also enter staff tools.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Preparing sign-in...</p>}>
        <LoginClient defaultNext="/staff/qr" mode="staff" />
      </Suspense>
    </main>
  );
}
