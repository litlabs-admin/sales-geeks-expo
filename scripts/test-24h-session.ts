import { anonymousSession, closeSql } from "./lib/phase2";

const session = await anonymousSession();

if (!session.refreshToken) {
  throw new Error("Anonymous session did not include a refresh token");
}

if (!session.expiresIn || session.expiresIn > 3600) {
  throw new Error("Access token expiry should be configured around 3600 seconds");
}

await closeSql();
console.log("24h session configuration smoke passed.");
