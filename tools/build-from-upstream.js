#!/usr/bin/env node
/**
 * build-from-upstream.js — Patch upstream Codex and repackage
 *
 * For macOS and Windows: no forge needed.
 * Takes the upstream app, patches ASAR in-place, outputs distributable.
 *
 * Usage:
 *   node tools/build-from-upstream.js --platform mac-arm64
 *   node tools/build-from-upstream.js --platform mac-x64
 *   node tools/build-from-upstream.js --platform win
 *   node tools/build-from-upstream.js --platform win --skip-patches
 *   # Only add --with-zip when the user explicitly asks for a zip package.
 *   node tools/build-from-upstream.js --platform win --with-zip
 *   node tools/build-from-upstream.js --platform win --out-dir out-custom
 */
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
const {
  clearDir,
  copyRecursive,
  hashFile,
  makeTimestamp,
  psLiteral,
  runPowerShell,
} = require("./lib/common");
const {
  resolveCodexVendor,
  validateRemoteControlCodex,
} = require("./lib/codex-vendor");
const { getWindowsVersion } = require("./lib/codex-release");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(PROJECT_ROOT, "src");
const PURE_SRC_DIR = path.join(PROJECT_ROOT, "pure-src");

const outDirArgIndex = process.argv.indexOf("--out-dir");
const OUT_DIR = outDirArgIndex !== -1
  ? path.resolve(PROJECT_ROOT, process.argv[outDirArgIndex + 1])
  : path.join(PROJECT_ROOT, `out-${makeTimestamp()}`);

const REMOTE_CONTROL_CODEX_EXE = path.join(PROJECT_ROOT, "resources", "remote-control", "codex.exe");
const VERSION_FILE = path.join(PROJECT_ROOT, "tools", ".versions.json");

// ─── Helpers ────────────────────────────────────────────────────

function runPatches(platform) {
  console.log(`   [patch] patch-all ${platform}`);
  execFileSync("node", [path.join(PROJECT_ROOT, "scripts", "patch-all.js"), platform], { stdio: "inherit" });
}

// ─── macOS build ────────────────────────────────────────────────

async function buildMac(platform) {
  const platformDir = path.join(SRC_DIR, platform);
  const asarDir = path.join(platformDir, "_asar");

  if (!fs.existsSync(asarDir)) {
    console.error(`[x] ${platform}/_asar/ not found. Run sync-upstream first.`);
    process.exit(1);
  }

  // 1. Find the .app in the ZIP extract cache
  const variant = platform === "mac-arm64" ? "arm64" : "x64";
  const tempDir = path.join(require("os").tmpdir(), "codex-sync");
  const extractDir = path.join(tempDir, `${variant}-extract`);

  // Find Codex.app
  let appPath = null;
  if (fs.existsSync(extractDir)) {
    const findApp = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "Codex.app" && e.isDirectory()) return path.join(dir, e.name);
        if (e.isDirectory()) { const r = findApp(path.join(dir, e.name)); if (r) return r; }
      }
      return null;
    };
    appPath = findApp(extractDir);
  }

  if (!appPath) {
    console.error(`[x] Codex.app not found in cache. Run sync-upstream first.`);
    process.exit(1);
  }

  console.log(`   [source] ${appPath}`);

  // 2. Copy .app to output (ditto preserves symlinks + resource forks)
  const outAppDir = path.join(OUT_DIR, platform);
  clearDir(outAppDir);
  const outApp = path.join(outAppDir, "Codex.app");
  console.log("   [copy] Codex.app -> out/");
  execSync(`ditto "${appPath}" "${outApp}"`);

  const resourcesDir = path.join(outApp, "Contents", "Resources");

  // 3. Repack patched ASAR
  const asarPath = path.join(resourcesDir, "app.asar");
  console.log("   [asar pack] _asar/ -> app.asar");
  execSync(`npx asar pack "${asarDir}" "${asarPath}"`);

  // 4. Update ASAR integrity hash in Info.plist
  const infoPlist = path.join(outApp, "Contents", "Info.plist");
  if (fs.existsSync(infoPlist)) {
    updateAsarIntegrity(asarPath, infoPlist);
  }

  // 5. Strip original signature + quarantine
  console.log("   [codesign] removing original signature");
  try { execSync(`codesign --remove-signature "${outApp}"`, { stdio: "pipe" }); } catch {}
  try { execSync(`xattr -rd com.apple.quarantine "${outApp}"`, { stdio: "pipe" }); } catch {}

  // 6. Replace codex CLI
  await replaceCodex(platform, resourcesDir, "codex");

  // 7. Ad-hoc re-sign (prevents "damaged app" Gatekeeper error)
  console.log("   [codesign] ad-hoc signing");
  try {
    execSync(`codesign --sign - --force --deep "${outApp}"`, { stdio: "pipe" });
    console.log("   [ok] ad-hoc signed");
  } catch (e) {
    console.log(`   [!] ad-hoc sign failed: ${e.message}`);
  }

  // 8. Create DMG
  const version = getVersion(asarDir);
  const dmgName = `Codex-${platform}-${version}.dmg`;
  const dmgPath = path.join(OUT_DIR, dmgName);
  console.log(`   [dmg] ${dmgName}`);
  execSync(`hdiutil create -volname Codex -srcfolder "${outAppDir}" -ov -format UDZO "${dmgPath}"`, { stdio: "pipe" });
  const sizeMB = (fs.statSync(dmgPath).size / 1048576).toFixed(1);
  console.log(`   [ok] ${dmgPath} (${sizeMB} MB)`);
}

