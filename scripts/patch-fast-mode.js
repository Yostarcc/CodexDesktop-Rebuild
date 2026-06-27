#!/usr/bin/env node
/**
 * Post-build patch: Force-enable Fast mode (speed selector)
 *
 * Upstream has used two different gate styles:
 * 1. Older bundles: authMethod comparisons around `chatgpt`
 * 2. Current bundles: service-tier checks that only allow fast_mode
 *    when authMethod is `chatgpt`
 *
 * This patch handles both by:
 * - keeping the old AST-based auth gate removal
 * - adding exact string replacements for the current service-tier gates
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("acorn");
const { relPath, SRC_DIR } = require("./patch-util");

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (node.type) visitor(node);
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && item.type) walk(item, visitor);
      }
    } else if (child && typeof child === "object" && child.type) {
      walk(child, visitor);
    }
  }
}

function collectPatches(ast, source) {
  const patches = [];

  walk(ast, (node) => {
    // Match function bodies containing both authMethod and fast_mode
    const isFn =
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression";
    if (!isFn) return;

    const fnSrc = source.slice(node.start, node.end);
    if (!fnSrc.includes("authMethod") || !fnSrc.includes("fast_mode")) return;

    // Inside this function, find: X.authMethod !== `chatgpt`
    walk(node, (child) => {
      if (child.type !== "BinaryExpression" || child.operator !== "!==") return;

      const childSrc = source.slice(child.start, child.end);
      if (!childSrc.includes("authMethod") || !childSrc.includes("chatgpt"))
        return;

      if (childSrc === "!1") return;

      // Avoid duplicate patches at same offset
      if (patches.some((p) => p.start === child.start)) return;

      patches.push({
        id: "fast_mode_auth_gate",
        start: child.start,
        end: child.end,
        replacement: "!1",
        original: childSrc,
      });
    });
  });

  return patches;
}

function flattenLogicalAnd(node) {
  if (node.type === "LogicalExpression" && node.operator === "&&") {
    return [
      ...flattenLogicalAnd(node.left),
      ...flattenLogicalAnd(node.right),
    ];
  }

  return [node];
}

function collectServiceTierHookPatches(ast, source) {
  const patches = [];

  walk(ast, (node) => {
    if (node.type !== "LogicalExpression" || node.operator !== "&&") return;

    const nodeSrc = source.slice(node.start, node.end);
    if (
      !nodeSrc.includes("fast_mode") ||
      !nodeSrc.includes("featureRequirements")
    ) {
      return;
    }

    const parts = flattenLogicalAnd(node);
    if (parts.length < 3) return;

    const authGate = parts[0];
    const nextGate = parts[1];
    if (authGate.type !== "Identifier") return;

    const original = source.slice(authGate.start, nextGate.start);
    if (!original.endsWith("&&")) return;

    if (patches.some((p) => p.start === authGate.start)) return;

    patches.push({
      id: "fast_mode_service_tier_hook_gate",
      start: authGate.start,
      end: nextGate.start,
      replacement: "",
      original,
    });
  });

  return patches;
}

function collectStringPatches(source) {
  const patterns = [
    {
      id: "fast_mode_service_tier_read_gate",
      original:
        "n===`chatgpt`?(await e.query.fetch(c,{authMethod:n,hostId:t})).requirements?.featureRequirements?.fast_mode!==!1:!1",
      replacement:
        "(await e.query.fetch(c,{authMethod:n,hostId:t})).requirements?.featureRequirements?.fast_mode!==!1",
    },
  ];

  const patches = [];

  for (const pattern of patterns) {
    const start = source.indexOf(pattern.original);
    if (start === -1) continue;

    patches.push({
      ...pattern,
      start,
      end: start + pattern.original.length,
    });
  }

  return patches;
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
      if (src.includes("authMethod") && src.includes("fast_mode")) {
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

    const t0 = Date.now();
    let ast;
    try {
      ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
    } catch {
      continue;
    }

    const patches = [
      ...collectPatches(ast, source),
      ...collectServiceTierHookPatches(ast, source),
      ...collectStringPatches(source),
    ];

    if (patches.length === 0) continue;

    console.log(
      `  [${bundle.platform}] ${relPath(bundle.path)} (parse ${Date.now() - t0}ms)`,
    );

    if (isCheck) {
      for (const p of patches) {
        console.log(`    [?] offset ${p.start}: ${p.original} -> ${p.replacement}`);
      }
      totalPatched += patches.length;
      continue;
    }

    patches.sort((a, b) => b.start - a.start);

    let code = source;
    for (const p of patches) {
      console.log(`    * ${p.original} -> ${p.replacement}`);
      code = code.slice(0, p.start) + p.replacement + code.slice(p.end);
    }

    fs.writeFileSync(bundle.path, code, "utf-8");
    totalPatched += patches.length;
  }

  if (totalPatched > 0) {
    console.log(
      isCheck
        ? `  [ok] ${totalPatched} auth gate(s) would be removed`
        : `  [ok] ${totalPatched} auth gate(s) removed`,
    );
  } else {
    console.log("  [ok] fast_mode auth gates already patched or absent");
  }
}

main();
