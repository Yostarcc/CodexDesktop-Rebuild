#!/usr/bin/env node
/**
 * Post-build patch: Remove plugin auth gate + force browser-use available
 *
 * Rule 1 — Plugin auth gate (gradient-*.js or similar):
 *   AST match: function(X) { return X !== `chatgpt` }
 *   Replace expression with !1 (always allow non-chatgpt auth)
 *
 * Rule 2 — Browser-use availability (use-in-app-browser-use-availability-*.js):
 *   AST match: function containing featureName:`browser_use` that returns
 *   {allowed:X, available:Y, isLoading:Z}
 *   Replace allowed/available values with !0
 *
 * Rule 3 — Statsig gate bypass (any chunk):
 *   AST match: CallExpression `identifier(numericStringLiteral)` where the call
 *   appears inside a function that also references featureName strings like
 *   `browser_use`, `computer_use`, `browser_use_external`
 *   Replace the call with !0
 *
 * Rule 5 — Plugin install-flow button gate (use-plugin-install-flow-*.js):
 *   Text match around installPlugin:async/openPluginInstall where availability
 *   variables gate install buttons. Force the install capability guard to true
 *   while leaving loading/session guards intact.
 *
 * Rule 7 — Plugin connector availability (check-plugin-availability-*.js):
 *   Treat missing/unlisted connector apps as installable instead of surfacing
 *   `connector-unavailable` / "App unavailable". Keep admin-disabled blocking.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("acorn");
const { SRC_DIR, relPath } = require("./patch-util");

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (node.type) visitor(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child)
        if (item && typeof item === "object" && item.type) walk(item, visitor);
    } else if (child && typeof child === "object" && child.type) {
      walk(child, visitor);
    }
  }
}

function getLiteralValue(node) {
  if (!node) return null;
  if (node.type === "Literal") return node.value;
  if (
    node.type === "TemplateLiteral" &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  )
    return node.quasis[0].value.cooked;
  return null;
}

function nodeContainsString(node, source, str) {
  return source.slice(node.start, node.end).includes(str);
}

// ── Rule 1: Plugin auth — function(e){return e!==`chatgpt`} → !1 ──

function findPluginAuthPatches(ast, source) {
  const patches = [];
  walk(ast, (node) => {
    if (node.type !== "FunctionDeclaration" && node.type !== "FunctionExpression")
      return;
    const body = node.body;
    if (!body || body.type !== "BlockStatement" || body.body.length !== 1) return;
    const ret = body.body[0];
    if (ret.type !== "ReturnStatement" || !ret.argument) return;
    const arg = ret.argument;
    if (arg.type !== "BinaryExpression" || arg.operator !== "!==") return;
    if (
      getLiteralValue(arg.left) !== "chatgpt" &&
      getLiteralValue(arg.right) !== "chatgpt"
    )
      return;
    const expr = source.slice(arg.start, arg.end);
    if (expr === "!1") return;
    patches.push({
      id: "plugin_auth_gate",
      start: arg.start,
      end: arg.end,
      replacement: "!1",
      original: expr,
    });
  });
  return patches;
}

// ── Rule 6: Force /goal slash command available ──
// The goal feature is gated by: gate(ID) && config.goals === true && mode !== 'cloud'
// AST match: LogicalExpression chain containing `goals` string AND a gate call,
// replace with just the mode check (X !== `cloud`).

function findGoalGatePatches(ast, source) {
  const patches = [];
  walk(ast, (node) => {
    if (node.type !== "LogicalExpression" || node.operator !== "&&") return;
    const slice = source.slice(node.start, node.end);
    // Must contain `goals` config check and `cloud` mode check
    if (!slice.includes("`goals`") && !slice.includes('"goals"')) return;
    if (!slice.includes("`cloud`") && !slice.includes('"cloud"')) return;
    // Must contain a gate call (identifier with numeric string arg)
    let hasGateCall = false;
    walk(node, (inner) => {
      if (inner.type !== "CallExpression") return;
      if (inner.callee?.type !== "Identifier") return;
      if (inner.arguments?.length !== 1) return;
      const val = getLiteralValue(inner.arguments[0]);
      if (val && /^\d{6,}$/.test(val)) hasGateCall = true;
    });
    if (!hasGateCall) return;
    // The rightmost operand is the mode check (X !== `cloud`).
    // In A && B && C, node.right is C.
    const right = node.right;
    const rightSrc = source.slice(right.start, right.end);
    if (!rightSrc.includes("cloud")) return;
    const fullSrc = source.slice(node.start, node.end);
    if (fullSrc === rightSrc) return;
    patches.push({
      id: "goal_gate_bypass",
      start: node.start,
      end: node.end,
      replacement: rightSrc,
      original: fullSrc.slice(0, 50) + "...",
    });
  });
  return patches;
}

// ── Rule 2: Force browser-use availability ──
// Find functions that return {allowed:X, available:Y, isLoading:Z}
// and contain featureName:`browser_use` (not browser_use_external).

function findBrowserAvailPatches(ast, source) {
  const patches = [];

  walk(ast, (node) => {
    if (node.type !== "FunctionDeclaration" && node.type !== "FunctionExpression")
      return;
    const slice = source.slice(node.start, node.end);
    // Must contain a use-availability featureName
    if (
      !slice.includes("`browser_use`") &&
      !slice.includes("`browser_use_external`") &&
      !slice.includes("`computer_use`")
    ) return;

    // Find return objects containing {available:X, ...} with isLoading
    // Matches both {allowed,available,isLoading} and {available,isFetching,isLoading}
    walk(node, (inner) => {
      if (inner.type !== "ObjectExpression") return;
      const props = inner.properties;
      if (!props || props.length < 3) return;
      const keys = props.map((p) => p.key?.name || p.key?.value);
      if (!keys.includes("available") || !keys.includes("isLoading")) return;

      for (const prop of props) {
        const name = prop.key?.name || prop.key?.value;
        if (name === "allowed" || name === "available") {
          const val = source.slice(prop.value.start, prop.value.end);
          if (val === "!0") continue;
          patches.push({
            id: `browser_use_${name}`,
            start: prop.value.start,
            end: prop.value.end,
            replacement: "!0",
            original: val,
          });
        }
      }
    });
  });

  return patches;
}

// ── Rule 3: Statsig gate bypass ──
// Match: identifier(`numericString`) inside a function that also contains
// a known feature name like browser_use, computer_use, etc.
// This catches gate calls regardless of their numeric ID.

const FEATURE_CONTEXTS = new Set([
  "browser_use",
  "computer_use",
  "browser_use_external",
]);

function findStatsigGatePatches(ast, source) {
  const patches = [];

  walk(ast, (node) => {
    if (node.type !== "FunctionDeclaration" && node.type !== "FunctionExpression")
      return;
    const slice = source.slice(node.start, node.end);
    // Must contain a known feature context
    let hasFeatureContext = false;
    for (const feat of FEATURE_CONTEXTS) {
      if (slice.includes(`\`${feat}\``) || slice.includes(`"${feat}"`)) {
        hasFeatureContext = true;
        break;
      }
    }
    if (!hasFeatureContext) return;

    // Find CallExpression: identifier(`numericString`)
    walk(node, (inner) => {
      if (inner.type !== "CallExpression") return;
      if (inner.callee?.type !== "Identifier") return;
      if (inner.arguments?.length !== 1) return;
      const argVal = getLiteralValue(inner.arguments[0]);
      if (!argVal || !/^\d{6,}$/.test(argVal)) return;

      const expr = source.slice(inner.start, inner.end);
      if (expr === "!0") return;

      patches.push({
        id: `statsig_gate_${argVal}`,
        start: inner.start,
        end: inner.end,
        replacement: "!0",
        original: expr,
      });
    });
  });

  return patches;
}

// ── Rule 5: Force plugin install-flow capability gate available ──
// The install flow computes capability availability variables and reuses them in
// both installPlugin:async and openPluginInstall. When the first capability gate
// (Computer Use) is false, the install button/open action is blocked before the
// modal can proceed.

function findPluginInstallFlowPatches(source) {
  const patches = [];
  if (!source.includes("openPluginInstall") || !source.includes("installPlugin:async"))
    return patches;

  const targets = [
    // Older shape: X=!Y.isLoading&&Y.enabled,Z=A.available,B=C.available,...
    /([A-Za-z_$][\w$]*)=![A-Za-z_$][\w$]*\.isLoading&&[A-Za-z_$][\w$]*\.enabled,(?=[A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\.available,[A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\.available,)/g,
    // Current shape: X=A.available,Y=B.available,Z=C.available,...
    /([A-Za-z_$][\w$]*)=[A-Za-z_$][\w$]*\.available,(?=[A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\.available,[A-Za-z_$][\w$]*=[A-Za-z_$][\w$]*\.available,)/g,
  ];

  for (const pattern of targets) {
    const match = pattern.exec(source);
    if (!match) continue;
    const original = match[0];
    if (original.endsWith("=!0,")) continue;
    const start = match.index;
    patches.push({
      id: "plugin_install_flow_gate_enabled",
      start,
      end: start + original.length,
      replacement: `${match[1]}=!0,`,
      original,
    });
    break;
  }

  const guardPattern =
    /let ([A-Za-z_$][\w$]*)=e=>!\(![A-Za-z_$][\w$]*&&[A-Za-z_$][\w$]*\(e\.plugin\.id\)\|\|![A-Za-z_$][\w$]*&&[A-Za-z_$][\w$]*\(e\.plugin\.id\)\|\|![A-Za-z_$][\w$]*&&[A-Za-z_$][\w$]*\(e\.plugin\.id\)\),(?=[A-Za-z_$][\w$]*=e=>\{)/;
  const guardMatch = guardPattern.exec(source);
  if (guardMatch) {
    const original = guardMatch[0];
    patches.push({
      id: "plugin_install_flow_guard",
      start: guardMatch.index,
      end: guardMatch.index + original.length,
      replacement: `let ${guardMatch[1]}=e=>!0,`,
      original,
    });
  }

  return patches;
}

// ── Rule 7: Ignore connector-unavailable install blocking ──
// Plugin links can reference connectors that are absent from the local app
// directory. The stock UI maps that to `connector-unavailable`, which disables
// the install CTA. Preserve `disabled-by-admin`, but do not block on missing
// connector directory entries.

function findPluginConnectorAvailabilityPatches(source) {
  const patches = [];
  if (
    !source.includes("blockedReasonsByConnectorId") ||
    !source.includes("connector-unavailable")
  ) return patches;

  const pattern =
    /([A-Za-z_$][\w$]*)\?\.data\?\.status===([A-Za-z_$][\w$]*)\?([A-Za-z_$][\w$]*)=`disabled-by-admin`:\([A-Za-z_$][\w$]*\|\|\1!=null&&!\1\.isPending&&\1\.error==null&&\1\.data==null\)&&\(\3=`connector-unavailable`\)/;
  const match = pattern.exec(source);
  if (!match) return patches;

  const original = match[0];
  patches.push({
    id: "plugin_connector_unavailable_bypass",
    start: match.index,
    end: match.index + original.length,
    replacement: `${match[1]}?.data?.status===${match[2]}&&(${match[3]}=\`disabled-by-admin\`)`,
    original,
  });

  return patches;
}

// ── Rule 4: Force default desktop feature availability to true ──
// The main process has a default features object with all values false.
// This prevents bundled plugins from being installed during early startup.
// AST match: ObjectExpression with properties like inAppBrowserUse:!1, externalBrowserUseAllowed:!1, etc.

const FEATURE_KEYS = [
  "browserPane", "inAppBrowserUse", "inAppBrowserUseAllowed",
  "externalBrowserUse", "externalBrowserUseAllowed",
  "computerUse", "computerUseNodeRepl", "control", "multiWindow",
];

function findFeatureDefaultPatches(ast, source) {
  const patches = [];

  // Part A: Force default feature values from !1 to !0
  walk(ast, (node) => {
    if (node.type !== "ObjectExpression") return;
    const props = node.properties;
    if (!props || props.length < 5) return;
    const keys = props.map((p) => p.key?.name || p.key?.value);
    let matchCount = 0;
    for (const k of FEATURE_KEYS) if (keys.includes(k)) matchCount++;
    if (matchCount < 3) return;

    for (const prop of props) {
      const name = prop.key?.name || prop.key?.value;
      if (!FEATURE_KEYS.includes(name)) continue;
      const val = source.slice(prop.value.start, prop.value.end);
      if (val !== "!1") continue;
      patches.push({
        id: `feature_default_${name}`,
        start: prop.value.start,
        end: prop.value.end,
        replacement: "!0",
        original: val,
      });
    }
  });

  // Part A2: Force features.js_repl to true.
  // This is a separate object {"features.js_repl":!1} that controls whether
  // the Node.js REPL (Chrome browser control) is exposed to the model.
  walk(ast, (node) => {
    if (node.type !== "ObjectExpression") return;
    const props = node.properties;
    if (!props || props.length !== 1) return;
    const prop = props[0];
    const key = prop.key?.value;
    if (key !== "features.js_repl") return;
    const val = source.slice(prop.value.start, prop.value.end);
    if (val !== "!1") return;
    patches.push({
      id: "feature_js_repl",
      start: prop.value.start,
      end: prop.value.end,
      replacement: "!0",
      original: val,
    });
  });

  // Part B: Bypass the isAvailable filter in bundled plugins descriptor.
  // Pattern: X.filter(Y => Y.isAvailable({buildFlavor:..., features:..., platform:...}))
  // The filter callback checks features like externalBrowserUseAllowed which may be
  // false at startup. Replace the callback with ()=>!0 so all plugins are included.
  walk(ast, (node) => {
    if (node.type !== "CallExpression") return;
    if (node.callee?.type !== "MemberExpression") return;
    if (node.callee.property?.name !== "filter") return;
    if (node.arguments?.length !== 1) return;
    const cb = node.arguments[0];
    if (cb.type !== "ArrowFunctionExpression") return;
    const cbSrc = source.slice(cb.start, cb.end);
    if (!cbSrc.includes("isAvailable")) return;
    if (!cbSrc.includes("features")) return;
    if (cbSrc === "()=>!0") return;
    patches.push({
      id: "bundled_plugins_filter_bypass",
      start: cb.start,
      end: cb.end,
      replacement: "()=>!0",
      original: cbSrc.slice(0, 40) + "...",
    });
  });

  // Part C: Bypass browser-use native pipe peer authorization.
  // The BM() function checks code signing identity via a native module.
  // Ad-hoc signed builds fail because teamId !== "2DC432GLL2" (OpenAI).
  // AST match: function containing literal "browser-use-peer-authorization.node",
  // find the IfStatement whose consequent returns ()=>({authorized:!0}) —
  // that's the bypass path — force its condition to !0.
  walk(ast, (node) => {
    if (
      node.type !== "FunctionDeclaration" &&
      node.type !== "FunctionExpression"
    ) return;
    const slice = source.slice(node.start, node.end);
    if (!slice.includes("shouldIncludeBrowserUsePeerAuthorization")) return;

    // Find if(...) return ()=>({authorized:!0}) — the bypass return.
    // There are multiple returns; we want the one right before the native module load.
    // It's the IfStatement whose consequent returns an ArrowFunction with authorized:!0.
    walk(node, (inner) => {
      if (inner.type !== "IfStatement") return;
      const cons = inner.consequent;
      if (!cons) return;
      // consequent is ReturnStatement returning ArrowFunctionExpression
      const ret = cons.type === "ReturnStatement" ? cons : null;
      if (!ret || !ret.argument) return;
      if (ret.argument.type !== "ArrowFunctionExpression") return;
      // The arrow body must be an ObjectExpression with authorized:!0
      const body = ret.argument.body;
      if (!body || body.type !== "ObjectExpression") return;
      // Check for {authorized:!0} with no "reason" property
      const props = body.properties;
      const authProp = props?.find((p) => (p.key?.name || p.key?.value) === "authorized");
      const reasonProp = props?.find((p) => (p.key?.name || p.key?.value) === "reason");
      if (!authProp) return;
      const authVal = source.slice(authProp.value.start, authProp.value.end);
      if (authVal !== "!0") return;
      // Must NOT have a reason property (to distinguish from error returns)
      if (reasonProp) return;

      // Force the if-condition to !0 — but skip platform checks
      const test = inner.test;
      const testSrc = source.slice(test.start, test.end);
      if (testSrc === "!0") return;
      if (testSrc.includes("platform")) return;
      patches.push({
        id: "peer_auth_bypass",
        start: test.start,
        end: test.end,
        replacement: "!0",
        original: testSrc,
      });
    });
  });

  return patches;
}

// ── Target location ──

function locateTargets(platform) {
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

      let dominated = false;

      // Rule 1: plugin auth — small file with chatgpt + !==
      if (src.includes("chatgpt") && src.includes("!==") && src.length < 5000) {
        targets.push({ platform: plat, path: fp, rules: ["auth"] });
        dominated = true;
      }

      // Rule 2+3: browser/computer use availability
      if (
        f.startsWith("use-in-app-browser-use-availability-") ||
        f.startsWith("use-browser-agent-availability-")
      ) {
        targets.push({ platform: plat, path: fp, rules: ["avail", "gate"] });
        dominated = true;
      }

      // Rule 6: composer — goal gate bypass
      if (f.startsWith("composer-") && src.includes("goalSlashCommand")) {
        targets.push({ platform: plat, path: fp, rules: ["goal"] });
      }

      // Rule 5: install-flow button/open gate
      if (
        f.startsWith("use-plugin-install-flow-") &&
        src.includes("openPluginInstall") &&
        src.includes("installPlugin:async")
      ) {
        targets.push({ platform: plat, path: fp, rules: ["install-flow"] });
      }

      // Rule 7: connector availability should not disable plugin installs
      if (
        f.startsWith("check-plugin-availability-") &&
        src.includes("blockedReasonsByConnectorId") &&
        src.includes("connector-unavailable")
      ) {
        targets.push({ platform: plat, path: fp, rules: ["connector-availability"] });
      }

      // Rule 1 fallback: other files with authMethod chatgpt patterns
      if (
        !dominated &&
        src.length < 10000 &&
        src.includes("chatgpt") &&
        (src.includes("authMethod") || src.includes("!=="))
      ) {
        targets.push({ platform: plat, path: fp, rules: ["auth"] });
      }
    }

    // Rule 4: main process — force default features
    const buildDir = path.join(SRC_DIR, plat, "_asar", ".vite", "build");
    if (fs.existsSync(buildDir)) {
      for (const f of fs.readdirSync(buildDir)) {
        if (!f.startsWith("main-") || !f.endsWith(".js")) continue;
        const fp = path.join(buildDir, f);
        const src = fs.readFileSync(fp, "utf-8");
        if (src.includes("externalBrowserUseAllowed") && src.includes("computerUse")) {
          targets.push({ platform: plat, path: fp, rules: ["features"] });
        }
      }
    }
  }

  return targets;
}

// ── Main ──

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateTargets(platform);

  if (targets.length === 0) {
    console.log("[ok] No plugin auth or browser-use targets found");
    return;
  }

  const seen = new Set();
  const unique = targets.filter((t) => {
    if (seen.has(t.path)) return false;
    seen.add(t.path);
    return true;
  });

  for (const bundle of unique) {
    console.log(`\n-- [${bundle.platform}] ${relPath(bundle.path)}`);
    const source = fs.readFileSync(bundle.path, "utf-8");
    console.log(`   size: ${(source.length / 1024).toFixed(1)} KB`);

    const t0 = Date.now();
    const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
    console.log(`   parse: ${Date.now() - t0}ms`);

    const patches = [];
    if (bundle.rules.includes("auth")) patches.push(...findPluginAuthPatches(ast, source));
    if (bundle.rules.includes("avail"))
      patches.push(...findBrowserAvailPatches(ast, source));
    if (bundle.rules.includes("gate"))
      patches.push(...findStatsigGatePatches(ast, source));
    if (bundle.rules.includes("features"))
      patches.push(...findFeatureDefaultPatches(ast, source));
    if (bundle.rules.includes("goal"))
      patches.push(...findGoalGatePatches(ast, source));
    if (bundle.rules.includes("install-flow"))
      patches.push(...findPluginInstallFlowPatches(source));
    if (bundle.rules.includes("connector-availability"))
      patches.push(...findPluginConnectorAvailabilityPatches(source));

    if (patches.length === 0) {
      console.log("   [ok] Already patched or no match");
      continue;
    }

    if (isCheck) {
      for (const p of patches)
        console.log(`   [?] [${p.id}] offset ${p.start}: ${p.original} -> ${p.replacement}`);
      continue;
    }

    patches.sort((a, b) => b.start - a.start);
    let code = source;
    for (const p of patches) {
      console.log(`   * [${p.id}] offset ${p.start}: ${p.original} -> ${p.replacement}`);
      code = code.slice(0, p.start) + p.replacement + code.slice(p.end);
    }

    fs.writeFileSync(bundle.path, code, "utf-8");
    console.log(`   [ok] ${patches.length} gates patched`);
  }
}

main();
