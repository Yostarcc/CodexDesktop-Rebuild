#!/usr/bin/env node
/**
 * Post-build patch: move run-location / branch controls into the composer
 * footer middle slot for the current upstream bundle.
 *
 * Contract for inline-composer:
 * - only move the run-location and branch controls themselves
 * - if the current upstream bundle requires a tight immediate wrapper to keep
 *   those two controls working together, preserve only that nearest wrapper
 * - do not rely on hard-coded class names for that wrapper
 * - do not move any higher-level footer/layout wrapper into FooterAction
 *
 * This patch targets the current pristine upstream bundle only.
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
    "let Qt=I===`home`?Zt:Kt,$t=V?.type===`cloud`?qt:null,en=I===`home`?Kt:Zt,tn;t[165]!==Gt||t[166]!==Qt||t[167]!==$t||t[168]!==en?(tn=(0,z.jsxs)(`div`,{className:`flex min-w-0 flex-1 flex-nowrap items-center gap-1`,children:[Gt,Qt,$t,en]}),t[165]=Gt,t[166]=Qt,t[167]=$t,t[168]=en,t[169]=tn):tn=t[169];",
    "let Qt=I===`home`?Zt:Kt,$t=V?.type===`cloud`?qt:null,en=null,tn;t[165]!==Gt||t[166]!==Qt||t[167]!==$t||t[168]!==en?(tn=(0,z.jsxs)(`div`,{className:`flex min-w-0 flex-1 flex-nowrap items-center gap-1`,children:[Gt,Qt,$t,en]}),t[165]=Gt,t[166]=Qt,t[167]=$t,t[168]=en,t[169]=tn):tn=t[169];",
    "hide_non_home_branch_switcher_from_external_footer",
    changes,
  );

  code = replaceOnce(
    code,
    "let p;t[125]!==r||t[126]!==V||t[127]!==qt||t[128]!==K||t[129]!==l||t[130]!==B||t[131]!==m||t[132]!==at||t[133]!==a||t[134]!==ct||t[135]!==s?(p=V?.type===`cloud`?(0,z.jsx)(Ae,{composerMode:r,setComposerMode:a}):(0,z.jsx)(Oe,{composerMode:r,setComposerMode:a,conversationId:at,footerRemoteState:K,disabled:ct,hideModeDropdown:B,allowWorktree:!V&&!m,threadHandoff:l,worktreeLabelOnly:ct,secondaryControls:s,modeAdjacentControl:qt}),t[125]=r,t[126]=V,t[127]=qt,t[128]=K,t[129]=l,t[130]=B,t[131]=m,t[132]=at,t[133]=a,t[134]=ct,t[135]=s,t[136]=p):p=t[136],Kt=p;",
    "let p;t[125]!==r||t[126]!==V||t[127]!==qt||t[128]!==K||t[129]!==l||t[130]!==B||t[131]!==m||t[132]!==at||t[133]!==a||t[134]!==ct||t[135]!==s?(p=V?.type===`cloud`?(0,z.jsx)(Ae,{composerMode:r,setComposerMode:a}):(0,z.jsx)(Oe,{composerMode:r,setComposerMode:a,conversationId:at,footerRemoteState:K,disabled:ct,hideModeDropdown:B,allowWorktree:!V&&!m,threadHandoff:l,worktreeLabelOnly:ct,secondaryControls:s,modeAdjacentControl:qt}),t[125]=r,t[126]=V,t[127]=qt,t[128]=K,t[129]=l,t[130]=B,t[131]=m,t[132]=at,t[133]=a,t[134]=ct,t[135]=s,t[136]=p):p=t[136],Kt=p;if(I===`inline-composer`)return Kt;",
    "inline_composer_returns_run_controls_only",
    changes,
  );

  code = replaceOnce(
    code,
    "Ht=!V&&Pt?(0,z.jsx)(we,{environments:Lt,isLoading:Rt,hasError:zt!=null,selectedConfigPath:Bt,onSelectConfigPath:Vt,onOpenSettings:()=>{if(R==null){Be(`/settings/local-environments`);return}be(Fe,L),Be(ge({workspaceRoot:R}),{state:{hostId:L,returnTo:`${Re.pathname}${Re.search}${Re.hash}`}})}}):null,",
    "Ht=!V&&Pt?(0,z.jsx)(we,{environments:Lt,isLoading:Rt,hasError:zt!=null,hideLabel:!0,selectedConfigPath:Bt,onSelectConfigPath:Vt,onOpenSettings:()=>{if(R==null){Be(`/settings/local-environments`);return}be(Fe,L),Be(ge({workspaceRoot:R}),{state:{hostId:L,returnTo:`${Re.pathname}${Re.search}${Re.hash}`}})}}):null,",
    "hide_worktree_environment_label_in_external_footer",
    changes,
  );

  return code;
}

function patchLocalRemoteDropdown(source, changes) {
  return replaceOnce(
    source,
    "Vt=O===`summary-panel`?(0,Z.jsx)(ot,{disabled:C,icon:(0,Z.jsx)(`span`,{className:`shrink-0`,children:Rt}),label:(0,Z.jsxs)(`span`,{className:`flex min-w-0 items-center gap-1 text-token-foreground`,children:[(0,Z.jsx)(`span`,{className:`min-w-0 truncate`,children:Bt}),C?null:(0,Z.jsx)(fe,{className:`icon-2xs shrink-0 text-token-text-tertiary`})]}),labelClassName:`flex min-w-0 items-center`,title:P.formatMessage($.localRemoteWhereRun)}):(0,Z.jsxs)(se,{size:`composerSm`,color:`ghost`,children:[Rt,(0,Z.jsx)(L,{collapse:`xs`,className:`max-w-40 truncate`,children:Bt}),(0,Z.jsx)(fe,{className:`icon-2xs text-token-input-placeholder-foreground`})]}),t[97]=C,t[98]=P,t[99]=Rt,t[100]=Bt,t[101]=O,t[102]=Vt):Vt=t[102];",
    "Vt=O===`summary-panel`?(0,Z.jsx)(ot,{disabled:C,icon:(0,Z.jsx)(`span`,{className:`shrink-0`,children:Rt}),label:(0,Z.jsxs)(`span`,{className:`flex min-w-0 items-center gap-1 text-token-foreground`,children:[(0,Z.jsx)(`span`,{className:`min-w-0 truncate`,children:Bt}),C?null:(0,Z.jsx)(fe,{className:`icon-2xs shrink-0 text-token-text-tertiary`})]}),labelClassName:`flex min-w-0 items-center`,title:P.formatMessage($.localRemoteWhereRun)}):(0,Z.jsxs)(se,{size:`composerSm`,color:`ghost`,children:[Rt,(0,Z.jsx)(fe,{className:`icon-2xs text-token-input-placeholder-foreground`})]}),t[97]=C,t[98]=P,t[99]=Rt,t[100]=Bt,t[101]=O,t[102]=Vt):Vt=t[102];",
    "hide_run_location_label_in_inline_trigger",
    changes,
  );
}

function patchComposer(source, changes) {
  let code = source;

  code = replaceOnce(
    code,
    "function $h(e){let t=(0,$.c)(155),{addContextButton:n,composerMode:r,composerInput:i,executionTargetHostId:o,isSingleLineLayout:s,hotkeyWindowHomeFooterControls:c,conversationId:l,isAutoContextOn:u,setIsAutoContextOn:d,ideContextStatus:f,hasGoal:p,isGoalActionAvailable:m,isAeonActive:h,aeonStartTarget:g,aeonStatus:_,clearAeon:v,onClearGoal:y,permissionsHostId:b,permissionsCwdOverride:x,submitButtonMode:S,canStopFromEscape:C,isStopTurnConfirmationVisible:w,isResponseInProgress:T,isQueueingEnabled:E,isSubmitting:D,isStopping:O,onStop:k,submitBlockReason:A,disabledReason:j,emptySubmitTooltipNonce:M,intelligenceControlOverride:N,handleSubmit:P,voiceControls:F}=e,",
    "function $h(e){let t=(0,$.c)(156),{addContextButton:n,composerMode:r,composerInput:i,executionTargetHostId:o,isSingleLineLayout:s,hotkeyWindowHomeFooterControls:c,conversationId:l,isAutoContextOn:u,setIsAutoContextOn:d,ideContextStatus:f,hasGoal:p,isGoalActionAvailable:m,isAeonActive:h,aeonStartTarget:g,aeonStatus:_,clearAeon:v,onClearGoal:y,permissionsHostId:b,permissionsCwdOverride:x,submitButtonMode:S,canStopFromEscape:C,isStopTurnConfirmationVisible:w,isResponseInProgress:T,isQueueingEnabled:E,isSubmitting:D,isStopping:O,onStop:k,submitBlockReason:A,disabledReason:j,emptySubmitTooltipNonce:M,intelligenceControlOverride:N,handleSubmit:P,voiceControls:F,inlineFooterControls:Aa}=e,",
    "add_inline_footer_controls_prop",
    changes,
  );

  code = replaceOnce(
    code,
    "t[101]!==r||t[102]!==l||t[103]!==Xe||t[104]!==qe||t[105]!==be||t[106]!==He||t[107]!==c||t[108]!==f||t[109]!==N||t[110]!==u||t[111]!==re||t[112]!==W||t[113]!==xe||t[114]!==tt||t[115]!==Qe||t[116]!==We||t[117]!==ve||t[118]!==d?(nt=W?We:re?qe:(0,Q.jsxs)(ah.Footer,{responsive:!0,spacing:c==null?`default`:`flush`,children:[tt,(0,Q.jsx)(ah.FooterAction,{children:null}),(0,Q.jsxs)(ah.FooterControls,{ref:ve,children:[(0,Q.jsx)(ah.FooterExpandingControls,{children:(0,Q.jsx)(sg,{composerMode:r,hotkeyWindowHomeFooterControls:c,conversationId:l,availableWidth:xe,intelligenceControlOverride:N,ideContext:{isAutoContextOn:u,setIsAutoContextOn:d,status:f}})}),(0,Q.jsxs)(ah.FooterActions,{ref:be,children:[Xe,Qe,He]})]})]}),t[101]=r,t[102]=l,t[103]=Xe,t[104]=qe,t[105]=be,t[106]=He,t[107]=c,t[108]=f,t[109]=N,t[110]=u,t[111]=re,t[112]=W,t[113]=xe,t[114]=tt,t[115]=Qe,t[116]=We,t[117]=ve,t[118]=d,t[119]=nt):nt=t[119];",
    "t[101]!==r||t[102]!==l||t[103]!==Xe||t[104]!==qe||t[105]!==be||t[106]!==He||t[107]!==c||t[108]!==f||t[109]!==N||t[110]!==u||t[111]!==re||t[112]!==W||t[113]!==xe||t[114]!==tt||t[115]!==Qe||t[116]!==We||t[117]!==ve||t[118]!==d||t[155]!==Aa?(nt=W?We:re?qe:(0,Q.jsxs)(ah.Footer,{responsive:!0,spacing:c==null?`default`:`flush`,children:[tt,(0,Q.jsx)(ah.FooterAction,{children:Aa??null}),(0,Q.jsxs)(ah.FooterControls,{ref:ve,children:[(0,Q.jsx)(ah.FooterExpandingControls,{children:(0,Q.jsx)(sg,{composerMode:r,hotkeyWindowHomeFooterControls:c,conversationId:l,availableWidth:xe,intelligenceControlOverride:N,ideContext:{isAutoContextOn:u,setIsAutoContextOn:d,status:f}})}),(0,Q.jsxs)(ah.FooterActions,{ref:be,children:[Xe,Qe,He]})]})]}),t[101]=r,t[102]=l,t[103]=Xe,t[104]=qe,t[105]=be,t[106]=He,t[107]=c,t[108]=f,t[109]=N,t[110]=u,t[111]=re,t[112]=W,t[113]=xe,t[114]=tt,t[115]=Qe,t[116]=We,t[117]=ve,t[118]=d,t[119]=nt,t[155]=Aa):nt=t[119];",
    "render_inline_footer_controls_in_middle_slot",
    changes,
  );

  code = replaceOnce(
    code,
    "(0,Q.jsx)($h,{addContextButton:Il,composerMode:jr,composerInput:Fl,executionTargetHostId:yi,isSingleLineLayout:xc,hotkeyWindowHomeFooterControls:y,conversationId:W,isAutoContextOn:sa,setIsAutoContextOn:aa,ideContextStatus:ca,hasGoal:Bi,isGoalActionAvailable:Ii,isAeonActive:!1,aeonStartTarget:Li??void 0,aeonStatus:void 0,clearAeon:void 0,onClearGoal:Lc,permissionsHostId:Hi,permissionsCwdOverride:Ui,submitButtonMode:Ms,canStopFromEscape:Ps,isStopTurnConfirmationVisible:Uo,isResponseInProgress:f,isQueueingEnabled:zi,isSubmitting:Y,isStopping:D,onStop:Ho,submitBlockReason:Es,disabledReason:Ds,emptySubmitTooltipNonce:Ro,intelligenceControlOverride:void 0,handleSubmit:e=>lc({...e,focusComposerAfterSubmit:!0}),voiceControls:gc})",
    "(0,Q.jsx)($h,{addContextButton:Il,composerMode:jr,composerInput:Fl,executionTargetHostId:yi,isSingleLineLayout:xc,hotkeyWindowHomeFooterControls:y,conversationId:W,isAutoContextOn:sa,setIsAutoContextOn:aa,ideContextStatus:ca,hasGoal:Bi,isGoalActionAvailable:Ii,isAeonActive:!1,aeonStartTarget:Li??void 0,aeonStatus:void 0,clearAeon:void 0,onClearGoal:Lc,permissionsHostId:Hi,permissionsCwdOverride:Ui,submitButtonMode:Ms,canStopFromEscape:Ps,isStopTurnConfirmationVisible:Uo,isResponseInProgress:f,isQueueingEnabled:zi,isSubmitting:Y,isStopping:D,onStop:Ho,submitBlockReason:Es,disabledReason:Ds,emptySubmitTooltipNonce:Ro,intelligenceControlOverride:void 0,handleSubmit:e=>lc({...e,focusComposerAfterSubmit:!0}),voiceControls:gc,inlineFooterControls:(0,Q.jsx)(ug,{...ml,variant:`inline-composer`})})",
    "pass_inline_footer_controls_to_footer",
    changes,
  );

  code = replaceOnce(
    code,
    "v===`multiline`?(0,Q.jsx)(ah.ExternalFooterSlot,{isVisible:Ye,variant:k,children:(0,Q.jsx)(ug,{...ml})}):null,",
    "v===`multiline`&&k===`home`?(0,Q.jsx)(ah.ExternalFooterSlot,{isVisible:Ye,variant:k,children:(0,Q.jsx)(ug,{...ml})}):null,",
    "keep_external_footer_slot_for_home_only",
    changes,
  );

  return code;
}

function patchSource(source, filename) {
  const changes = [];
  let code = source;

  if (/^composer-external-footer-.*\.js$/.test(filename)) {
    code = patchComposerExternalFooter(code, changes);
  }
  if (/^local-remote-dropdown-.*\.js$/.test(filename)) {
    code = patchLocalRemoteDropdown(code, changes);
  }
  if (/^composer-.*\.js$/.test(filename) && source.includes("function $h(e){")) {
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
        /^composer-external-footer-.*\.js$/.test(file) ||
        /^local-remote-dropdown-.*\.js$/.test(file)
      ) {
        targets.push({ platform: plat, path: path.join(dir, file) });
        continue;
      }
      if (!/^composer-.*\.js$/.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (source.includes("function $h(e){") && source.includes("ah.ExternalFooterSlot")) {
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
