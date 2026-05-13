import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./supabase-server";
import { backendBaseUrl } from "./config";

export type AppRole = "attendee" | "staff" | "admin";

type MeResponse = {
  actor: {
    id: string;
    email?: string;
    role: AppRole;
  };
};

export async function currentSessionActor() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) return null;

  const response = await fetch(`${backendBaseUrl()}/me`, {
    headers: {
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) return null;

  return ((await response.json()) as MeResponse).actor;
}

export async function requireRole(role: AppRole) {
  const actor = await currentSessionActor();

  if (!actor) {
    redirect(role === "admin" ? "/admin/login" : "/staff/login");
  }

  if (role === "admin" && actor.role !== "admin") {
    redirect("/access-denied?required=admin");
  }

  if (role === "staff" && actor.role !== "staff" && actor.role !== "admin") {
    redirect("/access-denied?required=staff");
  }

  return actor;
}
