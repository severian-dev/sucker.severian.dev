#!/usr/bin/env node
const { execSync } = require("child_process");

// 1. Grab the port from the '-p' argument
const portIndex = process.argv.indexOf("-p");
let port = "3000";
if (portIndex !== -1 && portIndex + 1 < process.argv.length) {
  port = process.argv[portIndex + 1];
}

// 2. Start Next.js using that port
try {
  // Either pass it directly to next, e.g.:
  // execSync(`npx next start -p ${port}`, { stdio: "inherit" });
  //
  // Or set the PORT env var and run your npm script:
  execSync(`PORT=${port} npm run start`, { stdio: "inherit" });
} catch (err) {
  console.error("Failed to start Next.js:", err);
  process.exit(1);
}
