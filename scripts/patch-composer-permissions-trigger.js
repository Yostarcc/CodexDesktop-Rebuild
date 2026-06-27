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
    "let c;t[70]===s?c=t[71]:(c=(0,Z.jsx)(ze,{className:s}),t[70]=s,t[71]=c);let l;t[72]!==i||t[73]!==c||t[74]!==Je?(l=(0,Z.jsxs)(We,{size:`composerSm`,color:`ghost`,className:`min-w-0`,children:[e,i,c]}),t[72]=i,t[73]=c,t[74]=Je,t[75]=l):l=t[75],gt=l",
  to:
    "let c;t[70]===s?c=t[71]:(c=(0,Z.jsx)(ze,{className:s}),t[70]=s,t[71]=c);let l;t[72]!==c||t[73]!==Je?(l=(0,Z.jsxs)(We,{size:`composerSm`,color:`ghost`,className:`min-w-0`,children:[e,c]}),t[72]=c,t[73]=Je,t[74]=l):l=t[74],gt=l",
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
      if (source.includes(RULE.from) || source.includes(RULE.to)) {
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
