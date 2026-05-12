#!/usr/bin/env node
/**
 * Post-build patch: reveal the hidden View-menu command group above
 * "Toggle Sidebar" in the Windows/macOS custom title-bar menu.
 *
 * Root cause:
 * - The leading command group in the View menu is intentionally hidden
 *   with `visible: !1`.
 * - The user wants those commands shown instead of trimming the separator.
 *
 * We:
 * - reveal only the specific thread/view actions requested by the user
 * - keep the separator before "Toggle Sidebar"
 * - leave later hidden browser/debug items untouched
 */
const fs = require("fs");
const { locateBundles, relPath } = require("./patch-util");

const RULES = [
  {
    id: "show_open_command_menu_default",
    from: "I={...y(`openCommandMenu`),acceleratorWorksWhenHidden:!0,visible:!1,click:async()=>{await O()}}",
    to: "I={...y(`openCommandMenu`),acceleratorWorksWhenHidden:!0,click:async()=>{await O()}}",
  },
  {
    id: "show_search_files",
    from: "ae={...y(`searchFiles`),acceleratorWorksWhenHidden:!0,visible:!1,click:k}",
    to: "ae={...y(`searchFiles`),acceleratorWorksWhenHidden:!0,click:k}",
  },
  {
    id: "show_search_chats",
    from: "oe={...y(`searchChats`),acceleratorWorksWhenHidden:!0,visible:!1,click:A}",
    to: "oe={...y(`searchChats`),acceleratorWorksWhenHidden:!0,click:A}",
  },
  {
    id: "show_toggle_thread_pin",
    from: "le={...y(`toggleThreadPin`),acceleratorWorksWhenHidden:!0,visible:!1,click:P}",
    to: "le={...y(`toggleThreadPin`),acceleratorWorksWhenHidden:!0,click:P}",
  },
  {
    id: "show_rename_thread",
    from: "ue={...y(`renameThread`),acceleratorWorksWhenHidden:!0,visible:!1,click:ee}",
    to: "ue={...y(`renameThread`),acceleratorWorksWhenHidden:!0,click:ee}",
  },
  {
    id: "show_archive_thread",
    from: "de={...y(`archiveThread`),acceleratorWorksWhenHidden:!0,visible:!1,click:te}",
    to: "de={...y(`archiveThread`),acceleratorWorksWhenHidden:!0,click:te}",
  },
  {
    id: "show_copy_working_directory",
    from: "fe={...y(`copyWorkingDirectory`),acceleratorWorksWhenHidden:!0,visible:!1,click:F}",
    to: "fe={...y(`copyWorkingDirectory`),acceleratorWorksWhenHidden:!0,click:F}",
  },
  {
    id: "show_copy_session_id",
    from: "pe={...y(`copySessionId`),acceleratorWorksWhenHidden:!0,visible:!1,click:ne}",
    to: "pe={...y(`copySessionId`),acceleratorWorksWhenHidden:!0,click:ne}",
  },
  {
    id: "show_copy_deeplink",
    from: "me={...y(`copyDeeplink`),acceleratorWorksWhenHidden:!0,visible:!1,click:re}",
    to: "me={...y(`copyDeeplink`),acceleratorWorksWhenHidden:!0,click:re}",
  },
];

const SEPARATOR_FROM = "me,ge,_e,ve";
const SEPARATOR_TO = "me,{type:`separator`},ge,_e,ve";

const REHIDE_RULES = [
  {
    id: "rehide_open_command_menu_empty_query",
    from: "ie={...y(`openCommandMenu`,1),acceleratorWorksWhenHidden:!0,click:async()=>{await O(``)}}",
    to: "ie={...y(`openCommandMenu`,1),acceleratorWorksWhenHidden:!0,visible:!1,click:async()=>{await O(``)}}",
  },
  {
    id: "rehide_hidden_run_commands",
    from: "se=t.bn.map(e=>({...y(e),acceleratorWorksWhenHidden:!0,click:async()=>{await j(e)}}))",
    to: "se=t.bn.map(e=>({...y(e),acceleratorWorksWhenHidden:!0,visible:!1,click:async()=>{await j(e)}}))",
  },
  {
    id: "rehide_copy_conversation_path",
    from: "ce={...y(`copyConversationPath`),acceleratorWorksWhenHidden:!0,click:N}",
    to: "ce={...y(`copyConversationPath`),acceleratorWorksWhenHidden:!0,visible:!1,click:N}",
  },
];

function patchSource(source) {
  const changes = [];
  let code = source;

  for (const rule of REHIDE_RULES) {
    if (code.includes(rule.to)) continue;
    if (!code.includes(rule.from)) continue;
    code = code.replace(rule.from, rule.to);
    changes.push(rule.id);
  }

  for (const rule of RULES) {
    if (code.includes(rule.to)) continue;
    if (!code.includes(rule.from)) continue;
    code = code.replace(rule.from, rule.to);
    changes.push(rule.id);
  }

  if (!code.includes(SEPARATOR_TO) && code.includes(SEPARATOR_FROM)) {
    code = code.replace(SEPARATOR_FROM, SEPARATOR_TO);
    changes.push("restore_separator_before_toggle_sidebar");
  }

  return { code, changes };
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateBundles({
    dir: "build",
    pattern: /^main-.*\.js$/,
    platform,
  });

  if (targets.length === 0) {
    console.log("  [skip] No main build bundle found");
    return;
  }

  let changedFiles = 0;
  let changedRules = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const { code, changes } = patchSource(source);

    if (changes.length === 0) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    for (const id of changes) console.log(`    * ${id}`);

    if (!isCheck) {
      fs.writeFileSync(target.path, code, "utf-8");
    }

    changedFiles += 1;
    changedRules += changes.length;
  }

  if (!isCheck) {
    if (changedFiles === 0) {
      console.log("  [ok] view-menu separator patch already applied");
    } else {
      console.log(`  [ok] patched ${changedRules} change(s) in ${changedFiles} file(s)`);
    }
  }
}

main();
