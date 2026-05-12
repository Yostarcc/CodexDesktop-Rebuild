#!/usr/bin/env node
/**
 * Post-build patch: Remove specific sidebar UI entries structurally.
 *
 * Requested UI changes:
 * 1. Remove top "New chat" action item from sidebar nav.
 * 2. Remove "Chats/Conversations" section under "Projects / Chats".
 *
 * Strategy:
 * - Parse app-main-*.js with Acorn.
 * - Find the JSX call that renders `_y` (new-chat button) and replace it with `null`.
 * - Find function `vg(...)` and force its section order seed to [`threads`] only.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("acorn");
const { SRC_DIR, relPath } = require("./patch-util");

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (node.type) visitor(node);
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "type") continue;
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

function getPropName(prop) {
  if (!prop || prop.type !== "Property") return null;
  const k = prop.key;
  if (!k) return null;
  if (k.type === "Identifier") return k.name;
  if (k.type === "Literal") return String(k.value);
  if (k.type === "TemplateLiteral" && k.expressions.length === 0 && k.quasis.length === 1) {
    return k.quasis[0].value.cooked;
  }
  return null;
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
      if (!/^app-main-.*\.js$/.test(file)) continue;
      targets.push({ platform: plat, path: path.join(dir, file) });
    }
  }
  return targets;
}

function collectPatches(ast, source) {
  const patches = [];

  walk(ast, (node) => {
    if (node.type === "CallExpression") {
      if (node.arguments.length >= 2 && node.arguments[0].type === "Identifier") {
        const arg0 = node.arguments[0];
        const arg1 = node.arguments[1];
        if (arg0.name === "_y" && arg1 && arg1.type === "ObjectExpression") {
          const propNames = new Set(arg1.properties.map(getPropName).filter(Boolean));
          if (propNames.has("newChatMessage") && propNames.has("onStartChat")) {
            const original = source.slice(node.start, node.end);
            if (original !== "null") {
              patches.push({
                id: "remove_new_chat_item",
                start: node.start,
                end: node.end,
                replacement: "null",
                original,
              });
            }
          }
        }
      }
    }

    if (node.type === "FunctionDeclaration" && node.id && node.id.name === "vg") {
      for (const stmt of node.body.body || []) {
        if (stmt.type !== "VariableDeclaration") continue;
        for (const decl of stmt.declarations || []) {
          if (!decl.id || decl.id.type !== "Identifier" || decl.id.name !== "i") continue;
          if (!decl.init) continue;
          const initSrc = source.slice(decl.init.start, decl.init.end);
          if (initSrc === "[`threads`]") continue;
          if (initSrc.includes("chats") && initSrc.includes("threads")) {
            patches.push({
              id: "remove_chats_section",
              start: decl.init.start,
              end: decl.init.end,
              replacement: "[`threads`]",
              original: initSrc,
            });
          }
        }
      }
    }
  });

  return patches;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateTargets(platform);
  if (targets.length === 0) {
    console.log("  [skip] No app-main-*.js found under src/*/_asar/webview/assets");
    return;
  }

  let patchedCount = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    let ast;
    try {
      ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
    } catch (e) {
      console.log(`  [${target.platform}] parse failed: ${relPath(target.path)}`);
      continue;
    }

    const patches = collectPatches(ast, source);
    if (patches.length === 0) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)} => ${patches.length} patch(es)`);

    if (isCheck) {
      for (const p of patches) {
        console.log(`    [?] ${p.id}: ${p.original.slice(0, 160)}${p.original.length > 160 ? "..." : ""} -> ${p.replacement}`);
      }
      continue;
    }

    patches.sort((a, b) => b.start - a.start);
    let code = source;
    for (const p of patches) {
      code = code.slice(0, p.start) + p.replacement + code.slice(p.end);
      patchedCount += 1;
      console.log(`    * ${p.id}`);
    }
    fs.writeFileSync(target.path, code, "utf-8");
  }

  if (!isCheck) {
    if (patchedCount === 0) {
      console.log("  [ok] sidebar layout already patched");
    } else {
      console.log(`  [ok] applied ${patchedCount} sidebar layout patch(es)`);
    }
  }
}

main();

