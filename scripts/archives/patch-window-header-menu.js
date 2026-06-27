#!/usr/bin/env node
/**
 * Post-build patch: reveal the hidden View-menu command group above
 * "Toggle Sidebar" in the Windows/macOS custom title-bar menu.
 *
 * Root cause:
 * - The leading command group in the View menu is intentionally hidden
 *   with `visible: !1`.
 * - The user wants those commands shown instead of trimming the separator.
 *
 * We:
 * - reveal only the specific thread/view actions requested by the user
 * - restore pointer cursors for the Electron-rendered menu items
 * - keep the separator before "Toggle Sidebar"
 * - leave later hidden browser/debug items untouched
 */
const fs = require("fs");
const path = require("path");
const { locateBundles, relPath, SRC_DIR } = require("./patch-util");

const RULES = [
  {
    id: "show_open_command_menu_default",
    from: "se={...b(`openCommandMenu`),acceleratorWorksWhenHidden:!0,visible:!1,click:async()=>{await A()}}",
    to: "se={...b(`openCommandMenu`),acceleratorWorksWhenHidden:!0,click:async()=>{await A()}}",
  },
  {
    id: "show_search_files",
    from: "ce={...b(`searchFiles`),acceleratorWorksWhenHidden:!0,visible:!1,click:j}",
    to: "ce={...b(`searchFiles`),acceleratorWorksWhenHidden:!0,click:j}",
  },
  {
    id: "show_search_chats",
    from: "le={...b(`searchChats`),acceleratorWorksWhenHidden:!0,visible:!1,click:M}",
    to: "le={...b(`searchChats`),acceleratorWorksWhenHidden:!0,click:M}",
  },
];

const CSS_RULES = [
  {
    id: "restore_electron_cursor_interaction",
    from: "[data-codex-window-type=electron] body{--cursor-interaction:default;overscroll-behavior:none;overflow:hidden}",
    to: "[data-codex-window-type=electron] body{--cursor-interaction:pointer;overscroll-behavior:none;overflow:hidden}",
  },
];

function patchSource(source) {
  const changes = [];
  const missing = [];
  let code = source;

  for (const rule of RULES) {
    if (code.includes(rule.to)) continue;
    if (!code.includes(rule.from)) {
      missing.push(rule.id);
      continue;
    }
    code = code.replace(rule.from, rule.to);
    changes.push(rule.id);
  }

  return { code, changes, missing };
}

function locateCssTargets(platform) {
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
      if (file.endsWith(".css")) {
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

  const buildTargets = locateBundles({
    dir: "build",
    pattern: /^main-.*\.js$/,
    platform,
  });

  if (buildTargets.length === 0) {
    console.log("  [skip] No view-menu related bundles found");
    return;
  }

  let changedFiles = 0;
  let changedRules = 0;
  let unresolvedRules = 0;

  for (const target of buildTargets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const { code, changes, missing } = patchSource(source);

    if (changes.length === 0) {
      if (missing.length > 0) {
        console.log(`  [${target.platform}] [!] unresolved view-menu rules in ${relPath(target.path)}: ${missing.join(", ")}`);
        unresolvedRules += missing.length;
      } else {
        console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      }
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    for (const id of changes) console.log(`    * ${id}`);

    if (!isCheck) {
      fs.writeFileSync(target.path, code, "utf-8");
    }

    changedFiles += 1;
    changedRules += changes.length;
  }

  const cssTargets = locateCssTargets(platform);
  for (const target of cssTargets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const { code, changes, missing } = patchSourceWithRules(source, CSS_RULES);

    if (changes.length === 0) {
      if (missing.length > 0 && source.includes("[data-codex-window-type=electron] body")) {
        console.log(`  [${target.platform}] [!] unresolved cursor rules in ${relPath(target.path)}: ${missing.join(", ")}`);
        unresolvedRules += missing.length;
      }
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    for (const id of changes) console.log(`    * ${id}`);

    if (!isCheck) {
      fs.writeFileSync(target.path, code, "utf-8");
    }

    changedFiles += 1;
    changedRules += changes.length;
  }

  if (!isCheck) {
    if (unresolvedRules > 0) {
      console.log(`  [x] unresolved view-menu rules: ${unresolvedRules}`);
      process.exit(1);
    }
    if (changedFiles === 0) {
      console.log("  [ok] view-menu separator patch already applied");
    } else {
      console.log(`  [ok] patched ${changedRules} change(s) in ${changedFiles} file(s)`);
    }
  }
}

function patchSourceWithRules(source, rules) {
  const changes = [];
  const missing = [];
  let code = source;

  for (const rule of rules) {
    if (code.includes(rule.to)) continue;
    if (!code.includes(rule.from)) {
      missing.push(rule.id);
      continue;
    }
    code = code.replace(rule.from, rule.to);
    changes.push(rule.id);
  }

  return { code, changes, missing };
}

main();
