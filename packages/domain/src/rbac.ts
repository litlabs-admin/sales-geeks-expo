export type Role = "attendee" | "staff" | "admin";

export type Actor = {
  id: string;
  email?: string;
  role: Role;
};

const roleRank: Record<Role, number> = {
  attendee: 0,
  staff: 1,
  admin: 2
};

export function hasRequiredRole(role: Role, allowedRoles: Role[]) {
  return allowedRoles.some((allowedRole) => roleRank[role] >= roleRank[allowedRole]);
}

export function canDoAction(actor: Actor, action: string) {
  if (actor.role === "admin") return true;
  if (actor.role === "staff") return action.startsWith("staff:");
  return action.startsWith("attendee:");
}
