import { Suspense } from "react";
import VerifyClient from "./verify-client";

export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-medium text-brand">SalesGeek Scotland</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">Secure sign in</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-slate-700">Signing you in...</p>}>
        <VerifyClient />
      </Suspense>
    </main>
  );
}
