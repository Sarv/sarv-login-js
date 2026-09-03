/**
 * Turns node's coverage report into a shields.io endpoint badge.
 *
 * WHY NOT CODECOV
 * ---------------------------------------------------------------------------
 * The test suite runs against `dist/`, on purpose (see the README), and the
 * ESM build emits a content-hashed chunk - `chunk-D3R3HTLD.js`. A coverage
 * service keyed on file paths would therefore show a new "file" on every
 * release and no history for any of them. The aggregate number is meaningful;
 * the per-file view is not. So this writes the aggregate to a badge JSON that
 * CI commits to the `badges` branch, and shields reads it from there. No
 * account, no upload token, and the number cannot go stale because nothing
 * else writes it.
 *
 * Usage: node scripts/coverage-badge.mjs <report.txt> > coverage.json
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/coverage-badge.mjs <coverage-report.txt>");
  process.exit(1);
}

/**
 * Reads the aggregate line of the report.
 *
 * Matched on the words "all files" rather than on the report's box-drawing and
 * info glyphs, which are decoration that node is free to restyle.
 */
export function parseCoverage(report) {
  const line = report
    .split("\n")
    .find((candidate) => candidate.includes("all files") && candidate.includes("|"));
  if (!line) {
    throw new Error("No 'all files' row in the coverage report - did the run fail before it?");
  }
  const numbers = line
    .split("|")
    .slice(1)
    .map((cell) => Number.parseFloat(cell.trim()))
    .filter((value) => Number.isFinite(value));
  const [lines, branches, functions] = numbers;
  if (lines === undefined) throw new Error(`Could not read a percentage from: ${line.trim()}`);
  return { lines, branches, functions };
}

/** Shields' own convention: green is "good", and the steps are coarse on
 *  purpose so a half-point drift does not change the colour. */
export function badgeColor(percent) {
  if (percent >= 90) return "brightgreen";
  if (percent >= 75) return "green";
  if (percent >= 60) return "yellowgreen";
  if (percent >= 45) return "yellow";
  return "orange";
}

const { lines } = parseCoverage(readFileSync(path, "utf8"));
process.stdout.write(
  `${JSON.stringify({
    schemaVersion: 1,
    label: "coverage",
    message: `${lines.toFixed(1)}%`,
    color: badgeColor(lines),
  })}\n`
);
