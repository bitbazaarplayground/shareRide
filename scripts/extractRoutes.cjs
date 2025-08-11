const fs = require("fs");
const path = require("path");

const content = fs.readFileSync(
  path.resolve(__dirname, "../src/App.jsx"),
  "utf8"
);

const matches = [...content.matchAll(/path="([^"]+)"/g)];
const uniquePaths = [...new Set(matches.map((m) => m[1]))]
  .filter((p) => !p.includes(":"))
  .map((p) => `http://localhost:3000${p === "/" ? "" : p}`);

console.log(JSON.stringify(uniquePaths, null, 2));
