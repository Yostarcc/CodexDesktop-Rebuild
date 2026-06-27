/**
 * Post-build patch: Update copyright text
 *
 * Uses AST to locate `setAboutPanelOptions({ copyright: "(c) OpenAI" })`
 * and replace the copyright string with a custom value.
 *
 * Usage:
 *   node scripts/patch-copyright.js [platform]   # Apply patch (unix/win/omit=both)
 *   node scripts/patch-copyright.js --check       # Dry-run: report matches
 */
const fs = require("fs");
const { locateBundles, relPath } = require("./patch-util");

// ──────────────────────────────────────────────
//  Config
// ──────────────────────────────────────────────

const OLD_COPYRIGHT = "\u00A9 OpenAI";
const NEW_COPYRIGHT = "\u00A9 OpenAI \u00B7 Cometix Space";
const OLD_HTML = `<div class="copyright">${OLD_COPYRIGHT}</div>`;
const NEW_HTML = `<div class="copyright">${NEW_COPYRIGHT}</div>`;

// ──────────────────────────────────────────────
//  Patch rule
// ──────────────────────────────────────────────

function collectPatches(source) {
  const patches = [];
  const start = source.indexOf(OLD_HTML);
  if (start !== -1) {
    patches.push({
      start,
      end: start + OLD_HTML.length,
      replacement: NEW_HTML,
      original: OLD_HTML,
    });
  }
  return patches;
}

// ──────────────────────────────────────────────
//  Main
// ──────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const bundles = locateBundles({
    dir: "build",
    pattern: /^main(-[^.]+)?\.js$/,
    platform,
  });

  if (bundles.length === 0) {
    console.error("[x] No main bundle found");
    process.exit(1);
  }

  for (const bundle of bundles) {
    console.log(`\n-- [${bundle.platform}] ${relPath(bundle.path)}`);
    const source = fs.readFileSync(bundle.path, "utf-8");
    console.log(`   size: ${(source.length / 1024 / 1024).toFixed(1)} MB`);

    const patches = collectPatches(source);

    if (patches.length === 0) {
      // Check if already patched
      if (source.includes(NEW_COPYRIGHT)) {
        console.log("   [ok] Already patched");
      } else if (!source.includes("class=\"copyright\"") && !source.includes("setAboutPanelOptions")) {
        console.log("   [ok] No copyright target in this bundle");
      } else {
        console.log("   [!] No copyright target matched");
      }
      continue;
    }

    if (isCheck) {
      console.log(`   [?] Matches: ${patches.length}`);
      for (const p of patches) {
        console.log(`     > offset ${p.start}: ${p.original} -> ${p.replacement}`);
      }
      continue;
    }

    patches.sort((a, b) => b.start - a.start);
    let code = source;
    for (const p of patches) {
      console.log(`   * offset ${p.start}: ${p.original} -> ${p.replacement}`);
      code = code.slice(0, p.start) + p.replacement + code.slice(p.end);
    }

    fs.writeFileSync(bundle.path, code, "utf-8");
    console.log(`   [ok] Copyright updated: ${patches.length} replacements`);
  }
}

main();
