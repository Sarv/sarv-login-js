/**
 * Prints the CHANGELOG section for one version, for a release's notes.
 *
 *   node scripts/changelog-section.mjs 1.0.1
 *
 * Exits 1 with nothing on stdout when there is no section for that version, so
 * the caller can fall back to generated notes rather than publishing a release
 * whose body is an error message.
 *
 * Kept as a script rather than a shell one-liner because it is the kind of
 * text-slicing that sed gets subtly wrong: the heading it stops at has to be
 * the next `## [` and not any `##`, or a section with subheadings truncates.
 */
import { readFileSync } from "node:fs";

/** A Keep a Changelog link reference definition - `[1.0.0]: https://...`. The
 *  block of these at the foot of the file belongs to no section, so it ends the
 *  last one. Without this the newest release's notes carry a list of URLs. */
const isLinkDefinition = (line) => /^\[[^\]]+\]:\s/.test(line);

/** The lines under `## [version]`, up to whichever comes first: the next
 *  version heading, or the link definitions at the end of the file.
 *  Pure, so it is testable without a file. */
export function extractSection(changelog, version) {
  const lines = changelog.split("\n");
  // The date part is not matched: `## [1.0.1] - 2026-09-03` and a dateless
  // `## [1.0.1]` are the same section, and requiring the date would make the
  // notes silently empty on a release where it was forgotten.
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  // `## [` only, never a bare `##`: a section's own `### Added` subheadings
  // must not end it, or every release's notes stop at their first subheading.
  const end = rest.findIndex((line) => line.startsWith("## [") || isLinkDefinition(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

/**
 * The CLI as a function of its inputs, so the exit codes are testable without
 * spawning a process: it returns what to print and what to exit with, and the
 * three lines below are the only part that actually talks to the OS.
 */
export function run(args, readChangelog) {
  const [version] = args;
  if (!version) return { code: 1, err: "usage: changelog-section.mjs <version>" };
  const section = extractSection(readChangelog(), version);
  // A non-zero exit with an empty stdout is the contract the workflow relies
  // on: it falls back to generated notes rather than publishing this message.
  if (!section) return { code: 1, err: `no CHANGELOG.md section for ${version}` };
  return { code: 0, out: section };
}

// Guarded so importing this file in a test does not read the disk or exit.
if (process.argv[1]?.endsWith("changelog-section.mjs")) {
  const { code, out, err } = run(process.argv.slice(2), () =>
    readFileSync("CHANGELOG.md", "utf8")
  );
  if (out) console.log(out);
  if (err) console.error(err);
  process.exit(code);
}
