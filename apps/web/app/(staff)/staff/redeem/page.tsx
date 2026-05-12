export default function StaffRedeemPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">Staff Redemption</h1>
      <form className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Attendee ID</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="attendee_id" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Reward ID</span>
          <input className="rounded-md border border-slate-300 px-3 py-2" name="reward_id" />
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" type="button">
          Redeem
        </button>
      </form>
    </main>
  );
}
