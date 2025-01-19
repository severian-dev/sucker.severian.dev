#!/usr/bin/env node
const { execSync } = require("child_process");

const portIndex = process.argv.indexOf("-p");
let port = "3000";
if (portIndex !== -1 && portIndex + 1 < process.argv.length) {
  port = process.argv[portIndex + 1];
}

try {
  execSync(`PORT=${port} npm run start`, { stdio: "inherit" });
} catch (err) {
  console.error("Failed to start Next.js:", err);
  process.exit(1);
}
