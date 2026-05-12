import { config } from "dotenv";

config({ path: ".env.local" });

const rawWebUrl = process.env.WEB_URL ?? "http://localhost:3000/health";
const webUrl = rawWebUrl.endsWith("/health") ? rawWebUrl : `${rawWebUrl.replace(/\/$/, "")}/health`;
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080/health";

async function check(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

await check(webUrl);
const backend = await check(backendUrl);

if (!backend.db_reachable) {
  throw new Error("Backend health check reported db_reachable=false");
}

console.log("Smoke checks passed.");
