#!/usr/bin/env node
/**
 * Post-build patch:
 * - remove the top "New chat" action item from sidebar nav
 * - make per-project hover actions collapse to zero width while hidden
 *
 * This keeps the existing sidebar structure and reuses the current hover/dropdown
 * behavior with the smallest possible string-level bundle patch.
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

  const literalReplacements = [
    {
      id: "project_row_track_hover_state",
      from: "let ie=re,[ae,oe]=(0,$.useState)(!1),se=n.projectKind===`remote`&&n.hostId==null,ce;",
      to: "let ie=re,[ae,oe]=(0,$.useState)(!1),[__projectRowHovered,__setProjectRowHovered]=(0,$.useState)(!1),se=n.projectKind===`remote`&&n.hostId==null,ce;",
    },
    {
      id: "project_row_pass_hover_state",
      from: "workspaceDropdownOpen:ae,onWorkspaceDropdownOpenChange:oe,showProjectPinAction:l})",
      to: "workspaceDropdownOpen:ae,onWorkspaceDropdownOpenChange:oe,showProjectPinAction:l,isRowHovered:__projectRowHovered})",
    },
    {
      id: "project_row_bind_hover_handlers",
      from: "onContextMenu:xe,\"aria-label\":S,\"aria-current\":Se,\"aria-expanded\":Ce,children:[Le,He,Ue]}),",
      to: "onContextMenu:xe,onMouseEnter:()=>{__setProjectRowHovered(!0)},onMouseLeave:()=>{__setProjectRowHovered(!1)},\"aria-label\":S,\"aria-current\":Se,\"aria-expanded\":Ce,children:[Le,He,Ue]}),",
    },
    {
      id: "project_actions_use_hover_state",
      from: "function mE(e){let t=(0,Z.c)(49),{group:n,threadKeys:r,collapsedStatusState:i,projectHeaderMenuKind:a,canCreateStableWorktree:o,onStartNewThread:s,onShowProjectHome:c,newThreadLabel:l,canStartNewThread:u,newThreadDisabledLabel:d,workspaceDropdownOpen:f,onWorkspaceDropdownOpenChange:p,showProjectPinAction:m}=e,h=J(Fo),g=J(Pp),_=J(Wp),v=f?`opacity-100`:`opacity-0 group-hover/folder-row:opacity-100`,y;",
      to: "function mE(e){let t=(0,Z.c)(49),{group:n,threadKeys:r,collapsedStatusState:i,projectHeaderMenuKind:a,canCreateStableWorktree:o,onStartNewThread:s,onShowProjectHome:c,newThreadLabel:l,canStartNewThread:u,newThreadDisabledLabel:d,workspaceDropdownOpen:f,onWorkspaceDropdownOpenChange:p,showProjectPinAction:m,isRowHovered:h0}=e,h=J(Fo),g=J(Pp),_=J(Wp),v=h0||f?`opacity-100`:`opacity-0`,y;",
    },
    {
      id: "project_local_menu_zero_width_when_hidden",
      from: "y=a===`local`&&(0,Q.jsx)(`div`,{className:v,children:(0,Q.jsx)(xE,{project:n,threadKeys:r,currentThreadKey:h,canCreateStableWorktree:o,workspaceRootOptions:g,workspaceRootLabels:_,onArchivedCurrentThread:c,open:f,onOpenChange:p,showProjectPinAction:m})})",
      to: "y=a===`local`&&(0,Q.jsx)(`div`,{style:h0||f?void 0:{width:0,overflow:`hidden`,pointerEvents:`none`},className:v,children:(0,Q.jsx)(xE,{project:n,threadKeys:r,currentThreadKey:h,canCreateStableWorktree:o,workspaceRootOptions:g,workspaceRootLabels:_,onArchivedCurrentThread:c,open:f,onOpenChange:p,showProjectPinAction:m})})",
    },
    {
      id: "project_remote_menu_zero_width_when_hidden",
      from: "b=a===`remote`&&n.path!=null&&(0,Q.jsx)(`div`,{className:v,children:(0,Q.jsx)(wE,{hostId:n.hostId,projectId:n.projectId,remotePath:n.path,groupLabel:n.label,threadKeys:r,currentThreadKey:h,onArchivedCurrentThread:c,open:f,onOpenChange:p,showProjectPinAction:m})})",
      to: "b=a===`remote`&&n.path!=null&&(0,Q.jsx)(`div`,{style:h0||f?void 0:{width:0,overflow:`hidden`,pointerEvents:`none`},className:v,children:(0,Q.jsx)(wE,{hostId:n.hostId,projectId:n.projectId,remotePath:n.path,groupLabel:n.label,threadKeys:r,currentThreadKey:h,onArchivedCurrentThread:c,open:f,onOpenChange:p,showProjectPinAction:m})})",
    },
    {
      id: "project_new_thread_zero_width_when_hidden",
      from: "D=(0,Q.jsx)(`span`,{className:S,children:E})",
      to: "D=(0,Q.jsx)(`span`,{style:h0||f?void 0:{width:0,overflow:`hidden`,pointerEvents:`none`},className:S,children:E})",
    },
    {
      id: "project_status_slot_zero_width_without_status_or_hover",
      from: "k=(0,Q.jsxs)(`div`,{className:`relative mr-0.5 h-6 w-6 shrink-0`,children:[x,O]})",
      to: "k=h0||f||i!=null?(0,Q.jsxs)(`div`,{className:`relative mr-0.5 h-6 w-6 shrink-0`,children:[x,O]}):(0,Q.jsx)(`div`,{style:{width:0,overflow:`hidden`}})",
    },
  ];

  for (const replacement of literalReplacements) {
    const { id, from, to } = replacement;
    if (source.includes(to)) continue;
    const start = source.indexOf(from);
    if (start === -1) continue;
    patches.push({
      id,
      start,
      end: start + from.length,
      replacement: to,
      original: from,
    });
  }

  walk(ast, (node) => {
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
      if (source.includes("newChatMessage") && source.includes("onStartChat")) {
        console.log(`  [${target.platform}] [!] sidebar patch targets changed: ${relPath(target.path)}`);
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

