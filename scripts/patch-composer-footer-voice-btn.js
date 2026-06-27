#!/usr/bin/env node
/**
 * Remove the voice input button from composer-related footer surfaces.
 *
 * Keep the `voiceControls` object intact so we only hide the rendered trigger
 * and do not disturb the internal voice/realtime state wiring.
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const RULE = {
  id: "remove_voice_button_render",
  filePattern: /^composer-.*\.js$/,
  from: "Ae=(0,Q.jsx)(ht,{isVisible:re,disabled:!ie||ce.thread.phase!==`inactive`,isTranscribing:ae,canRetryDictation:te,shortcutLabel:ne,retryDictation:V,startDictation:se,stopDictation:H})",
  to: "Ae=null",
  footprint: "FooterActions:{",
};

const LIGHT_DISMISS_RULE = {
  id: "remove_dictation_trigger_render",
  filePattern: /^browser-sidebar-comment-light-dismiss-.*\.js$/,
  from: "mn?(0,$.jsx)(ne,{isVisible:pn,isTranscribing:Ht,canRetryDictation:Ut,disabled:K,retryDictation:Gt,shortcutLabel:_n,startDictation:qt,stopDictation:Jt,tooltipPortalContainer:yn}):null",
  to: "null",
  applied: "children:[null,hn?",
  footprint: "data-browser-comment-submit",
};

function replaceOnce(source, from, to) {
  const idx = source.indexOf(from);
  if (idx === -1) return source;
  return source.slice(0, idx) + to + source.slice(idx + from.length);
}

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
      if (!RULE.filePattern.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (
        !source.includes(RULE.from)
        && !source.includes(RULE.to)
        && !source.includes(RULE.footprint)
      ) {
        continue;
      }
      targets.push({ platform: plat, path: filePath });
    }
  }
  return targets;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = [
    ...locateTargets(platform),
    ...locateLightDismissTargets(platform),
  ];
  if (targets.length === 0) {
    console.log("  [skip] No composer voice-button targets found");
    return;
  }

  let patchedCount = 0;
  let unresolvedCount = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const rule = target.rule ?? RULE;
    const isApplied = source.includes(rule.applied ?? rule.to);
    if (!source.includes(rule.from) && !isApplied) {
      console.log(`  [${target.platform}] [!] ${rule.id} target changed: ${relPath(target.path)}`);
      unresolvedCount += 1;
      continue;
    }

    const code = replaceOnce(source, rule.from, rule.to);

    if (code === source) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    console.log(`    * ${rule.id}`);
    if (!isCheck) fs.writeFileSync(target.path, code, "utf-8");
    patchedCount += 1;
  }

  if (!isCheck) {
    if (unresolvedCount > 0) {
      console.log(`  [x] unresolved composer voice-button rules: ${unresolvedCount}`);
      process.exit(1);
    }
    if (patchedCount === 0) {
      console.log("  [ok] composer voice button already patched");
    } else {
      console.log(`  [ok] patched ${patchedCount} file(s)`);
    }
  }
}

function locateLightDismissTargets(platform) {
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
      if (!LIGHT_DISMISS_RULE.filePattern.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (
        !source.includes(LIGHT_DISMISS_RULE.from)
        && !source.includes(LIGHT_DISMISS_RULE.applied)
        && !source.includes(LIGHT_DISMISS_RULE.footprint)
      ) {
        continue;
      }
      targets.push({ platform: plat, path: filePath, rule: LIGHT_DISMISS_RULE });
    }
  }
  return targets;
}

main();
