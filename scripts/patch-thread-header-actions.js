#!/usr/bin/env node
/**
 * Post-build patch: adjust local thread header actions.
 *
 * Changes:
 * 1. Remove native `title` tooltips from buttons that already use the app tooltip layer.
 * 2. Add the app tooltip layer to the side/bottom panel tab switcher trigger.
 * 3. Replace the local thread "Open in" compound control with a single folder icon button.
 * 4. Replace the local thread summary panel toggle native tooltip with the app tooltip layer.
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const PLATFORMS = ["mac-arm64", "mac-x64", "win"];
const ASSETS_PATH = ["_asar", "webview", "assets"];
const TARGETS = [
  {
    fileRe: /^thread-app-shell-chrome-.*\.js$/,
    markers: [
      "localConversationPage.openPrimaryTarget.tooltip",
      "persistPreferred:!0",
      "persistPreferred:!1",
    ],
    rules: [
      {
        id: "remove_thread_header_button_native_title",
        from:
          "d=(0,Q.jsx)(F,{size:`toolbar`,color:u,\"aria-label\":i,\"aria-pressed\":s,disabled:l,title:i,onClick:a,uniform:!0,children:n})",
        to:
          "d=(0,Q.jsx)(F,{size:`toolbar`,color:u,\"aria-label\":i,\"aria-pressed\":s,disabled:l,onClick:a,uniform:!0,children:n})",
      },
      {
        id: "add_tooltip_to_side_panel_tab_switcher_trigger",
        from:
          "h=(0,Q.jsx)(F,{className:`data-[state=open]:!bg-token-foreground/5 data-[state=open]:!text-token-foreground`,color:`ghost`,size:`toolbar`,title:r,uniform:!0,children:m})",
        to:
          "h=(0,Q.jsx)(R,{tooltipContent:r,delayOpen:!0,children:(0,Q.jsx)(F,{className:`data-[state=open]:!bg-token-foreground/5 data-[state=open]:!text-token-foreground`,color:`ghost`,size:`toolbar`,\"aria-label\":r,uniform:!0,children:m})})",
      },
      {
        id: "replace_open_in_compound_button_with_folder_icon",
        from:
          "V=(0,Q.jsx)(S,{color:j,size:M,primaryDisabled:N,dropdownAlign:P,dropdownContentMaxHeight:F,dropdownContentWidth:w,dropdownContentClassName:E,primaryAriaLabel:D,tooltipContent:O,dropdownContent:k,onDropdownOpenChange:I,onClick:L,children:B})",
        to:
          "V=(0,Q.jsx)(dt,{label:O??i.formatMessage(vt.openPrimaryTarget),onClick:L,color:`ghost`,disabled:N,children:(0,Q.jsx)(Le,{className:`icon-sm`})})",
      },
    ],
  },
  {
    fileRe: /^local-conversation-thread-.*\.js$/,
    markers: ["function el(e)", "Yc,{className:`icon-sm`}", "function tl(e)"],
    rules: [
      {
        id: "add_tooltip_to_summary_panel_header_button",
        from:
          "c=(0,$.jsx)(pt,{size:`toolbar`,color:o,\"aria-label\":r,\"aria-pressed\":a,title:r,onClick:i,uniform:!0,...n,children:s})",
        to:
          "c=(0,$.jsx)(xt,{tooltipContent:r,delayOpen:!0,children:(0,$.jsx)(pt,{size:`toolbar`,color:o,\"aria-label\":r,\"aria-pressed\":a,onClick:i,uniform:!0,...n,children:s})})",
      },
    ],
  },
];

function locateTargets(platform) {
  const platforms = platform
    ? [platform]
    : PLATFORMS.filter((p) => fs.existsSync(path.join(SRC_DIR, p, ...ASSETS_PATH)));

  const targets = [];
  for (const plat of platforms) {
    const dir = path.join(SRC_DIR, plat, ...ASSETS_PATH);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      for (const target of TARGETS) {
        if (!target.fileRe.test(file)) continue;

        const fullPath = path.join(dir, file);
        const source = fs.readFileSync(fullPath, "utf-8");
        if (target.markers.every((marker) => source.includes(marker))) {
          targets.push({ platform: plat, path: fullPath, rules: target.rules });
        }
      }
    }
  }

  return targets;
}

function applyRule(code, rule) {
  if (code.includes(rule.to)) {
    return { code, status: "already-applied" };
  }
  if (!code.includes(rule.from)) {
    return { code, status: "missing" };
  }
  return { code: code.replace(rule.from, rule.to), status: "changed" };
}

function patchSource(source, rules) {
  const changes = [];
  const missing = [];
  let code = source;

  for (const rule of rules) {
    const result = applyRule(code, rule);
    code = result.code;

    if (result.status === "changed") {
      changes.push(rule.id);
    } else if (result.status === "missing") {
      missing.push(rule.id);
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
    const { code, changes, missing } = patchSource(source, target.rules);

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
