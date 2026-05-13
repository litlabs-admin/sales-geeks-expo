import Link from "next/link";

export default function AccessDeniedPage({
  searchParams
}: {
  searchParams: { required?: string };
}) {
  const requiredRole = searchParams.required === "admin" ? "admin" : "staff";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-medium text-brand">SalesGeek Scotland</p>
      <h1 className="mt-3 text-3xl font-semibold text-ink">Access denied</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        This area requires a {requiredRole} account. Sign in with the correct event operations email.
      </p>
      <div className="mt-6 flex gap-3">
        <Link className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" href={`/${requiredRole}/login`}>
          Sign in
        </Link>
        <Link className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="/">
          Event app
        </Link>
      </div>
    </main>
  );
}
