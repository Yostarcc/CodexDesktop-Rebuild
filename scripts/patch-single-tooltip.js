#!/usr/bin/env node
/**
 * Post-build patch: remove duplicate native title tooltips.
 *
 * We keep the app's own tooltip/popover layer and remove the browser-native
 * `title` attribute from buttons that are already wrapped by a tooltip
 * component. This fixes double-tooltips for:
 * - All design-system buttons that already use the app tooltip layer
 * - Local conversation summary toggle buttons
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
      if (/^(app-shell|button|local-conversation-page)-.*\.js$/.test(file)) {
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

const RULES = [
  {
    id: "remove_native_title_from_button_component",
    from: '(A=(0,o.jsxs)(`button`,{type:C,className:D,disabled:O,...d,children:[k,l]}),n[18]=l,n[19]=d,n[20]=D,n[21]=O,n[22]=k,n[23]=C,n[24]=A)',
    to: '(A=(0,o.jsxs)(`button`,{type:C,className:D,disabled:O,...(()=>{let{title:e,...t}=d;return t})(),children:[k,l]}),n[18]=l,n[19]=d,n[20]=D,n[21]=O,n[22]=k,n[23]=C,n[24]=A)',
  },
  {
    id: "remove_native_title_from_summary_toggle_button",
    from: 'u=(0,Q.jsx)(xe,{size:`toolbar`,color:o,"aria-label":r,"aria-pressed":a,title:r,onClick:i,uniform:!0,...n,children:l})',
    to: 'u=(0,Q.jsx)(xe,{size:`toolbar`,color:o,"aria-label":r,"aria-pressed":a,onClick:i,uniform:!0,...n,children:l})',
  },
];

function patchSource(source) {
  const changes = [];
  let code = source;

  for (const rule of RULES) {
    if (code.includes(rule.to)) continue;
    if (!code.includes(rule.from)) continue;
    code = replaceOnce(code, rule.from, rule.to, rule.id, changes);
  }

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
