#!/usr/bin/env node
/**
 * Run all patch scripts in sequence.
 *
 * Usage:
 *   node scripts/patch-all.js              # Patch both platforms
 *   node scripts/patch-all.js unix         # Patch unix only
 *   node scripts/patch-all.js win          # Patch win only
 *   node scripts/patch-all.js --check      # Dry-run all
 */
const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const { PROJECT_ROOT } = require("./patch-util");

const PATCHES = [
  "patch-sidebar-layout.js",
  "patch-thread-header-actions.js",
  "patch-composer-footer-voice-btn.js",
  "patch-composer-external-footer-and-inline-footer-run-controls.js",
  "patch-composer-permissions-trigger.js",
  "patch-fast-mode.js",
  "patch-devtools.js",
  "patch-updater.js",
];

const PURE_SRC_DIR = path.join(PROJECT_ROOT, "pure-src");
const SRC_DIR = path.join(PROJECT_ROOT, "src");

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      // skip symlinks in workspace copies
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function clearDirContents(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

function restoreSrcFromPure(platform) {
  if (!fs.existsSync(PURE_SRC_DIR)) {
    throw new Error(`pure-src not found: ${PURE_SRC_DIR}`);
  }

  const requested = platform === "unix" ? ["mac-arm64", "mac-x64"] : platform ? [platform] : ["mac-arm64", "mac-x64", "win"];
  const available = requested.filter((name) => fs.existsSync(path.join(PURE_SRC_DIR, name)));

  if (available.length === 0) {
    throw new Error(`No pristine platform sources found in pure-src for: ${requested.join(", ")}`);
  }

  fs.mkdirSync(SRC_DIR, { recursive: true });

  for (const name of available) {
    const srcPlatformDir = path.join(PURE_SRC_DIR, name);
    const destPlatformDir = path.join(SRC_DIR, name);
    clearDirContents(destPlatformDir);
    copyRecursive(srcPlatformDir, destPlatformDir);
  }
}

function main() {
  const args = process.argv.slice(2);
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win", "unix"].includes(a));
  const extra = args.filter((a) => a.startsWith("--"));
  const passArgs = [...(platform ? [platform] : []), ...extra];

  if (!args.includes("--check")) {
    restoreSrcFromPure(platform);
  }

  let failed = 0;

  for (const script of PATCHES) {
    const scriptPath = path.join(__dirname, script);
    const label = script.replace(".js", "");
    console.log(`\n== ${label} ==`);

    if (!fs.existsSync(scriptPath)) {
      console.log(`  [skip] Missing script: ${script}`);
      continue;
    }

    try {
      execFileSync("node", [scriptPath, ...passArgs], { stdio: "inherit" });
    } catch (e) {
      console.error(`[x] ${label} failed (exit ${e.status})`);
      failed++;
    }
  }

  console.log(`\n== Summary: ${PATCHES.length - failed}/${PATCHES.length} succeeded ==`);
  if (failed > 0) process.exit(1);
}

main();