// ─── Windows build ──────────────────────────────────────────────

async function buildWin(platform, options = {}) {
  const { withZip = false } = options;
  const platformDir = path.join(SRC_DIR, platform);
  const asarDir = path.join(platformDir, "_asar");

  if (!fs.existsSync(asarDir)) {
    console.error(`[x] win/_asar/ not found. Run sync-upstream first.`);
    process.exit(1);
  }

  if (!fs.existsSync(path.join(platformDir, "Codex.exe")) || !fs.existsSync(path.join(platformDir, "resources"))) {
    console.error("[x] src/win is not a complete official app tree. Run node tools/sync-upstream.js --skip-mac first.");
    process.exit(1);
  }

  // Copy the patched Windows app tree directly to output.
  const outAppDir = path.join(OUT_DIR, "win");
  clearDir(outAppDir);
  const outApp = path.join(outAppDir, "Codex-win32-x64");
  console.log(`   [copy] patched src/win -> out/ (${platformDir})`);
  copyRecursive(platformDir, outApp, {
    preserveSymlinks: true,
    skipDirs: new Set(["_asar"]),
  });

  const resourcesDir = path.join(outApp, "resources");

  const asarPath = path.join(resourcesDir, "app.asar");
  const oldHash = fs.existsSync(asarPath) ? computeAsarHeaderHash(asarPath) : null;
  if (oldHash == null) {
    console.log("   [integrity] old hash: (missing, will create)");
  } else {
    console.log(`   [integrity] old hash: ${oldHash.slice(0, 16)}...`);
  }

  // Repack patched ASAR
  console.log("   [asar pack] _asar/ -> app.asar");
  execSync(`npx asar pack "${asarDir}" "${asarPath}"`);

  // Compute new hash and patch exe
  const newHash = computeAsarHeaderHash(asarPath);
  console.log(`   [integrity] new hash: ${newHash.slice(0, 16)}...`);

  if (oldHash !== newHash) {
    updateWindowsRuntimeIntegrity(resourcesDir, asarPath);
  }

  replaceWindowsResourceCodex(resourcesDir);

  const version = getVersion(asarDir);
  let zipPath = null;
  if (withZip) {
    const zipName = `Codex-win-x64-${version}.zip`;
    zipPath = path.join(OUT_DIR, zipName);
    console.log(`   [zip] ${zipName}`);
    const ps = [
      "$ErrorActionPreference='Stop'",
      `$src=${psLiteral(outApp)}`,
      `$zip=${psLiteral(zipPath)}`,
      "if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }",
      "Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip -CompressionLevel Optimal -Force",
    ].join("; ");
    runPowerShell(ps);

    const sizeMB = (fs.statSync(zipPath).size / 1048576).toFixed(1);
    console.log(`   [ok] ${zipPath} (${sizeMB} MB)`);
  } else {
    console.log("   [zip] skipped (default; only enable when the user explicitly requests --with-zip)");
  }

  console.log(`   [output] ${outApp}`);
}

// ─── ASAR integrity ─────────────────────────────────────────────

function computeAsarHeaderHash(asarPath) {
  const crypto = require("crypto");
  const buf = fs.readFileSync(asarPath);
  const headerSize = buf.readUInt32LE(12);
  const header = buf.slice(16, 16 + headerSize);
  return crypto.createHash("sha256").update(header).digest("hex");
}

