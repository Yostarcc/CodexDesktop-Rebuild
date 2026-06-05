#!/usr/bin/env node
/**
 * Remove the voice input button from composer-related footer surfaces.
 *
 * Keep the `voiceControls` object intact so we only hide the rendered trigger
 * and do not disturb the internal voice/realtime state wiring.
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const RULE = {
  id: "remove_voice_button_render",
  filePattern: /^(composer-.*\.js|browser-sidebar-comment-light-dismiss-.*\.js)$/,
  from: "let qe;if(O===`stop`){let e=N,n=typeof ze==`string`?ze:void 0,r;t[24]===k?r=t[25]:(r=k?Hi(`Esc`):null,t[24]=k,t[25]=r);let i;t[26]===P?i=t[27]:(i=()=>{P()},t[26]=P,t[27]=i);let a;t[28]!==ze||t[29]!==e||t[30]!==!1||t[31]!==n||t[32]!==r||t[33]!==i?(a=(0,Q.jsx)(Sm,{isSubmitting:e,disabled:!1,ariaLabel:n,Icon:uo,tooltipContent:ze,tooltipShortcut:r,onClick:i}),t[28]=ze,t[29]=e,t[30]=!1,t[31]=n,t[32]=r,t[33]=i,t[34]=a):a=t[34],qe=a}else if(Be){let e;t[35]===V?e=t[36]:(e=V.formatMessage({id:`composer.realtime.start.aria`,defaultMessage:`Start realtime voice`,description:`Aria label for the button that starts realtime voice mode in the composer`}),t[35]=V,t[36]=e);let n;t[37]===V?n=t[38]:(n=V.formatMessage({id:`composer.realtime.start.tooltip`,defaultMessage:`Start realtime voice`,description:`Tooltip for the button that starts realtime voice mode in the composer`}),t[37]=V,t[38]=n);let r;t[39]!==ce||t[40]!==Ve||t[41]!==e||t[42]!==n||t[43]!==We?(r=(0,Q.jsx)(Sm,{isSubmitting:ce,ariaLabel:e,Icon:xo,tooltipContent:n,tooltipShortcut:Ve,onClick:We}),t[39]=ce,t[40]=Ve,t[41]=e,t[42]=n,t[43]=We,t[44]=r):r=t[44],qe=r}else{let e=d===`cloud`?Jc:Eo,n;t[45]!==I||t[46]!==Ee||t[47]!==ee||t[48]!==M||t[49]!==ze||t[50]!==e?(n=(0,Q.jsx)(Sm,{isSubmitting:M,blockedReason:I,blockedReasonOpenNonce:Ee,Icon:e,tooltipContent:ze,onClick:ee}),t[45]=I,t[46]=Ee,t[47]=ee,t[48]=M,t[49]=ze,t[50]=e,t[51]=n):n=t[51],qe=n}",
  to: "let qe;if(O===`stop`){let e=N,n=typeof ze==`string`?ze:void 0,r;t[24]===k?r=t[25]:(r=k?Hi(`Esc`):null,t[24]=k,t[25]=r);let i;t[26]===P?i=t[27]:(i=()=>{P()},t[26]=P,t[27]=i);let a;t[28]!==ze||t[29]!==e||t[30]!==!1||t[31]!==n||t[32]!==r||t[33]!==i?(a=(0,Q.jsx)(Sm,{isSubmitting:e,disabled:!1,ariaLabel:n,Icon:uo,tooltipContent:ze,tooltipShortcut:r,onClick:i}),t[28]=ze,t[29]=e,t[30]=!1,t[31]=n,t[32]=r,t[33]=i,t[34]=a):a=t[34],qe=a}else{let e=d===`cloud`?Jc:Eo,n;t[45]!==I||t[46]!==Ee||t[47]!==ee||t[48]!==M||t[49]!==ze||t[50]!==e?(n=(0,Q.jsx)(Sm,{isSubmitting:M,blockedReason:I,blockedReasonOpenNonce:Ee,Icon:e,tooltipContent:ze,onClick:ee}),t[45]=I,t[46]=Ee,t[47]=ee,t[48]=M,t[49]=ze,t[50]=e,t[51]=n):n=t[51],qe=n}",
};

const COMPOSER_DICTATION_RULE = {
  id: "remove_composer_dictation_button",
  filePattern: /^composer-.*\.js$/,
  from: "let Qe=Ze,$e;t[69]!==H||t[70]!==ie||t[71]!==oe||t[72]!==U||t[73]!==le||t[74]!==fe||t[75]!==W||t[76]!==G||t[77]!==K.phase?($e=(0,Q.jsx)(as,{isVisible:oe,disabled:!U||K.phase!==`inactive`,isTranscribing:le,canRetryDictation:H,shortcutLabel:ie,retryDictation:fe,startDictation:W,stopDictation:G}),t[69]=H,t[70]=ie,t[71]=oe,t[72]=U,t[73]=le,t[74]=fe,t[75]=W,t[76]=G,t[77]=K.phase,t[78]=$e):$e=t[78];",
  to: "let Qe=Ze,$e=null;",
};

const COMPOSER_FOOTER_VOICE_TRIGGER_RULE = {
  id: "remove_footer_voice_trigger_slot",
  filePattern: /^composer-.*\.js$/,
  from:
    "let Ve=Be,He=!te||H.phase!==`inactive`,Ue;t[70]!==F||t[71]!==I||t[72]!==R||t[73]!==B||t[74]!==ae||t[75]!==oe||t[76]!==se||t[77]!==He?(Ue=(0,Q.jsx)(qo,{isVisible:R,disabled:He,isTranscribing:B,canRetryDictation:F,shortcutLabel:I,retryDictation:ae,startDictation:oe,stopDictation:se}),t[70]=F,t[71]=I,t[72]=R,t[73]=B,t[74]=ae,t[75]=oe,t[76]=se,t[77]=He,t[78]=Ue):Ue=t[78];let We=Ue,Ge;t[79]===Symbol.for(`react.memo_cache_sentinel`)?(Ge=null,t[79]=Ge):Ge=t[79];",
  to:
    "let Ve=Be,He=!te||H.phase!==`inactive`,Ue=null;let We=Ue,Ge;t[79]===Symbol.for(`react.memo_cache_sentinel`)?(Ge=null,t[79]=Ge):Ge=t[79];",
};

const LIGHT_DISMISS_RULE = {
  id: "remove_dictation_trigger_render",
  filePattern: /^browser-sidebar-comment-light-dismiss-.*\.js$/,
  from: "Jt?(0,Q.jsx)(Cn,{isVisible:Kt,isTranscribing:vt,canRetryDictation:yt,disabled:qt,retryDictation:xt,shortcutLabel:Zt,startDictation:Ct,stopDictation:wt,tooltipPortalContainer:$t}):null",
  to: "null",
};

function replaceOnce(source, from, to) {
  const idx = source.indexOf(from);
  if (idx === -1) return source;
  return source.slice(0, idx) + to + source.slice(idx + from.length);
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
      if (!RULE.filePattern.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (!source.includes(RULE.from)) continue;
      targets.push({ platform: plat, path: filePath });
    }
  }
  return targets;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = [
    ...locateTargets(platform),
    ...locateLightDismissTargets(platform),
    ...locateComposerDictationTargets(platform),
    ...locateComposerFooterVoiceTriggerTargets(platform),
  ];
  if (targets.length === 0) {
    console.log("  [skip] No composer voice-button targets found");
    return;
  }

  let patchedCount = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const rule = target.rule ?? RULE;
    const code = replaceOnce(source, rule.from, rule.to);

    if (code === source) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)}`);
    console.log(`    * ${rule.id}`);
    if (!isCheck) fs.writeFileSync(target.path, code, "utf-8");
    patchedCount += 1;
  }

  if (!isCheck) {
    if (patchedCount === 0) {
      console.log("  [ok] composer voice button already patched");
    } else {
      console.log(`  [ok] patched ${patchedCount} file(s)`);
    }
  }
}

function locateLightDismissTargets(platform) {
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
      if (!LIGHT_DISMISS_RULE.filePattern.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (!source.includes(LIGHT_DISMISS_RULE.from)) continue;
      targets.push({ platform: plat, path: filePath, rule: LIGHT_DISMISS_RULE });
    }
  }
  return targets;
}

function locateComposerDictationTargets(platform) {
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
      if (!COMPOSER_DICTATION_RULE.filePattern.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (!source.includes(COMPOSER_DICTATION_RULE.from)) continue;
      targets.push({ platform: plat, path: filePath, rule: COMPOSER_DICTATION_RULE });
    }
  }
  return targets;
}

function locateComposerFooterVoiceTriggerTargets(platform) {
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
      if (!COMPOSER_FOOTER_VOICE_TRIGGER_RULE.filePattern.test(file)) continue;
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      if (!source.includes(COMPOSER_FOOTER_VOICE_TRIGGER_RULE.from)) continue;
      targets.push({ platform: plat, path: filePath, rule: COMPOSER_FOOTER_VOICE_TRIGGER_RULE });
    }
  }
  return targets;
}

main();
