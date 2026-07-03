#!/usr/bin/env node
/**
 * Move run-location / branch controls into ComposerFooter's FooterAction slot.
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

function replaceOnce(source, from, to, id, changes) {
  if (source.includes(to)) return source;
  const idx = source.indexOf(from);
  if (idx === -1) return source;
  changes.push(id);
  return source.slice(0, idx) + to + source.slice(idx + from.length);
}

function patchComposerExternalFooter(source, changes) {
  let code = source;

  code = replaceOnce(
    code,
    "let Se=xe,Ce=!!(pe||ue||Y||P),we=n===`home`?O:null,Te=me?Se:null,R=n===`default`?O:null,Ee;",
    "let Se=xe;if(n===`inline-composer`){Rt=Se;break bb0}let Ce=!!(pe||ue||Y||P),we=n===`home`?O:null,Te=n===`home`?null:me?Se:null,R=n===`default`?O:null,Ee;",
    "inline_composer_returns_run_controls_only",
    changes,
  );

  code = replaceOnce(
    code,
    "let De=Ee,Oe=me?x:null,Ae=me?ye:null,z;",
    "let De=Ee,Oe=n===`home`?null:me?x:null,Ae=n===`home`?null:me?ye:null,z;",
    "hide_home_run_controls_scroll_layout",
    changes,
  );

  code = replaceOnce(
    code,
    "Q=!A&&Ot?(0,$.jsx)(ft,{environments:Mt,isLoading:X,hasError:Z!=null,selectedConfigPath:Nt,onSelectConfigPath:Ft,onOpenSettings:()=>{Xe(D,c),k(Ge({workspaceRoot:l}),{state:{hostId:c,returnTo:`${O.pathname}${O.search}${O.hash}`}})}}):null,",
    "Q=!A&&Ot?(0,$.jsx)(ft,{environments:Mt,isLoading:X,hasError:Z!=null,labelClassName:`hidden`,selectedConfigPath:Nt,onSelectConfigPath:Ft,onOpenSettings:()=>{Xe(D,c),k(Ge({workspaceRoot:l}),{state:{hostId:c,returnTo:`${O.pathname}${O.search}${O.hash}`}})}}):null,",
    "hide_worktree_environment_label_in_external_footer",
    changes,
  );

  return code;
}

function patchLocalRemoteDropdown(source, changes) {
  return replaceOnce(
    source,
    "value:Et,valueClassName:`max-w-40`",
    "value:null,valueClassName:`max-w-40`",
    "hide_run_location_label_in_inline_trigger",
    changes,
  );
}

function patchComposer(source, changes) {
  let code = source;

  code = replaceOnce(
    code,
    "function gD({addContextButton:e,composerMode:t,composerInput:n,executionTargetHostId:r,isSingleLineLayout:i,hotkeyWindowHomeFooterControls:a,isAutoContextOn:o,ideContextStatus:s,hasMessageContent:c,hasGoal:u,isEasterEggEnabled:d,isAeonActive:f=!1,clearAeon:p,onClearGoal:m,permissionsHostId:h,permissionsCwdOverride:g,submitButtonMode:_,canStopFromEscape:y,isStopTurnConfirmationVisible:b,isResponseInProgress:x,isQueueingEnabled:S,isSubmitting:C,isStopping:w,onStop:T,submitBlockReason:E,disabledReason:D,emptySubmitTooltipNonce:O,handleSubmit:k,voiceControls:A}){",
    "function gD({addContextButton:e,composerMode:t,composerInput:n,executionTargetHostId:r,isSingleLineLayout:i,hotkeyWindowHomeFooterControls:a,isAutoContextOn:o,ideContextStatus:s,hasMessageContent:c,hasGoal:u,isEasterEggEnabled:d,isAeonActive:f=!1,clearAeon:p,onClearGoal:m,permissionsHostId:h,permissionsCwdOverride:g,submitButtonMode:_,canStopFromEscape:y,isStopTurnConfirmationVisible:b,isResponseInProgress:x,isQueueingEnabled:S,isSubmitting:C,isStopping:w,onStop:T,submitBlockReason:E,disabledReason:D,emptySubmitTooltipNonce:O,handleSubmit:k,voiceControls:A,inlineFooterControls:_inlineFooterControls}){",
    "add_inline_footer_controls_prop",
    changes,
  );

  code = replaceOnce(
    code,
    "(0,Q.jsx)(aE.FooterAction,{children:null})",
    "(0,Q.jsx)(aE.FooterAction,{children:_inlineFooterControls??null})",
    "render_inline_footer_controls_in_middle_slot",
    changes,
  );

  code = replaceOnce(
    code,
    "(0,EF.jsx)(gD,{addContextButton:El,composerMode:_r,composerInput:Tl,executionTargetHostId:Ar,isSingleLineLayout:Tc,hotkeyWindowHomeFooterControls:g,isAutoContextOn:Ni,ideContextStatus:Pi,hasMessageContent:ls,hasGoal:Jr,isEasterEggEnabled:pe,isAeonActive:!1,clearAeon:void 0,onClearGoal:Rc,permissionsHostId:$r,permissionsCwdOverride:ti,submitButtonMode:Gs,canStopFromEscape:Ks,isStopTurnConfirmationVisible:Ko,isResponseInProgress:s,isQueueingEnabled:qr,isSubmitting:Nt,isStopping:C,onStop:Ho,submitBlockReason:Hs,disabledReason:Us,emptySubmitTooltipNonce:vo,handleSubmit:e=>mc({...e,focusComposerAfterSubmit:!0}),voiceControls:bc})",
    "(0,EF.jsx)(gD,{addContextButton:El,composerMode:_r,composerInput:Tl,executionTargetHostId:Ar,isSingleLineLayout:Tc,hotkeyWindowHomeFooterControls:g,isAutoContextOn:Ni,ideContextStatus:Pi,hasMessageContent:ls,hasGoal:Jr,isEasterEggEnabled:pe,isAeonActive:!1,clearAeon:void 0,onClearGoal:Rc,permissionsHostId:$r,permissionsCwdOverride:ti,submitButtonMode:Gs,canStopFromEscape:Ks,isStopTurnConfirmationVisible:Ko,isResponseInProgress:s,isQueueingEnabled:qr,isSubmitting:Nt,isStopping:C,onStop:Ho,submitBlockReason:Hs,disabledReason:Us,emptySubmitTooltipNonce:vo,handleSubmit:e=>mc({...e,focusComposerAfterSubmit:!0}),voiceControls:bc,inlineFooterControls:(0,EF.jsx)(OD,{...ll,variant:`inline-composer`})})",
    "pass_inline_footer_controls_to_footer",
    changes,
  );

  code = replaceOnce(
    code,
    "h===`multiline`?(0,EF.jsx)(aE.ExternalFooterSlot,{isVisible:Ue,variant:E,children:(0,EF.jsx)(OD,{...ll})}):null,",
    "h===`multiline`&&E===`home`?(0,EF.jsx)(aE.ExternalFooterSlot,{isVisible:Ue,variant:E,children:(0,EF.jsx)(OD,{...ll})}):null,",
    "keep_external_footer_slot_for_home_only",
    changes,
  );

  return code;
}

function patchSource(source, filename) {
  const changes = [];
  let code = source;

  if (/^composer-external-footer-(?!item).*\.js$/.test(filename)) {
    code = patchComposerExternalFooter(code, changes);
  }
  if (/^local-remote-dropdown-.*\.js$/.test(filename)) {
    code = patchLocalRemoteDropdown(code, changes);
  }
  if (/^composer-.*\.js$/.test(filename) && source.includes("function gD({")) {
    code = patchComposer(code, changes);
  }

  return { code, changes };
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
      if (
        /^composer-external-footer-(?!item).*\.js$/.test(file) ||
        /^local-remote-dropdown-.*\.js$/.test(file)
      ) {
        targets.push({ platform: plat, path: path.join(dir, file) });
        continue;
      }
      if (!/^composer-.*\.js$/.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (source.includes("function gD({") && source.includes("aE.ExternalFooterSlot")) {
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
    console.log("  [skip] No composer run-control targets found");
    return;
  }

  let changedFiles = 0;
  let changedRules = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const { code, changes } = patchSource(source, path.basename(target.path));

    if (changes.length === 0) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    for (const id of changes) console.log(`    * ${id}`);
    if (!isCheck) fs.writeFileSync(target.path, code, "utf-8");
    changedFiles += 1;
    changedRules += changes.length;
  }

  if (!isCheck) {
    if (changedFiles === 0) {
      console.log("  [ok] composer run controls already patched");
    } else {
      console.log(`  [ok] patched ${changedRules} change(s) in ${changedFiles} file(s)`);
    }
  }
}

main();
