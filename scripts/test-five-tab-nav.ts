const webUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const response = await fetch(`${webUrl}/sge-2026/home`);

if (!response.ok) {
  throw new Error(`Expected home page 200, saw ${response.status}`);
}

const html = await response.text();
const labels = ["Home", "Agenda", "Geeks", "Rewards", "Leaderboard"];

for (const label of labels) {
  if (!html.includes(`>${label}</a>`)) {
    throw new Error(`Missing tab label ${label}`);
  }
}

const navMatches = html.match(/href="\/sge-2026\/(home|agenda|geeks|rewards|leaderboard)"/g) ?? [];
if (navMatches.length !== 5) {
  throw new Error(`Expected exactly five tab links, saw ${navMatches.length}`);
}

console.log("Five-tab nav checks passed.");
