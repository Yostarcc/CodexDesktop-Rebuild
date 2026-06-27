#!/usr/bin/env node
/**
 * sync-upstream.js — Extract full upstream Codex resources
 *
 * Output structure per platform:
 *   pure-src/win/         Official MSIX app/ directory, plus _asar/
 *   pure-src/{mac}/       Extracted app resources, plus _asar/
 *
 * Windows build flow keeps pure-src/win as the complete pristine package:
 *   pure-src/win/resources/app.asar -> extract to pure-src/win/_asar
 *
 * Usage:
 *   node tools/sync-upstream.js [--force] [--skip-mac] [--skip-win]
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  clearDir,
  copyRecursive,
  countFiles,
  downloadFile,
  findFile,
  psLiteral,
  runPowerShell,
} = require("./lib/common");
const {
  APPCAST_ARM64,
  APPCAST_X64,
  getAppcastVersion,
  getWindowsVersion,
} = require("./lib/codex-release");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PURE_SRC_DIR = path.join(PROJECT_ROOT, "pure-src");
const TEMP_DIR = path.join(require("os").tmpdir(), "codex-sync");
const VERSION_FILE = path.join(__dirname, ".versions.json");

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check-only");
const SKIP_MAC = args.includes("--skip-mac");
const SKIP_WIN = args.includes("--skip-win");

// ─── Helpers ────────────────────────────────────────────────────

function curlDownload(url, dest, label) {
  console.log(`  [dl] ${label}`);
  return downloadFile(url, dest, { progress: true, logPrefix: "    [dl]" });
}

function extractZipLikeArchiveOnWindows(archive, dest) {
  const zipPath = archive.toLowerCase().endsWith(".zip")
    ? archive
    : path.join(path.dirname(archive), `${path.basename(archive, path.extname(archive))}.zip`);
  if (zipPath !== archive) fs.copyFileSync(archive, zipPath);
  const ps = [
    "$ErrorActionPreference='Stop'",
    `$zip=${psLiteral(zipPath)}`,
    `$dest=${psLiteral(dest)}`,
    "New-Item -Path $dest -ItemType Directory -Force | Out-Null",
    "Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force",
  ].join("; ");
  runPowerShell(ps);
}

function extractArchive(archive, dest) {
  if (process.platform === "darwin" && archive.endsWith(".zip")) {
    // ditto preserves macOS symlinks + resource forks (required for .app)
    execSync(`ditto -xk "${archive}" "${dest}"`);
  } else if (process.platform === "win32") {
    extractZipLikeArchiveOnWindows(archive, dest);
  } else {
    // 7zz for Windows MSIX and Linux (symlinks don't matter — only ASAR content used)
    for (const bin of ["7zz", "7z"]) {
      try {
        execSync(`${bin} x -y -o"${dest}" "${archive}"`, { stdio: "pipe" });
        return;
      } catch {
        if (fs.readdirSync(dest).length > 0) return;
      }
    }
    throw new Error(`Failed to extract ${archive}`);
  }
}

function ensureDecodedScopeAliases(rootDir) {
  if (!fs.existsSync(rootDir)) return 0;

  let created = 0;
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sourceDir = path.join(currentDir, entry.name);
      stack.push(sourceDir);

      if (!entry.name.startsWith("%40")) continue;

      const decodedName = `@${entry.name.slice(3)}`;
      const aliasDir = path.join(currentDir, decodedName);
      if (fs.existsSync(aliasDir)) continue;

      copyRecursive(sourceDir, aliasDir, { preserveSymlinks: true });
      created++;
      stack.push(aliasDir);
    }
  }

  return created;
}

// ─── Extract macOS ──────────────────────────────────────────────

async function syncMac(variant, appcastUrl, destDir) {
  const label = `macOS-${variant}`;
  console.log(`\n-- ${label}`);

  const info = await getAppcastVersion(appcastUrl);
  console.log(`   version: ${info.version} (build ${info.build})`);

  const zipPath = path.join(TEMP_DIR, `Codex-${variant}-${info.version}.zip`);
  const extractDir = path.join(TEMP_DIR, `${variant}-extract`);

  if (!fs.existsSync(zipPath)) {
    await curlDownload(info.url, zipPath, label);
  } else {
    console.log(`   [cache] ${zipPath}`);
  }

  console.log("   [unzip]");
  clearDir(extractDir);
  extractArchive(zipPath, extractDir);

  const resourcesDir = findResourcesDir(extractDir);
  if (!resourcesDir) throw new Error(`${label}: Resources directory not found`);

  assembleOutput(resourcesDir, destDir, label);
  return info;
}

// ─── Extract Windows ────────────────────────────────────────────

async function syncWin(destDir) {
  console.log("\n-- Windows");

  const info = await getWindowsVersion();
  console.log(`   version: ${info.version}`);

  const msixPath = path.join(TEMP_DIR, info.packageName || `codex-win-${info.version}.msix`);
  const extractDir = path.join(TEMP_DIR, "win-extract");

  if (!fs.existsSync(msixPath)) {
    await curlDownload(info.url, msixPath, "Windows MSIX");
  } else {
    console.log(`   [cache] ${msixPath}`);
  }

  console.log("   [unzip]");
  clearDir(extractDir);
  extractArchive(msixPath, extractDir);

  const resourcesDir = path.join(extractDir, "app", "resources");
  if (!fs.existsSync(resourcesDir)) {
    const alt = findFile(extractDir, "app.asar");
    throw new Error(`Windows: resources dir not found${alt ? `, app.asar at ${alt}` : ""}`);
  }

  assembleWindowsOutput(path.join(extractDir, "app"), destDir);
  return info;
}

function assembleWindowsOutput(appDir, destDir) {
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, "app.asar");
  if (!fs.existsSync(asarPath)) throw new Error(`Windows: app.asar not found: ${asarPath}`);

  const unpackedDir = path.join(resourcesDir, "app.asar.unpacked");
  const aliasCount = ensureDecodedScopeAliases(unpackedDir);
  if (aliasCount > 0) {
    console.log(`   [compat] created ${aliasCount} decoded scope alias dir(s) in app.asar.unpacked`);
  }

  console.log(`   [assemble] official app -> ${path.relative(PROJECT_ROOT, destDir)}/`);
  clearDir(destDir);
  const copied = copyRecursive(appDir, destDir, { preserveSymlinks: true });
  console.log(`   [copy] official app (${copied} files)`);

  const asarDest = path.join(destDir, "_asar");
  console.log("   [asar extract] resources/app.asar -> _asar/");
  execSync(`npx asar extract "${path.join(destDir, "resources", "app.asar")}" "${asarDest}"`);

  const total = countFiles(destDir);
  console.log(`   [ok] ${total} files total`);
}

// ─── Assemble output ────────────────────────────────────────────

function assembleOutput(resourcesDir, destDir, label) {
  const asarPath = path.join(resourcesDir, "app.asar");
  if (!fs.existsSync(asarPath)) throw new Error(`${label}: app.asar not found`);

  const unpackedDir = path.join(resourcesDir, "app.asar.unpacked");
  const aliasCount = ensureDecodedScopeAliases(unpackedDir);
  if (aliasCount > 0) {
    console.log(`   [compat] created ${aliasCount} decoded scope alias dir(s) in app.asar.unpacked`);
  }

  console.log(`   [assemble] -> ${path.relative(PROJECT_ROOT, destDir)}/`);
  clearDir(destDir);

  // 1. Extract app.asar → _asar/ (for patching)
  const asarDest = path.join(destDir, "_asar");
  console.log("   [asar extract] -> _asar/");
  execSync(`npx asar extract "${asarPath}" "${asarDest}"`);

  // 2. Copy app.asar.unpacked/ as-is (native modules)
  const unpackedSrc = path.join(resourcesDir, "app.asar.unpacked");
  if (fs.existsSync(unpackedSrc)) {
    const n = copyRecursive(unpackedSrc, path.join(destDir, "app.asar.unpacked"));
    console.log(`   [copy] app.asar.unpacked/ (${n} files)`);
  }

  // 3. Copy all other resources (binaries, plugins, native, etc.)
  let extraCount = 0;
  for (const e of fs.readdirSync(resourcesDir, { withFileTypes: true })) {
    if (e.name === "app.asar" || e.name === "app.asar.unpacked") continue;
    if (e.name.endsWith(".lproj")) continue;
    const s = path.join(resourcesDir, e.name);
    const d = path.join(destDir, e.name);
    if (e.isDirectory()) { extraCount += copyRecursive(s, d); }
    else if (!e.isSymbolicLink()) { fs.copyFileSync(s, d); extraCount++; }
  }
  console.log(`   [copy] ${extraCount} extra resource files`);

  const total = countFiles(destDir);
  console.log(`   [ok] ${total} files total`);
}

function findResourcesDir(extractDir) {
  const appDir = findFile(extractDir, "app.asar");
  return appDir ? path.dirname(appDir) : null;
}

// ─── Version state ──────────────────────────────────────────────

function loadVersions() {
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, "utf-8")); } catch { return {}; }
}
function saveVersions(v) {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(v, null, 2) + "\n");
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("== Codex upstream sync ==\n");
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const results = {};

  // Detect versions
  if (!SKIP_MAC) {
    try {
      const arm64Info = await getAppcastVersion(APPCAST_ARM64);
      console.log(`\n   mac-arm64: ${arm64Info.version} (build ${arm64Info.build})`);
      results["mac-arm64"] = arm64Info;
    } catch (e) { console.error(`   [x] mac-arm64 check: ${e.message}`); }

    try {
      const x64Info = await getAppcastVersion(APPCAST_X64);
      console.log(`   mac-x64:   ${x64Info.version} (build ${x64Info.build})`);
      results["mac-x64"] = x64Info;
    } catch (e) { console.error(`   [x] mac-x64 check: ${e.message}`); }
  }

  if (!SKIP_WIN) {
    try {
      const winInfo = await getWindowsVersion();
      console.log(`   win:       ${winInfo.version}`);
      results.win = winInfo;
    } catch (e) { console.error(`   [x] win check: ${e.message}`); }
  }

  if (CHECK_ONLY) {
    console.log("\n== Check only, skipping download ==");
    return;
  }

  // Download and extract
  if (!SKIP_MAC && results["mac-arm64"]) {
    try {
      results["mac-arm64"] = await syncMac("arm64", APPCAST_ARM64, path.join(PURE_SRC_DIR, "mac-arm64"));
    } catch (e) { console.error(`   [x] mac-arm64: ${e.message}`); }
  }
  if (!SKIP_MAC && results["mac-x64"]) {
    try {
      results["mac-x64"] = await syncMac("x64", APPCAST_X64, path.join(PURE_SRC_DIR, "mac-x64"));
    } catch (e) { console.error(`   [x] mac-x64: ${e.message}`); }
  }
  if (!SKIP_WIN && results.win) {
    try {
      results.win = await syncWin(path.join(PURE_SRC_DIR, "win"));
    } catch (e) { console.error(`   [x] win: ${e.message}`); }
  }

  const saved = loadVersions();
  for (const [key, info] of Object.entries(results)) {
    saved[key] = { version: info.version, build: info.build || "", checkedAt: new Date().toISOString() };
  }
  saveVersions(saved);

  console.log("\n== Done ==");
  for (const [key, info] of Object.entries(results)) {
    console.log(`   ${key}: ${info.version}`);
  }
}

main().catch((e) => { console.error(`\n[x] ${e.message}`); process.exit(1); });
