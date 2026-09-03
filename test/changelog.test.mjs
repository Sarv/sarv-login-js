/**
 * The release-notes slicer. Tested because it runs unattended in the publish
 * workflow: a wrong slice puts the previous version's notes on a release, and
 * nobody is watching at that moment to notice.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { extractSection, run } from "../scripts/changelog-section.mjs";

const CHANGELOG = `# Changelog

## [Unreleased]

- something in flight

## [1.1.0] - 2026-10-01

### Added

- the new thing

### Fixed

- the old thing

## [1.0.0] - 2026-09-03

First public release.

[unreleased]: https://example.com
`;

test("takes the section for the version asked for, and no other", () => {
  const section = extractSection(CHANGELOG, "1.1.0");
  assert.match(section, /the new thing/);
  assert.match(section, /the old thing/);
  // The boundary is the next version heading, so neither neighbour leaks in.
  assert.doesNotMatch(section, /something in flight/);
  assert.doesNotMatch(section, /First public release/);
});

test("keeps the subheadings inside a section", () => {
  // The bug this guards: stopping at the next `##` of any depth truncates a
  // section at its first `### Added` and publishes an empty release.
  const section = extractSection(CHANGELOG, "1.1.0");
  assert.match(section, /### Added/);
  assert.match(section, /### Fixed/);
});

test("the last section stops before the link definitions", () => {
  const section = extractSection(CHANGELOG, "1.0.0");
  assert.equal(section, "First public release.");
});

test("a version with no section is empty rather than the wrong one", () => {
  assert.equal(extractSection(CHANGELOG, "9.9.9"), "");
});

test("a heading with no date still matches", () => {
  // A forgotten date must not silently blank the release notes.
  assert.equal(extractSection("## [2.0.0]\n\nnotes here\n", "2.0.0"), "notes here");
});

test("the version this package is at has a section to publish", () => {
  // Guards the release itself: if this fails, `gh release create` would fall
  // back to generated notes for a version whose changelog entry was forgotten.
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  assert.notEqual(
    extractSection(readFileSync("CHANGELOG.md", "utf8"), version),
    "",
    `CHANGELOG.md has no "## [${version}]" section`
  );
});

test("the CLI prints the section and exits 0", () => {
  const { code, out, err } = run(["1.1.0"], () => CHANGELOG);
  assert.equal(code, 0);
  assert.equal(err, undefined);
  assert.match(out, /the new thing/);
});

test("the CLI exits non-zero with nothing on stdout when there is no section", () => {
  // The workflow reads stdout into the release notes, so a diagnostic must go
  // to stderr - printing it as the notes is the failure this guards.
  const { code, out, err } = run(["9.9.9"], () => CHANGELOG);
  assert.equal(code, 1);
  assert.equal(out, undefined);
  assert.match(err, /no CHANGELOG\.md section for 9\.9\.9/);
});

test("the CLI asks for a version rather than guessing one", () => {
  const { code, err } = run([], () => CHANGELOG);
  assert.equal(code, 1);
  assert.match(err, /usage:/);
});
