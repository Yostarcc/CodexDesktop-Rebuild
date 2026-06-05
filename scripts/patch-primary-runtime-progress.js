#!/usr/bin/env node
/**
 * Prevent the runtime install progress/status handlers from crashing when phase-bearing
 * payloads are missing.
 *
 * Upstream code reads `e.progress.phase` and `e.phase` without guarding for nullish
 * payloads. In this build, some events arrive without those fields, which crashes
 * the renderer.
 */
const fs = require("fs");
const path = require("path");
const { locateBundles, relPath } = require("./patch-util");

const RULES = [
  {
    id: "guard_primary_runtime_install_progress_phase",
    filePattern: /^app-main-.*\.js$/,
    from: "t.set(j_,{...e.progress,hostId:e.hostId,updatedAtMs:Date.now()}),e.progress.phase===`ready`",
    to: "t.set(j_,{...e.progress,hostId:e.hostId,updatedAtMs:Date.now()}),e.progress?.phase===`ready`",
  },
  {
    id: "guard_primary_runtime_install_status_phase",
    filePattern: /^primary-runtime-install-status-message-.*\.js$/,
    from: "function r(e){if(e==null)return 0;switch(e.phase){case`checking`:return 0;case`downloading`:return e.downloadedBytes==null||e.totalBytes==null?0:Math.floor(Math.min(e.downloadedBytes/e.totalBytes*100,100));case`verifying`:case`extracting`:return 98;case`validating`:case`installed`:case`configuring`:case`ready`:return 100;case`error`:return 0}}",
    to: "function r(e){if(e==null)return 0;switch(e?.phase){case`checking`:return 0;case`downloading`:return e.downloadedBytes==null||e.totalBytes==null?0:Math.floor(Math.min(e.downloadedBytes/e.totalBytes*100,100));case`verifying`:case`extracting`:return 98;case`validating`:case`installed`:case`configuring`:case`ready`:return 100;case`error`:return 0}}",
  },
];

function locateTargets(platform) {
  return RULES.flatMap((rule) =>
    locateBundles({ dir: "assets", pattern: rule.filePattern, platform })
      .filter(({ path: filePath }) => fs.readFileSync(filePath, "utf-8").includes(rule.from))
      .map((target) => ({ ...target, rule })),
  );
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateTargets(platform);
  if (targets.length === 0) {
    console.log("  [skip] No primary-runtime progress targets found");
    return;
  }

  let patchedCount = 0;
  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    if (!source.includes(target.rule.from)) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    const code = source.replace(target.rule.from, target.rule.to);
    if (code === source) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    console.log(`    * ${target.rule.id}`);
    if (!isCheck) fs.writeFileSync(target.path, code, "utf-8");
    patchedCount += 1;
  }

  if (!isCheck) {
    if (patchedCount === 0) {
      console.log("  [ok] primary runtime progress already patched");
    } else {
      console.log(`  [ok] patched ${patchedCount} file(s)`);
    }
  }
}

main();
