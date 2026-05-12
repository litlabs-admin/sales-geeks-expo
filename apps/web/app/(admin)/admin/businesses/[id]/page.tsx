export default function AdminBusinessEditPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Business</h1>
      <dl className="mt-6 grid gap-3 text-sm">
        <div>
          <dt className="font-medium">ID</dt>
          <dd className="break-words text-slate-600">{params.id}</dd>
        </div>
        <div>
          <dt className="font-medium">QR rule</dt>
          <dd className="text-slate-600">The business QR is generated once and cannot be regenerated.</dd>
        </div>
      </dl>
    </main>
  );
}
