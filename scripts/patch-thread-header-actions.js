#!/usr/bin/env node
/**
 * Post-build patch: adjust local thread header actions.
 *
 * Changes:
 * 1. Remove native `title` tooltips from buttons that already use the app tooltip layer.
 * 2. Add the app tooltip layer to the side/bottom panel tab switcher trigger.
 * 3. Replace the local thread "Open in" compound control with a single folder icon button.
 * 4. Remove the native tooltip from the local thread summary panel toggle.
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
          "d=(0,Gn.jsx)(j,{size:`toolbar`,color:u,\"aria-label\":i,\"aria-pressed\":s,disabled:l,title:i,onClick:a,uniform:!0,children:n})",
        to:
          "d=(0,Gn.jsx)(j,{size:`toolbar`,color:u,\"aria-label\":i,\"aria-pressed\":s,disabled:l,onClick:a,uniform:!0,children:n})",
      },
      {
        id: "add_tooltip_to_side_panel_tab_switcher_trigger",
        from:
          "h=(0,$.jsx)(j,{className:`data-[state=open]:!bg-token-foreground/5 data-[state=open]:!text-token-foreground`,color:`ghost`,size:`toolbar`,title:r,uniform:!0,children:m})",
        to:
          "h=(0,$.jsx)(L,{tooltipContent:r,delayOpen:!0,children:(0,$.jsx)(j,{className:`data-[state=open]:!bg-token-foreground/5 data-[state=open]:!text-token-foreground`,color:`ghost`,size:`toolbar`,\"aria-label\":r,uniform:!0,children:m})})",
      },
      {
        id: "replace_open_in_compound_button_with_folder_icon",
        from:
          "let z;return t[40]!==_||t[41]!==b||t[42]!==x||t[43]!==C||t[44]!==P||t[45]!==F||t[46]!==R||t[47]!==E||t[48]!==D||t[49]!==O||t[50]!==k||t[51]!==A||t[52]!==j||t[53]!==M?(z=(0,Y.jsx)(_,{color:E,size:D,primaryDisabled:O,dropdownAlign:k,dropdownContentMaxHeight:A,dropdownContentWidth:j,dropdownContentClassName:M,primaryAriaLabel:b,tooltipContent:x,dropdownContent:C,onDropdownOpenChange:P,onClick:F,children:R}),t[40]=_,t[41]=b,t[42]=x,t[43]=C,t[44]=P,t[45]=F,t[46]=R,t[47]=E,t[48]=D,t[49]=O,t[50]=k,t[51]=A,t[52]=j,t[53]=M,t[54]=z):z=t[54],z}",
        to:
          "let z;return t[40]!==i||t[41]!==x||t[42]!==F||t[43]!==O?(z=(0,Y.jsx)(Un,{label:x??i.formatMessage(nr.openPrimaryTarget),onClick:F,disabled:O,children:(0,Y.jsx)(Jt,{className:`icon-sm`})}),t[40]=i,t[41]=x,t[42]=F,t[43]=O,t[44]=z):z=t[44],z}",
      },
    ],
  },
  {
    fileRe: /^local-conversation-thread-.*\.js$/,
    markers: ["function cv(e)", "codex.localConversation.backgroundTasks.title.subagents"],
    rules: [
      {
        id: "remove_summary_panel_header_button_native_title",
        from:
          "l=(0,dv.jsx)(Oe,{size:`toolbar`,color:s,\"aria-label\":r,\"aria-pressed\":a,title:r,onClick:i,uniform:!0,...n,children:c})",
        to:
          "l=(0,dv.jsx)(Oe,{size:`toolbar`,color:s,\"aria-label\":r,\"aria-pressed\":a,onClick:i,uniform:!0,...n,children:c})",
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
    return { code, status: "applied" };
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
