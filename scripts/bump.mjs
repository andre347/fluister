#!/usr/bin/env node
// Bump the Fluister version in all three places the toolchain reads it:
//   - package.json
//   - src-tauri/Cargo.toml
//   - src-tauri/tauri.conf.json
//
// Usage: pnpm bump 0.2.0
//
// Doesn't tag or commit — you do that yourself once the diff looks good.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (!target || !/^\d+\.\d+\.\d+$/.test(target)) {
  console.error("usage: pnpm bump <semver>   e.g. pnpm bump 0.2.0");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function patch(path, transform) {
  const abs = resolve(root, path);
  const before = readFileSync(abs, "utf8");
  const after = transform(before);
  if (before === after) {
    console.error(`! ${path} — pattern not matched, leaving unchanged`);
    return false;
  }
  writeFileSync(abs, after);
  console.log(`  ${path}`);
  return true;
}

console.log(`Bumping Fluister to ${target}`);

const a = patch("package.json", (src) =>
  src.replace(/("version":\s*)"[^"]+"/, `$1"${target}"`),
);

// Cargo.toml's [package] version — only the first `version = ".."` after
// `[package]`, so we anchor on that block to avoid matching tauri-plugin
// versions further down.
const b = patch("src-tauri/Cargo.toml", (src) =>
  src.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*)"[^"]+"/,
    `$1"${target}"`,
  ),
);

const c = patch("src-tauri/tauri.conf.json", (src) =>
  src.replace(/("version":\s*)"[^"]+"/, `$1"${target}"`),
);

if (!(a && b && c)) {
  console.error("\nOne or more files didn't update — inspect manually.");
  process.exit(1);
}

console.log(`\nDone. Next:`);
console.log(`  git add -A && git commit -m "release: v${target}"`);
console.log(`  git tag v${target} && git push --follow-tags`);