function updateWindowsRuntimeIntegrity(resourcesDir, asarPath) {
  const owlConfigPath = [
    path.join(path.dirname(resourcesDir), "owl-electron-app.json"),
    path.join(resourcesDir, "owl-electron-app.json"),
  ].find((candidate) => fs.existsSync(candidate));
  const shellRuntimePath = path.join(path.dirname(resourcesDir), "owl-shell-runtime.json");
  if (owlConfigPath == null) {
    console.log("   [!] owl-electron-app.json not found for runtime integrity patching");
    return;
  }

  const runtimeSha = hashFile(asarPath);
  const config = JSON.parse(fs.readFileSync(owlConfigPath, "utf-8"));
  config.runtimeArchiveSha = runtimeSha;
  fs.writeFileSync(owlConfigPath, JSON.stringify(config, null, 2) + "\n");
  if (fs.existsSync(shellRuntimePath)) {
    try {
      const shellRuntime = JSON.parse(fs.readFileSync(shellRuntimePath, "utf-8"));
      shellRuntime.runtimeArchiveSha = runtimeSha;
      fs.writeFileSync(shellRuntimePath, JSON.stringify(shellRuntime, null, 2) + "\n");
    } catch {}
  }
  console.log(`   [integrity] runtimeArchiveSha updated: ${runtimeSha.slice(0, 16)}...`);
}

function updateAsarIntegrity(asarPath, infoPlistPath) {
  const newHash = computeAsarHeaderHash(asarPath);
  execSync(`plutil -replace ElectronAsarIntegrity.Resources/app\\\\.asar.hash -string "${newHash}" "${infoPlistPath}"`, { stdio: "pipe" });
  execSync(`plutil -replace ElectronAsarIntegrity.Resources/app\\\\.asar.algorithm -string "SHA256" "${infoPlistPath}"`, { stdio: "pipe" });

  // Verify
  const verify = execSync(`plutil -extract ElectronAsarIntegrity.Resources/app\\\\.asar.hash raw "${infoPlistPath}"`, { encoding: "utf-8" }).trim();
  if (verify === newHash) {
    console.log(`   [integrity] hash updated: ${newHash.slice(0, 16)}...`);
  } else {
    console.log(`   [!] integrity verify failed`);
  }
}

// ─── Shared ─────────────────────────────────────────────────────

async function replaceCodex(platform, resourcesDir, binName) {
  const vendor = await resolveCodexVendor(PROJECT_ROOT, platform);
  if (vendor) {
    const dest = path.join(resourcesDir, binName);
    fs.copyFileSync(vendor, dest);
    try { fs.chmodSync(dest, 0o755); } catch {}
    console.log(`   [codex] replaced with @cometix/codex`);
  } else {
    console.log(`   [!] @cometix/codex not found, keeping upstream codex`);
  }
}

function replaceWindowsResourceCodex(resourcesDir) {
  const dest = path.join(resourcesDir, "codex.exe");
  if (!fs.existsSync(REMOTE_CONTROL_CODEX_EXE)) {
    console.log("   [codex] keeping official upstream resources/codex.exe");
    return;
  }

  validateRemoteControlCodex(REMOTE_CONTROL_CODEX_EXE);
  fs.copyFileSync(REMOTE_CONTROL_CODEX_EXE, dest);
  try { fs.chmodSync(dest, 0o755); } catch {}
  console.log("   [codex] replaced with optional remote-control native codex.exe");
}

function getVersion(asarDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(asarDir, "package.json"), "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const platIdx = args.indexOf("--platform");
  const platform = platIdx !== -1 ? args[platIdx + 1] : null;
  const skipPatches = args.includes("--skip-patches");
  const withZip = args.includes("--with-zip");

  if (!platform || !["mac-arm64", "mac-x64", "win"].includes(platform)) {
    console.error("[x] Usage: build-from-upstream.js --platform <mac-arm64|mac-x64|win>");
    process.exit(1);
  }

  console.log(`\n== Build from upstream: ${platform} ==\n`);
  console.log(`   [out] ${OUT_DIR}`);
  if (platform === "win") {
    await ensureWindowsUpstreamLatest();
  }
  clearDir(OUT_DIR);
  if (skipPatches) {
    console.log("   [patch] skipped (using current src as-is)");
  } else {
    runPatches(platform);
  }

  if (platform.startsWith("mac")) {
    await buildMac(platform);
  } else {
    await buildWin(platform, { withZip });
  }
}

function readSavedVersions() {
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function ensureWindowsUpstreamLatest() {
  const localVersion = readSavedVersions().win?.version || "";
  const latest = await getWindowsVersion();
  if (localVersion === latest.version && fs.existsSync(path.join(PURE_SRC_DIR, "win", "resources", "app.asar"))) {
    console.log(`   [upstream] win ${localVersion} is current`);
    return;
  }

  console.log(`   [upstream] win ${localVersion || "(missing)"} -> ${latest.version}`);
  execFileSync("node", [path.join(PROJECT_ROOT, "tools", "sync-upstream.js"), "--skip-mac"], { stdio: "inherit" });
}

main().catch((e) => {
  console.error(`[x] ${e.message}`);
  process.exit(1);
});
