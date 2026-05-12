#!/usr/bin/env node
/**
 * Post-build patch: remove duplicate native title tooltips from header buttons.
 *
 * We keep the app's own tooltip/popover layer and remove the browser-native
 * `title` attribute from buttons that are already wrapped by a tooltip
 * component. This fixes double-tooltips for:
 * - Toggle sidebar
 * - Back / Forward
 * - Thread header toolbar buttons using Pn(...)
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

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
      if (/^(app-shell|review-runtime-bridge)-.*\.js$/.test(file)) {
        targets.push({ platform: plat, path: path.join(dir, file) });
      }
    }
  }
  return targets;
}

function replaceOnce(source, from, to, id, changes) {
  if (source.includes(to)) return source;
  const idx = source.indexOf(from);
  if (idx === -1) return source;
  changes.push(id);
  return source.replace(from, to);
}

function patchSource(source) {
  const changes = [];
  let code = source;

  code = replaceOnce(
    code,
    'd=(0,Q.jsx)(Te,{"aria-label":n,color:`ghost`,disabled:l,style:u,size:`toolbar`,uniform:!0,title:n,onClick:a,children:r})',
    'd=(0,Q.jsx)(Te,{"aria-label":n,color:`ghost`,disabled:l,style:u,size:`toolbar`,uniform:!0,onClick:a,children:r})',
    "remove_native_title_from_app_shell_header_buttons",
    changes,
  );

  code = replaceOnce(
    code,
    'd=(0,Q.jsx)(Y,{size:`toolbar`,color:u,"aria-label":i,"aria-pressed":s,disabled:l,title:i,onClick:a,uniform:!0,children:n})',
    'd=(0,Q.jsx)(Y,{size:`toolbar`,color:u,"aria-label":i,"aria-pressed":s,disabled:l,onClick:a,uniform:!0,children:n})',
    "remove_native_title_from_thread_header_buttons",
    changes,
  );

  return { code, changes };
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateTargets(platform);
  if (targets.length === 0) {
    console.log("  [skip] No app-shell/review-runtime-bridge bundles found");
    return;
  }

  let changedFiles = 0;
  let changedRules = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const { code, changes } = patchSource(source);

    if (changes.length === 0) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
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
    if (changedFiles === 0) {
      console.log("  [ok] single-tooltip patch already applied");
    } else {
      console.log(`  [ok] patched ${changedRules} change(s) in ${changedFiles} file(s)`);
    }
  }
}

main();
