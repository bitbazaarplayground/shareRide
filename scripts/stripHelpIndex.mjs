// scripts/stripHelpIndex.mjs
import JSON5 from "json5";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

// Try these locations in order; stops at the first that exists
const candidateInputs = [
  "src/Pages/Help/help-index.dev.json5",
  "Pages/Help/help-index.dev.json5",
  "src/help/help-index.dev.json5",
  "src/data/help/help-index.dev.json5",
];

async function findInputFile() {
  for (const rel of candidateInputs) {
    const abs = path.join(root, rel);
    try {
      await fs.access(abs);
      if (process.env.DEBUG_HELP_INDEX) {
        console.log(`(debug) ✅ found dev index at: ${abs}`);
      }
      return abs;
    } catch (err) {
      if (process.env.DEBUG_HELP_INDEX) {
        console.warn(
          `(debug) not found: ${abs} (${err?.code || err?.message})`
        );
      }
    }
  }
  return null;
}

const inputFile = await findInputFile();
if (!inputFile) {
  console.error("❌ Could not find help-index.dev.json5. Looked in:");
  candidateInputs.forEach((p) => console.error("   -", path.join(root, p)));
  process.exit(1);
}

const outputFile = path.join(root, "public/help-index.json");

try {
  console.log(`🔎 Reading: ${inputFile}`);
  const devJson = await fs.readFile(inputFile, "utf-8");
  const parsed = JSON5.parse(devJson);

  const withComment = {
    _comment: "⚠️ AUTO-GENERATED from help-index.dev.json5 — DO NOT EDIT",
    items: parsed,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(outputFile, JSON.stringify(withComment, null, 2));
  console.log(`✅ Wrote: ${outputFile}`);
} catch (err) {
  console.error("❌ Failed to build help-index.json");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
}
