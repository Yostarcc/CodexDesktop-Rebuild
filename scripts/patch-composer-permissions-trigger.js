#!/usr/bin/env node
/**
 * Post-build patch: remove the stray label text from the composer permissions
 * dropdown trigger while keeping its icon and tooltip behavior intact.
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const RULE = {
  id: "remove_permissions_trigger_label",
  filePattern: /^composer-.*\.js$/,
  from:
    "let e=ge,n=R&&`loading-shimmer`,r;t[81]!==n||t[82]!==he?(r=q(`max-w-40 truncate whitespace-nowrap text-left`,he,n),t[81]=n,t[82]=he,t[83]=r):r=t[83];let i;t[84]!==r||t[85]!==_e?(i=(0,Q.jsx)(Gr,{collapse:`xs`,className:r,children:_e}),t[84]=r,t[85]=_e,t[86]=i):i=t[86];let a=he??`text-token-input-placeholder-foreground`,o;t[87]===a?o=t[88]:(o=q(`icon-2xs shrink-0`,a),t[87]=a,t[88]=o);let s;t[89]===o?s=t[90]:(s=(0,Q.jsx)(ho,{className:o}),t[89]=o,t[90]=s);let c;t[91]!==i||t[92]!==s||t[93]!==ge?(c=(0,Q.jsxs)(wr,{size:`composerSm`,color:`ghost`,className:`min-w-0`,children:[e,i,s]}),t[91]=i,t[92]=s,t[93]=ge,t[94]=c):c=t[94],Be=c",
  to:
    "let e=ge,n=R&&`loading-shimmer`,r;t[81]!==n||t[82]!==he?(r=q(`max-w-40 truncate whitespace-nowrap text-left`,he,n),t[81]=n,t[82]=he,t[83]=r):r=t[83];let i;t[84]!==r||t[85]!==_e?(i=(0,Q.jsx)(Gr,{collapse:`xs`,className:r,children:_e}),t[84]=r,t[85]=_e,t[86]=i):i=t[86];let a=he??`text-token-input-placeholder-foreground`,o;t[87]===a?o=t[88]:(o=q(`icon-2xs shrink-0`,a),t[87]=a,t[88]=o);let s;t[89]===o?s=t[90]:(s=(0,Q.jsx)(ho,{className:o}),t[89]=o,t[90]=s);let c;t[91]!==s||t[92]!==ge?(c=(0,Q.jsxs)(wr,{size:`composerSm`,color:`ghost`,className:`min-w-0`,children:[e,s]}),t[91]=s,t[92]=ge,t[93]=c):c=t[93],Be=c",
};

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
      if (source.includes(RULE.from)) {
        targets.push({ platform: plat, path: filePath });
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
    console.log("  [skip] No composer permissions trigger targets found");
    return;
  }

  let changedFiles = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    if (!source.includes(RULE.from)) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    const code = source.replace(RULE.from, RULE.to);
    if (code === source) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    console.log(`    * ${RULE.id}`);
    if (!isCheck) fs.writeFileSync(target.path, code, "utf-8");
    changedFiles += 1;
  }

  if (!isCheck) {
    if (changedFiles === 0) {
      console.log("  [ok] composer permissions trigger already patched");
    } else {
      console.log(`  [ok] patched ${changedFiles} file(s)`);
    }
  }
}

main();
