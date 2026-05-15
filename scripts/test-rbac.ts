import { config } from "dotenv";
import { SignJWT } from "jose";

config({ path: ".env.local" });

const backendUrl = process.env.BACKEND_ADMIN_TEST_URL ?? "http://localhost:8081/test/admin-only";
const secret = process.env.SUPABASE_JWT_SECRET;

if (!secret) {
  throw new Error("SUPABASE_JWT_SECRET is required");
}

async function token(role: "staff" | "admin") {
  return new SignJWT({ app_role: role, email: `${role}@example.com` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(`00000000-0000-0000-0000-00000000000${role === "admin" ? "1" : "2"}`)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}

async function call(role: "staff" | "admin") {
  return fetch(backendUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await token(role)}`
    }
  });
}

const staff = await call("staff");
if (staff.status !== 403) {
  throw new Error(`Expected staff request to return 403, saw ${staff.status}`);
}

const admin = await call("admin");
if (admin.status !== 200) {
  throw new Error(`Expected admin request to return 200, saw ${admin.status}`);
}

console.log("RBAC checks passed.");
