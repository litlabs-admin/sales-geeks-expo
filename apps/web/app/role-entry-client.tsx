"use client";

import { FormEvent, useState } from "react";

type RoleMode = "attendee" | "staff" | "admin";

type RoleOption = {
  mode: RoleMode;
  title: string;
  description: string;
  email: string;
  next: string;
  eventSlug?: string;
  buttonLabel: string;
};

type RoleEntryClientProps = {
  options: RoleOption[];
};

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function RoleEntryClient({ options }: RoleEntryClientProps) {
  const [emails, setEmails] = useState(() =>
    Object.fromEntries(options.map((option) => [option.mode, option.email]))
  );
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [busyMode, setBusyMode] = useState<RoleMode | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>, option: RoleOption) {
    event.preventDefault();
    const email = normalizedEmail(emails[option.mode] ?? "");

    setBusyMode(option.mode);
    setStatuses((current) => ({
      ...current,
      [option.mode]: "Preparing secure access..."
    }));

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email,
          mode: option.mode,
          eventSlug: option.eventSlug,
          next: option.next
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        dev_verify_url?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not start sign in.");
      }

      if (payload.dev_verify_url) {
        setStatuses((current) => ({
          ...current,
          [option.mode]: payload.message ?? "Opening test account..."
        }));
        window.location.assign(payload.dev_verify_url);
        return;
      }

      setStatuses((current) => ({
        ...current,
        [option.mode]: payload.message ?? "Check your email for the secure sign-in link."
      }));
    } catch (error) {
      setStatuses((current) => ({
        ...current,
        [option.mode]: error instanceof Error ? error.message : "Could not start sign in."
      }));
      setBusyMode(null);
    }
  }

  return (
    <div className="mt-8 grid gap-4">
      {options.map((option) => (
        <form
          className="grid gap-3 rounded-md border border-slate-200 bg-white p-4"
          key={option.mode}
          onSubmit={(event) => signIn(event, option)}
        >
          <div>
            <h2 className="text-base font-semibold text-ink">{option.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{option.description}</p>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input
              autoComplete="email"
              className="rounded-md border border-slate-300 px-3 py-2 text-base"
              onChange={(event) =>
                setEmails((current) => ({
                  ...current,
                  [option.mode]: event.target.value
                }))
              }
              required
              type="email"
              value={emails[option.mode] ?? ""}
            />
          </label>
          <button
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busyMode === option.mode}
            type="submit"
          >
            {option.buttonLabel}
          </button>
          {statuses[option.mode] ? (
            <p className="text-sm text-slate-600">{statuses[option.mode]}</p>
          ) : null}
        </form>
      ))}
    </div>
  );
}
