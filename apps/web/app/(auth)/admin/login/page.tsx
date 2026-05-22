import { Suspense } from "react";
import AdminLoginClient from "./admin-login-client";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-medium text-brand">SalesGeek Scotland</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">Admin sign in</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Operations email and password. New accounts cannot be created from this screen.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Preparing sign-in...</p>}>
        <AdminLoginClient />
      </Suspense>
    </main>
  );
}
