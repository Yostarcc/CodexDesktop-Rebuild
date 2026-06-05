#!/usr/bin/env node
/**
 * Post-build patch: Remove specific sidebar UI entries structurally and
 * adjust project row affordances.
 *
 * Requested UI changes:
 * 1. Remove top "New chat" action item from sidebar nav.
 * 2. Remove "Chats/Conversations" section under "Projects / Chats".
 * 3. Remove the "Codex mobile" sidebar entry shown under the Automation area.
 *
 * Strategy:
 * - Parse app-main-*.js with Acorn.
 * - Find the JSX call that renders the top "new chat" control by its props
 *   (`canStartProjectlessChat` + `newChatMessage` + `onStartChat`) and
 *   replace it with `null`.
 * - Find the section-order seed that expands to `chats/threads`
 *   and force it to [`threads`] only.
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

function getLiteralValue(node) {
  if (!node) return null;
  if (node.type === "Literal") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

function isChatsThreadsArray(node) {
  if (!node || node.type !== "ArrayExpression") return false;
  const values = node.elements.map(getLiteralValue).filter((value) => typeof value === "string");
  if (values.length !== node.elements.length) return false;
  if (!values.includes("chats") || !values.includes("threads")) return false;
  return values.every((value) => value === "chats" || value === "threads");
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
  if (source.includes("function nC(e){return null}")) return patches;

  const localProjectMenuTrigger =
    "F=(0,Q.jsx)(`div`,{className:`pr-0.5`,children:(0,Q.jsx)(M,{className:`h-6 w-6 rounded-md !p-1`,color:`ghostMuted`,size:`icon`,\"aria-label\":N,\"aria-haspopup\":`menu`,\"aria-expanded\":l,onClick:SE,children:P})}),t[9]=M,t[10]=l,t[11]=N,t[12]=F):F=t[12];";
  if (source.includes(localProjectMenuTrigger)) {
    patches.push({
      id: "hide_local_project_menu_trigger_button_only",
      start: source.indexOf(localProjectMenuTrigger),
      end: source.indexOf(localProjectMenuTrigger) + localProjectMenuTrigger.length,
      replacement:
        "F=(0,Q.jsx)(`div`,{className:`pr-0.5 w-0 overflow-hidden opacity-0 pointer-events-none`,children:(0,Q.jsx)(M,{className:`h-6 w-6 rounded-md !p-1`,color:`ghostMuted`,size:`icon`,\"aria-label\":N,\"aria-haspopup\":`menu`,\"aria-expanded\":l,onClick:SE,children:P})}),t[9]=M,t[10]=l,t[11]=N,t[12]=F):F=t[12];",
      original: localProjectMenuTrigger,
    });
  }

  const remoteProjectMenuTrigger =
    "V=(0,Q.jsx)(`div`,{className:`pr-0.5`,children:B}),t[37]=B,t[38]=P,t[39]=V):V=t[39];";
  if (source.includes(remoteProjectMenuTrigger)) {
    patches.push({
      id: "hide_remote_project_menu_trigger_button_only",
      start: source.indexOf(remoteProjectMenuTrigger),
      end: source.indexOf(remoteProjectMenuTrigger) + remoteProjectMenuTrigger.length,
      replacement:
        "V=(0,Q.jsx)(`div`,{className:`pr-0.5 w-0 overflow-hidden opacity-0 pointer-events-none`,children:B}),t[37]=B,t[38]=P,t[39]=V):V=t[39];",
      original: remoteProjectMenuTrigger,
    });
  }

  const projectLabelTooltip =
    "Ne=(0,Q.jsx)(nE,{label:n.label,suffix:Ae,suffixEnd:je,suffixTooltipContent:Me}),t[54]=n.label,t[55]=Ae,t[56]=je,t[57]=Me,t[58]=Ne):Ne=t[58];";
  if (source.includes(projectLabelTooltip)) {
    patches.push({
      id: "add_project_path_tooltip_for_local_and_remote_rows",
      start: source.indexOf(projectLabelTooltip),
      end: source.indexOf(projectLabelTooltip) + projectLabelTooltip.length,
      replacement:
        "Ne=(0,Q.jsx)(nE,{label:n.label,labelTooltipContent:n.path??null,suffix:Ae,suffixEnd:je,suffixTooltipContent:Me}),t[54]=n.label,t[55]=Ae,t[56]=je,t[57]=Me,t[58]=Ne):Ne=t[58];",
      original: projectLabelTooltip,
    });
  }

  const remoteProjectLabelTooltip =
    "se=(0,Q.jsx)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:(0,Q.jsx)(nE,{label:T,labelEnd:ae,labelTooltipContent:oe})}),t[65]=T,t[66]=ae,t[67]=oe,t[68]=se):se=t[68];";
  if (source.includes(remoteProjectLabelTooltip)) {
    patches.push({
      id: "add_project_path_tooltip_for_connection_rows",
      start: source.indexOf(remoteProjectLabelTooltip),
      end: source.indexOf(remoteProjectLabelTooltip) + remoteProjectLabelTooltip.length,
      replacement:
        "se=(0,Q.jsx)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:(0,Q.jsx)(nE,{label:T,labelEnd:ae,labelTooltipContent:n.path??null,suffixTooltipContent:oe})}),t[65]=T,t[66]=ae,t[67]=oe,t[68]=se):se=t[68];",
      original: remoteProjectLabelTooltip,
    });
  }

  const labelTooltipComponent =
    "u=o==null?l:(0,Q.jsx)(hs,{delayOpen:!0,tooltipContent:o,children:l}),t[2]=l,t[3]=o,t[4]=u):u=t[4];";
  if (source.includes(labelTooltipComponent)) {
    patches.push({
      id: "make_project_label_tooltips_instant",
      start: source.indexOf(labelTooltipComponent),
      end: source.indexOf(labelTooltipComponent) + labelTooltipComponent.length,
      replacement:
        "u=o==null?l:(0,Q.jsx)(hs,{delayOpen:0,tooltipContent:o,children:l}),t[2]=l,t[3]=o,t[4]=u):u=t[4];",
      original: labelTooltipComponent,
    });
  }

  walk(ast, (node) => {
    if (node.type === "FunctionDeclaration" && node.id?.name === "nC") {
      const original = source.slice(node.start, node.end);
      if (original !== "function nC(e){return null}") {
        patches.push({
          id: "remove_codex_mobile_sidebar_entry",
          start: node.start,
          end: node.end,
          replacement: "function nC(e){return null}",
          original,
        });
      }
      return;
    }

    if (node.type === "CallExpression") {
      if (node.arguments.length >= 2 && node.arguments[0].type === "Identifier") {
        const arg1 = node.arguments[1];
        if (arg1 && arg1.type === "ObjectExpression") {
          const propNames = new Set(arg1.properties.map(getPropName).filter(Boolean));
          if (
            propNames.has("canStartProjectlessChat")
            && propNames.has("newChatMessage")
            && propNames.has("onStartChat")
          ) {
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

    if (node.type === "VariableDeclarator" && node.init) {
      const init = node.init;
      const isMatch = init.type === "ConditionalExpression"
        && isChatsThreadsArray(init.consequent)
        && isChatsThreadsArray(init.alternate);
      if (isMatch) {
        const initSrc = source.slice(node.init.start, node.init.end);
        patches.push({
          id: "remove_chats_section",
          start: node.init.start,
          end: node.init.end,
          replacement: "[`threads`]",
          original: initSrc,
        });
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
  let unresolved = 0;

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
      if (source.includes("function nC(e){return null}")) {
        console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
        continue;
      }
      if (source.includes("className:`pr-0.5`,children:(0,Q.jsx)(M,{className:`h-6 w-6 rounded-md !p-1`") ||
          source.includes("className:`pr-0.5`,children:B}),t[37]=B,t[38]=P,t[39]=V):V=t[39];")) {
        console.log(`  [${target.platform}] [!] project row menu trigger target changed: ${relPath(target.path)}`);
        unresolved += 1;
      } else
      if (source.includes("newChatMessage") && source.includes("onStartChat")) {
        console.log(`  [${target.platform}] [!] sidebar patch targets changed: ${relPath(target.path)}`);
        unresolved += 1;
      } else if (source.includes("sidebarElectron.codexMobileSetupNavLink")) {
        console.log(`  [${target.platform}] [!] codex mobile sidebar target changed: ${relPath(target.path)}`);
        unresolved += 1;
      } else {
        console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      }
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
    if (unresolved > 0) {
      console.log(`  [x] unresolved sidebar layout targets: ${unresolved}`);
      process.exit(1);
    }
    if (patchedCount === 0) {
      console.log("  [ok] sidebar layout already patched");
    } else {
      console.log(`  [ok] applied ${patchedCount} sidebar layout patch(es)`);
    }
  }
}

main();

