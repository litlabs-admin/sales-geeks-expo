import { config } from "dotenv";

config({ path: ".env.local" });

const webUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const response = await fetch(`${webUrl}/does-not-exist/home`);

if (response.status !== 404) {
  throw new Error(`Expected bad slug to return 404, saw ${response.status}`);
}

console.log("Slug 404 checks passed.");
