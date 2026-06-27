#!/usr/bin/env node
/**
 * Post-build patch: Force-enable Fast mode (speed selector)
 *
 * Current upstream gates fast_mode behind ChatGPT service-tier checks. Remove
 * only those current gates.
 */
const fs = require("fs");
const path = require("path");
const { relPath, SRC_DIR } = require("./patch-util");

const RULES = [
  {
    id: "fast_mode_service_tier_read_gate",
    from:
      "n===`chatgpt`?(await e.query.fetch(g,{authMethod:n,hostId:t})).requirements?.featureRequirements?.fast_mode!==!1:!1",
    to:
      "(await e.query.fetch(g,{authMethod:n,hostId:t})).requirements?.featureRequirements?.fast_mode!==!1",
  },
  {
    id: "fast_mode_service_tier_hook_gate",
    from:
      "let{data:u,isPending:d}=o(j,l),f=!!a?.isLoading||s&&d,p=s&&!f&&u!=null&&u?.requirements?.featureRequirements?.fast_mode!==!1,m;",
    to:
      "let{data:u,isPending:d}=o(j,l),f=!!a?.isLoading||s&&d,p=!f&&u!=null&&u?.requirements?.featureRequirements?.fast_mode!==!1,m;",
  },
];

function patchSource(source) {
  const changes = [];
  let code = source;

  for (const rule of RULES) {
    const idx = code.indexOf(rule.from);
    if (idx === -1) continue;
    code = code.slice(0, idx) + rule.to + code.slice(idx + rule.from.length);
    changes.push(rule.id);
  }

  return { code, changes };
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) =>
    ["mac-arm64", "mac-x64", "win"].includes(a),
  );

  const platforms = platform
    ? [platform]
    : ["mac-arm64", "mac-x64", "win"].filter((p) =>
        fs.existsSync(path.join(SRC_DIR, p, "_asar", "webview", "assets")),
      );

  const targets = [];
  for (const plat of platforms) {
    const assetsDir = path.join(SRC_DIR, plat, "_asar", "webview", "assets");
    if (!fs.existsSync(assetsDir)) continue;
    for (const f of fs.readdirSync(assetsDir)) {
      if (!f.endsWith(".js")) continue;
      const fp = path.join(assetsDir, f);
      const src = fs.readFileSync(fp, "utf-8");
      if (RULES.some((rule) => src.includes(rule.from) || src.includes(rule.to))) {
        targets.push({ platform: plat, path: fp });
      }
    }
  }

  if (targets.length === 0) {
    console.log("  [skip] No chunk contains fast_mode gate logic");
    return;
  }

  let totalPatched = 0;

  for (const bundle of targets) {
    const source = fs.readFileSync(bundle.path, "utf-8");
    const { code, changes } = patchSource(source);

    if (isCheck) {
      if (changes.length === 0) {
        console.log(`  [${bundle.platform}] [ok] no changes needed: ${relPath(bundle.path)}`);
        continue;
      }
      console.log(`  [${bundle.platform}] ${relPath(bundle.path)}`);
      for (const id of changes) console.log(`    [?] ${id}`);
      totalPatched += changes.length;
      continue;
    }

    if (changes.length === 0) {
      console.log(`  [${bundle.platform}] [ok] no changes needed: ${relPath(bundle.path)}`);
      continue;
    }

    console.log(`  [${bundle.platform}] ${relPath(bundle.path)}`);
    for (const id of changes) console.log(`    * ${id}`);
    fs.writeFileSync(bundle.path, code, "utf-8");
    totalPatched += changes.length;
  }

  if (totalPatched > 0) {
    console.log(
      isCheck
        ? `  [ok] ${totalPatched} service-tier gate(s) would be removed`
        : `  [ok] ${totalPatched} service-tier gate(s) removed`,
    );
  } else {
    console.log("  [ok] fast_mode service-tier gates already patched or absent");
  }
}

main();
