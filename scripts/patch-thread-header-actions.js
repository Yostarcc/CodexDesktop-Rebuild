#!/usr/bin/env node
/**
 * Post-build patch: adjust local thread header actions.
 *
 * Changes:
 * 1. Replace the local thread "Open in" compound control with the legacy
 *    single folder icon button.
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
      if (!/^thread-app-shell-chrome-.*\.js$/.test(file)) continue;

      const fullPath = path.join(dir, file);
      const source = fs.readFileSync(fullPath, "utf-8");
      if (
        source.includes("localConversationPage.openPrimaryTarget.tooltip")
        && source.includes("persistPreferred:!0")
        && source.includes("persistPreferred:!1")
      ) {
        targets.push({ platform: plat, path: fullPath });
      }
    }
  }

  return targets;
}

function replaceOnce(source, from, to, id, changes) {
  const idx = source.indexOf(from);
  if (idx === -1) return source;
  changes.push(id);
  return source.replace(from, to);
}

const RULES = [
  {
    id: "replace_open_in_compound_button_with_folder_icon",
    from:
      "I=(0,q.jsx)(y,{color:D,size:O,dropdownAlign:k,dropdownContentClassName:j,primaryAriaLabel:S,tooltipContent:C,dropdownContent:te,onFocus:g,onMouseEnter:g,onDropdownOpenChange:ne,onClick:M,children:F})",
    to:
      "I=(0,q.jsx)(`span`,{onFocus:g,onMouseEnter:g,children:(0,q.jsx)(dt,{label:C??b.label,onClick:M,color:`ghost`,children:(0,q.jsx)(Qe,{className:`icon-sm`})})})",
  },
  {
    id: "fix_intermediate_thread_header_icon_component",
    from:
      "I=(0,q.jsx)(`span`,{onFocus:g,onMouseEnter:g,children:(0,q.jsx)(dt,{label:C??b.label,onClick:M,color:`ghost`,children:(0,q.jsx)(`img`,{alt:``,src:b.icon,className:`icon-sm`})})})",
    to:
      "I=(0,q.jsx)(`span`,{onFocus:g,onMouseEnter:g,children:(0,q.jsx)(dt,{label:C??b.label,onClick:M,color:`ghost`,children:(0,q.jsx)(Qe,{className:`icon-sm`})})})",
  },
  {
    id: "fix_intermediate_thread_header_formatjs_component",
    from:
      "I=(0,q.jsx)(`span`,{onFocus:g,onMouseEnter:g,children:(0,q.jsx)(A,{label:C??ht.openPrimaryTarget.defaultMessage,color:`ghost`,onClick:M,children:(0,q.jsx)(`img`,{alt:``,src:b.icon,className:`icon-sm`})})})",
    to:
      "I=(0,q.jsx)(`span`,{onFocus:g,onMouseEnter:g,children:(0,q.jsx)(dt,{label:C??b.label,onClick:M,color:`ghost`,children:(0,q.jsx)(Qe,{className:`icon-sm`})})})",
  },
];

function patchSource(source) {
  const changes = [];
  const missing = [];
  let code = source;

  for (const rule of RULES) {
    if (!code.includes(rule.from)) {
      continue;
    }
    code = replaceOnce(code, rule.from, rule.to, rule.id, changes);
  }

  if (changes.length === 0) {
    const hasExpectedTarget = code.includes("children:(0,q.jsx)(dt,{label:C??b.label,onClick:M,color:`ghost`,children:(0,q.jsx)(Qe,{className:`icon-sm`})})");
    if (!hasExpectedTarget) {
      for (const rule of RULES) missing.push(rule.id);
    }
  }

  return { code, changes, missing };
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateTargets(platform);
  if (targets.length === 0) {
    console.log("  [skip] No thread-app-shell-chrome-*.js found");
    return;
  }

  let changedFiles = 0;
  let changedRules = 0;
  let unresolvedRules = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const { code, changes, missing } = patchSource(source);

    if (changes.length === 0) {
      if (missing.length > 0) {
        console.log(`  [${target.platform}] [!] unresolved thread-header rules in ${relPath(target.path)}: ${missing.join(", ")}`);
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

  if (!isCheck) {
    if (unresolvedRules > 0) {
      console.log(`  [x] unresolved thread header action rules: ${unresolvedRules}`);
      process.exit(1);
    }
    if (changedFiles === 0) {
      console.log("  [ok] thread header actions already patched");
    } else {
      console.log(`  [ok] patched ${changedRules} change(s) in ${changedFiles} file(s)`);
    }
  }
}

main();
