#!/usr/bin/env node
/**
 * Post-build patch: move run-location / branch controls into the composer
 * footer middle slot for the current upstream bundle.
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
    "let Gt=L===`home`?Wt:zt,Kt=H?.type===`cloud`?Bt:null,qt=L===`home`?zt:Wt,Jt;o[160]!==Gt||o[161]!==Kt||o[162]!==qt?(Jt=(0,z.jsxs)(`div`,{className:`flex min-w-0 flex-1 flex-nowrap items-center gap-1`,children:[Gt,Kt,qt]}),o[160]=Gt,o[161]=Kt,o[162]=qt,o[163]=Jt):Jt=o[163];",
    "let Gt=L===`home`?Wt:zt,Kt=H?.type===`cloud`?Bt:null,qt=L===`home`?null:Wt,Jt;o[160]!==Gt||o[161]!==Kt||o[162]!==qt?(Jt=(0,z.jsxs)(`div`,{className:`flex min-w-0 flex-1 flex-nowrap items-center gap-1`,children:[Gt,Kt,qt]}),o[160]=Gt,o[161]=Kt,o[162]=qt,o[163]=Jt):Jt=o[163];",
    "hide_non_home_branch_switcher_from_external_footer",
    changes,
  );

  code = replaceOnce(
    code,
    "let p;o[122]!==d||o[123]!==H||o[124]!==Bt||o[125]!==q||o[126]!==c||o[127]!==R||o[128]!==S||o[129]!==Ze||o[130]!==_||o[131]!==et||o[132]!==a?(p=H?.type===`cloud`?(0,z.jsx)(Ee,{composerMode:d,setComposerMode:_}):(0,z.jsx)(we,{composerMode:d,setComposerMode:_,conversationId:Ze,footerRemoteState:q,disabled:et,hideModeDropdown:R,allowWorktree:!H&&!S,threadHandoff:c,worktreeLabelOnly:et,secondaryControls:a,modeAdjacentControl:Bt}),o[122]=d,o[123]=H,o[124]=Bt,o[125]=q,o[126]=c,o[127]=R,o[128]=S,o[129]=Ze,o[130]=_,o[131]=et,o[132]=a,o[133]=p):p=o[133],zt=p;",
    "let p;o[122]!==d||o[123]!==H||o[124]!==Bt||o[125]!==q||o[126]!==c||o[127]!==R||o[128]!==S||o[129]!==Ze||o[130]!==_||o[131]!==et||o[132]!==a?(p=H?.type===`cloud`?(0,z.jsx)(Ee,{composerMode:d,setComposerMode:_}):(0,z.jsx)(we,{composerMode:d,setComposerMode:_,conversationId:Ze,footerRemoteState:q,disabled:et,hideModeDropdown:R,allowWorktree:!H&&!S,threadHandoff:c,worktreeLabelOnly:et,secondaryControls:a,modeAdjacentControl:Bt}),o[122]=d,o[123]=H,o[124]=Bt,o[125]=q,o[126]=c,o[127]=R,o[128]=S,o[129]=Ze,o[130]=_,o[131]=et,o[132]=a,o[133]=p):p=o[133],zt=p;if(L===`inline-composer`)return zt;",
    "inline_composer_returns_run_controls_only",
    changes,
  );

  code = replaceOnce(
    code,
    "Ft=!H&&Dt?(0,z.jsx)(ye,{environments:At,isLoading:jt,hasError:Mt!=null,selectedConfigPath:Nt,onSelectConfigPath:Pt,onOpenSettings:()=>{V(`/settings/local-environments`)}}):null,",
    "Ft=!H&&Dt?(0,z.jsx)(ye,{environments:At,isLoading:jt,hasError:Mt!=null,hideLabel:!0,selectedConfigPath:Nt,onSelectConfigPath:Pt,onOpenSettings:()=>{V(`/settings/local-environments`)}}):null,",
    "hide_worktree_environment_label_in_external_footer",
    changes,
  );

  return code;
}

function patchLocalRemoteDropdown(source, changes) {
  return replaceOnce(
    source,
    "Rt=D===`summary-panel`?(0,Z.jsx)(at,{disabled:x,icon:(0,Z.jsx)(`span`,{className:`shrink-0`,children:Ft}),label:(0,Z.jsxs)(`span`,{className:`flex min-w-0 items-center gap-1 text-token-foreground`,children:[(0,Z.jsx)(`span`,{className:`min-w-0 truncate`,children:Lt}),x?null:(0,Z.jsx)(He,{className:`icon-2xs shrink-0 text-token-text-tertiary`})]}),labelClassName:`flex min-w-0 items-center`,title:I.formatMessage($.localRemoteWhereRun)}):(0,Z.jsxs)(de,{size:`composerSm`,color:`ghost`,children:[Ft,(0,Z.jsx)(be,{collapse:`xs`,className:`max-w-40 truncate`,children:Lt}),(0,Z.jsx)(He,{className:`icon-2xs text-token-input-placeholder-foreground`})]}),t[90]=x,t[91]=I,t[92]=Ft,t[93]=Lt,t[94]=D,t[95]=Rt):Rt=t[95];",
    "Rt=D===`summary-panel`?(0,Z.jsx)(at,{disabled:x,icon:(0,Z.jsx)(`span`,{className:`shrink-0`,children:Ft}),label:(0,Z.jsxs)(`span`,{className:`flex min-w-0 items-center gap-1 text-token-foreground`,children:[(0,Z.jsx)(`span`,{className:`min-w-0 truncate`,children:Lt}),x?null:(0,Z.jsx)(He,{className:`icon-2xs shrink-0 text-token-text-tertiary`})]}),labelClassName:`flex min-w-0 items-center`,title:I.formatMessage($.localRemoteWhereRun)}):(0,Z.jsxs)(de,{size:`composerSm`,color:`ghost`,children:[Ft,(0,Z.jsx)(He,{className:`icon-2xs text-token-input-placeholder-foreground`})]}),t[90]=x,t[91]=I,t[92]=Ft,t[93]=Lt,t[94]=D,t[95]=Rt):Rt=t[95];",
    "hide_run_location_label_in_inline_trigger",
    changes,
  );
}

function patchComposer(source, changes) {
  let code = source;

  code = replaceOnce(
    code,
    "function Xm(e){let t=(0,$.c)(143),{addContextButton:n,composerMode:r,composerInput:i,isSingleLineLayout:a,hotkeyWindowHomeFooterControls:o,conversationId:s,isAutoContextOn:c,setIsAutoContextOn:l,ideContextStatus:u,hasGoal:d,isGoalActionAvailable:f,onClearGoal:p,permissionsHostId:m,permissionsCwdOverride:h,submitButtonMode:g,canStopFromEscape:_,isStopTurnConfirmationVisible:v,isResponseInProgress:y,isQueueingEnabled:b,isSubmitting:x,isStopping:S,onStop:C,submitBlockReason:w,disabledReason:T,emptySubmitTooltipNonce:E,intelligenceControlOverride:D,handleSubmit:O,voiceControls:k}=e;",
    "function Xm(e){let t=(0,$.c)(143),{addContextButton:n,composerMode:r,composerInput:i,isSingleLineLayout:a,hotkeyWindowHomeFooterControls:o,conversationId:s,isAutoContextOn:c,setIsAutoContextOn:l,ideContextStatus:u,hasGoal:d,isGoalActionAvailable:f,onClearGoal:p,permissionsHostId:m,permissionsCwdOverride:h,submitButtonMode:g,canStopFromEscape:_,isStopTurnConfirmationVisible:v,isResponseInProgress:y,isQueueingEnabled:b,isSubmitting:x,isStopping:S,onStop:C,submitBlockReason:w,disabledReason:T,emptySubmitTooltipNonce:E,intelligenceControlOverride:D,handleSubmit:O,voiceControls:k,inlineFooterControls:Aa}=e;",
    "add_inline_footer_controls_prop",
    changes,
  );

  code = replaceOnce(
    code,
    "Xe=re?Re:L?Ve:(0,Q.jsxs)(Qp.Footer,{responsive:!0,spacing:o==null?`default`:`flush`,children:[Ye,(0,Q.jsx)(Qp.FooterAction,{children:r===`cloud`?(0,Q.jsx)(Bp,{}):null}),(0,Q.jsxs)(Qp.FooterControls,{ref:he,children:[(0,Q.jsx)(Qp.FooterExpandingControls,{children:(0,Q.jsx)(ih,{composerMode:r,hotkeyWindowHomeFooterControls:o,conversationId:s,availableWidth:_e,intelligenceControlOverride:D,ideContext:{isAutoContextOn:c,setIsAutoContextOn:l,status:u}})}),(0,Q.jsxs)(Qp.FooterActions,{ref:ge,children:[We,Ke,Ie]})]})]}),t[92]=r,t[93]=s,t[94]=We,t[95]=Ve,t[96]=ge,t[97]=Ie,t[98]=o,t[99]=u,t[100]=D,t[101]=c,t[102]=L,t[103]=re,t[104]=_e,t[105]=Ye,t[106]=Re,t[107]=he,t[108]=l,t[109]=Xe):Xe=t[109];",
    "Xe=re?Re:L?Ve:(0,Q.jsxs)(Qp.Footer,{responsive:!0,spacing:o==null?`default`:`flush`,children:[Ye,(0,Q.jsx)(Qp.FooterAction,{children:Aa??(r===`cloud`?(0,Q.jsx)(Bp,{}):null)}),(0,Q.jsxs)(Qp.FooterControls,{ref:he,children:[(0,Q.jsx)(Qp.FooterExpandingControls,{children:(0,Q.jsx)(ih,{composerMode:r,hotkeyWindowHomeFooterControls:o,conversationId:s,availableWidth:_e,intelligenceControlOverride:D,ideContext:{isAutoContextOn:c,setIsAutoContextOn:l,status:u}})}),(0,Q.jsxs)(Qp.FooterActions,{ref:ge,children:[We,Ke,Ie]})]})]}),t[92]=r,t[93]=s,t[94]=We,t[95]=Ve,t[96]=ge,t[97]=Ie,t[98]=o,t[99]=u,t[100]=D,t[101]=c,t[102]=L,t[103]=re,t[104]=_e,t[105]=Ye,t[106]=Re,t[107]=he,t[108]=l,t[109]=Xe):Xe=t[109];",
    "render_inline_footer_controls_in_middle_slot",
    changes,
  );

  code = replaceOnce(
    code,
    "Xm,{addContextButton:dl,composerMode:X,composerInput:ul,executionTargetHostId:Ti,isSingleLineLayout:rc,hotkeyWindowHomeFooterControls:T,conversationId:H,isAutoContextOn:la,setIsAutoContextOn:sa,ideContextStatus:ua,hasGoal:Bi,isGoalActionAvailable:zi,onClearGoal:vc,permissionsHostId:Hi,permissionsCwdOverride:Ui,submitButtonMode:us,canStopFromEscape:ds,isStopTurnConfirmationVisible:Ao,isResponseInProgress:g,isQueueingEnabled:bn,isSubmitting:$t,isStopping:j,onStop:ko,submitBlockReason:os,disabledReason:ss,emptySubmitTooltipNonce:Co,intelligenceControlOverride:void 0,handleSubmit:e=>Bs({...e,focusComposerAfterSubmit:!0}),voiceControls:qs}",
    "Xm,{addContextButton:dl,composerMode:X,composerInput:ul,executionTargetHostId:Ti,isSingleLineLayout:rc,hotkeyWindowHomeFooterControls:T,conversationId:H,isAutoContextOn:la,setIsAutoContextOn:sa,ideContextStatus:ua,hasGoal:Bi,isGoalActionAvailable:zi,onClearGoal:vc,permissionsHostId:Hi,permissionsCwdOverride:Ui,submitButtonMode:us,canStopFromEscape:ds,isStopTurnConfirmationVisible:Ao,isResponseInProgress:g,isQueueingEnabled:bn,isSubmitting:$t,isStopping:j,onStop:ko,submitBlockReason:os,disabledReason:ss,emptySubmitTooltipNonce:Co,intelligenceControlOverride:void 0,handleSubmit:e=>Bs({...e,focusComposerAfterSubmit:!0}),voiceControls:qs,inlineFooterControls:(0,Q.jsx)(sh,{...Uc,variant:`inline-composer`})}",
    "pass_inline_footer_controls_to_footer",
    changes,
  );

  code = replaceOnce(
    code,
    "S===`multiline`?(0,Q.jsx)(Qp.ExternalFooterSlot,{isVisible:Ze,variant:N,children:(0,Q.jsx)(sh,{...Uc})}):null,",
    "S===`multiline`&&N===`home`?(0,Q.jsx)(Qp.ExternalFooterSlot,{isVisible:Ze,variant:N,children:(0,Q.jsx)(sh,{...Uc})}):null,",
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
  if (/^composer-.*\.js$/.test(filename) && source.includes("function Xm(e){")) {
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
      if (source.includes("function Xm(e){") && source.includes("Qp.ExternalFooterSlot")) {
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
