const fs = require("node:fs");
const path = require("node:path");

// Resolve from this file so cleanup works regardless of the caller's directory.
const root = path.resolve(__dirname, "..");
const packages = ["", "client", "server"];
const targets = packages.flatMap(directory => [
  "dist", "build", "coverage", ".nyc_output", "node_modules/.vite", ".DS_Store",
].map(artifact => path.join(directory, artifact)));

let removed = 0;
for (const target of targets) {
  const absolute = path.join(root, target);
  if (fs.existsSync(absolute)) {
    fs.rmSync(absolute, { recursive: true, force: true });
    console.log(`Removed ${target}`);
    removed++;
  }
}
console.log(removed ? "Clean complete." : "Already clean.");
