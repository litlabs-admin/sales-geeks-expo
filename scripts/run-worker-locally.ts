import { spawn } from "node:child_process";

const child = spawn("pnpm", ["dev:worker"], {
  stdio: "inherit",
  shell: true
});

process.on("SIGINT", () => child.kill("SIGINT"));
