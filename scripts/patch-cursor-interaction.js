#!/usr/bin/env node
/**
 * Post-build patch: restore pointer cursors for interactive controls in Electron.
 *
 * Newer upstream builds set `--cursor-interaction: default` on Electron body,
 * which neutralizes many existing `cursor-interaction` utility classes.
 * This patch restores the expected pointer cursor by overriding the variable.
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const FROM = "[data-codex-window-type=electron] body{--cursor-interaction:default;overscroll-behavior:none;overflow:hidden}";
const TO = "[data-codex-window-type=electron] body{--cursor-interaction:pointer;overscroll-behavior:none;overflow:hidden}";

function locateTargets(platform) {
  const platforms = platform
    ? [platform]
    : ["mac-arm64", "mac-x64", "win"].filter((p) =>
        fs.existsSync(path.join(SRC_DIR, p, "_asar", "webview", "assets")),
      );

  const targets = [];
  for (const plat of platforms) {
    const dir = path.join(SRC_DIR, plat, "_asar", "webview", "assets");
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (/^app-main-.*\.css$/.test(file)) {
        targets.push({ platform: plat, path: path.join(dir, file) });
      }
    }
  }
  return targets;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateTargets(platform);
  if (targets.length === 0) {
    console.log("  [skip] No app-main-*.css found");
    return;
  }

  let changed = 0;
  let unresolved = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    if (source.includes(TO)) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }
    if (!source.includes(FROM)) {
      console.log(`  [${target.platform}] [!] unresolved cursor-interaction target: ${relPath(target.path)}`);
      unresolved += 1;
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    console.log("    * restore_pointer_cursor_variable");

    if (!isCheck) {
      fs.writeFileSync(target.path, source.replace(FROM, TO), "utf-8");
    }
    changed += 1;
  }

  if (!isCheck) {
    if (unresolved > 0) {
      console.log(`  [x] unresolved cursor-interaction targets: ${unresolved}`);
      process.exit(1);
    }
    if (changed === 0) {
      console.log("  [ok] cursor interaction already patched");
    } else {
      console.log(`  [ok] patched ${changed} cursor interaction file(s)`);
    }
  }
}

main();
