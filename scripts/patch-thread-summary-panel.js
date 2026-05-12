#!/usr/bin/env node
/**
 * Post-build patch: tighten local thread summary panel hover behavior.
 *
 * Requested behavior:
 * 1) Keep the right-side guide bar visible by default.
 * 2) Only expand the summary card when the pointer explicitly enters the short bar.
 * 3) Keep the card open while hovering the card itself, then close on leave.
 *
 * Target chunk: local-conversation-thread-*.js
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
      if (/^local-conversation-thread-.*\.js$/.test(file)) {
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

  // Only explicit force-show state should expand the card.
  code = replaceOnce(
    code,
    "[_,v]=(0,Q.useState)(!1),y=_||u,b",
    "[_,v]=(0,Q.useState)(!1),y=_,b",
    "summary_expand_only_from_bar_hover",
    changes,
  );

  // Keep the guide bar visible whenever the panel itself is not expanded.
  code = replaceOnce(
    code,
    "b=d&&!y&&(0,$.jsx)(ga.div,{initial:{opacity:0,translateX:`100%`},animate:{opacity:1,translateX:0},exit:{opacity:0,translateX:`100%`},style:{height:g},className:`pointer-events-none absolute inset-y-0 right-0 flex flex-col items-center justify-center pe-3`,transition:{type:`spring`,duration:.5,bounce:.01},children:(0,$.jsx)(ga.div,{className:`h-10 w-1 rounded-full bg-token-border-heavy`})})",
    "b=!f&&!y&&(0,$.jsx)(ga.div,{initial:{opacity:0,translateX:`100%`},animate:{opacity:1,translateX:0},exit:{opacity:0,translateX:`100%`},style:{height:g},className:`pointer-events-none absolute inset-y-0 right-0 flex flex-col items-center justify-center pe-3`,transition:{type:`spring`,duration:.5,bounce:.01},children:(0,$.jsx)(ga.div,{className:`pointer-events-auto h-10 w-1 cursor-interaction rounded-full bg-token-border-heavy`,onMouseEnter:()=>{v(!0)},onMouseLeave:()=>{v(!1)}})})",
    "summary_bar_always_visible_and_hoverable",
    changes,
  );
  code = replaceOnce(
    code,
    "className:`pointer-events-auto absolute inset-y-0 right-0 flex cursor-interaction flex-col items-center justify-center pe-3`",
    "className:`pointer-events-none absolute top-0 right-0 flex flex-col items-center justify-center pe-3`",
    "summary_bar_vertical_hitbox_shrink",
    changes,
  );
  code = replaceOnce(
    code,
    "className:`pointer-events-auto absolute top-1/2 right-0 flex -translate-y-1/2 cursor-interaction flex-col items-center justify-center pe-3`",
    "className:`pointer-events-none absolute top-0 right-0 flex flex-col items-center justify-center pe-3`",
    "summary_bar_vertical_alignment_restore",
    changes,
  );
  code = replaceOnce(
    code,
    "children:(0,$.jsx)(ga.div,{className:`h-10 w-1 rounded-full bg-token-border-heavy`})",
    "children:(0,$.jsx)(ga.div,{className:`pointer-events-auto h-10 w-1 cursor-interaction rounded-full bg-token-border-heavy`,onMouseEnter:()=>{v(!0)},onMouseLeave:()=>{v(!1)}})",
    "summary_bar_inner_hover_target_only",
    changes,
  );

  // Keep the card open while the pointer is over the card.
  code = replaceOnce(
    code,
    "j=(0,$.jsx)(ga.div,{initial:!1,className:C,animate:w,transition:T,children:A})",
    "j=(0,$.jsx)(ga.div,{initial:!1,className:C,animate:w,transition:T,onMouseEnter:()=>{v(!0)},onMouseLeave:()=>{v(!1)},children:A})",
    "summary_card_hover_state_bound_to_card",
    changes,
  );

  // Add a small hover buffer around the card.
  // Horizontal stays a bit larger; vertical is intentionally small to reduce hand-shake closes
  // without turning the whole right side into a sticky hover zone.
  code = replaceOnce(
    code,
    "C=Y(`pe-4`,S)",
    "C=Y(`-ms-6 -my-2 ps-6 py-2 pe-4`,S)",
    "summary_card_hover_buffer",
    changes,
  );
  code = replaceOnce(
    code,
    "C=Y(`-ms-6 ps-6 pe-4`,S)",
    "C=Y(`-ms-6 -my-2 ps-6 py-2 pe-4`,S)",
    "summary_card_hover_buffer_upgrade",
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
    console.log("  [skip] No local-conversation-thread-*.js found");
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
      console.log("  [ok] thread summary panel already patched");
    } else {
      console.log(`  [ok] patched ${changedRules} change(s) in ${changedFiles} file(s)`);
    }
  }
}

main();
