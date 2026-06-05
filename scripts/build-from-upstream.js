#!/usr/bin/env node
/**
 * build-from-upstream.js — Patch upstream Codex and repackage
 *
 * For macOS and Windows: no forge needed.
 * Takes the upstream app, patches ASAR in-place, replaces codex CLI, outputs distributable.
 *
 * Usage:
 *   node scripts/build-from-upstream.js --platform mac-arm64
 *   node scripts/build-from-upstream.js --platform mac-x64
 *   node scripts/build-from-upstream.js --platform win
 *   node scripts/build-from-upstream.js --platform win --skip-patches
 *   node scripts/build-from-upstream.js --platform win --with-zip
 *   node scripts/build-from-upstream.js --platform win --out-dir out-custom
 */
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
const tar = require("tar");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(PROJECT_ROOT, "src");

function makeTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

const outDirArgIndex = process.argv.indexOf("--out-dir");
const OUT_DIR = outDirArgIndex !== -1
  ? path.resolve(PROJECT_ROOT, process.argv[outDirArgIndex + 1])
  : path.join(PROJECT_ROOT, `out-${makeTimestamp()}`);

const TARGET_TRIPLE_MAP = {
  "mac-arm64": "aarch64-apple-darwin",
  "mac-x64": "x86_64-apple-darwin",
  "win": "x86_64-pc-windows-msvc",
};

// ─── Helpers ────────────────────────────────────────────────────

function clearDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) { count += copyRecursive(s, d); }
    else if (e.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      try { fs.symlinkSync(target, d); } catch {}
      count++;
    } else {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

function runPatches(platform) {
  console.log(`   [patch] patch-all ${platform}`);
  execFileSync("node", [path.join(__dirname, "patch-all.js"), platform], { stdio: "inherit" });
}

async function resolveCodexVendor(platform) {
  const triple = TARGET_TRIPLE_MAP[platform];
  if (!triple) return null;
  const binName = platform === "win" ? "codex.exe" : "codex";

  // Try platform-specific package (0.128+)
  const PKG_MAP = { "mac-arm64": "codex-darwin-arm64", "mac-x64": "codex-darwin-x64", "win": "codex-win32-x64" };
  const platPkg = PKG_MAP[platform];
  if (platPkg) {
    const p = path.join(PROJECT_ROOT, "node_modules", "@cometix", platPkg, "vendor", triple, "codex", binName);
    if (fs.existsSync(p)) return p;
  }
  // Try old-style vendor (pre-0.128)
  const localPath = path.join(PROJECT_ROOT, "node_modules", "@cometix", "codex", "vendor", triple, "codex", binName);
  if (fs.existsSync(localPath)) return localPath;

  // npm pack fallback — fetch platform-specific package
  // First get latest cometix base version, then append platform suffix
  const PLAT_SUFFIX = {
    "mac-arm64": "darwin-arm64", "mac-x64": "darwin-x64",
    "win": "win32-x64",
    "linux-x64": "linux-x64", "linux-arm64": "linux-arm64",
  };
  const suffix = PLAT_SUFFIX[platform];
  if (!suffix) return null;

  let baseVer;
  try {
    baseVer = execSync("npm view @cometix/codex version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch { return null; }

  // e.g. "0.128.0-cometix" → "@cometix/codex@0.128.0-cometix-darwin-x64"
  const platPkgSpec = `@cometix/codex@${baseVer}-${suffix}`;
  console.log(`   [codex] fetching ${platPkgSpec} via npm pack...`);
  const tmpDir = path.join(require("os").tmpdir(), "cometix-codex-pack");
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    const tgzName = execSync(`npm pack ${platPkgSpec} --pack-destination "${tmpDir}"`, {
      cwd: tmpDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
    }).trim().split("\n").pop();
    const extractDir = path.join(tmpDir, "extracted");
    clearDir(extractDir);
    await tar.x({ file: path.join(tmpDir, tgzName), cwd: extractDir });
    const p = path.join(extractDir, "package", "vendor", triple, "codex", binName);
    if (fs.existsSync(p)) return p;
  } catch (e) {
    console.log(`   [!] npm pack failed: ${e.message}`);
  }
  return null;
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
  const tempDir = path.join(require("os").tmpdir(), "codex-sync");
  const variant = platform === "mac-arm64" ? "arm64" : "x64";
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

  // Windows: use the MSIX extract cache
  const tempDir = path.join(require("os").tmpdir(), "codex-sync");
  const extractDir = path.join(tempDir, "win-extract");
  const appDir = path.join(extractDir, "app");

  if (!fs.existsSync(appDir)) {
    console.error(`[x] MSIX extract not found. Run sync-upstream first.`);
    process.exit(1);
  }

  // Copy app/ to output
  const outAppDir = path.join(OUT_DIR, "win");
  clearDir(outAppDir);
  const outApp = path.join(outAppDir, "Codex-win32-x64");
  console.log("   [copy] MSIX app/ -> out/");
  copyRecursive(appDir, outApp);

  const resourcesDir = path.join(outApp, "resources");

  // Compute old ASAR header hash (before repack)
  const asarPath = path.join(resourcesDir, "app.asar");
  const oldHash = computeAsarHeaderHash(asarPath);
  console.log(`   [integrity] old hash: ${oldHash.slice(0, 16)}...`);

  // Repack patched ASAR
  console.log("   [asar pack] _asar/ -> app.asar");
  execSync(`npx asar pack "${asarDir}" "${asarPath}"`);

  // Compute new hash and patch exe
  const newHash = computeAsarHeaderHash(asarPath);
  console.log(`   [integrity] new hash: ${newHash.slice(0, 16)}...`);

  if (oldHash !== newHash) {
    updateWindowsRuntimeIntegrity(resourcesDir, asarPath);
  }

  // Replace codex CLI
  await replaceCodex(platform, resourcesDir, "codex.exe");

  const version = getVersion(asarDir);
  let zipPath = null;
  if (withZip) {
    const zipName = `Codex-win-x64-${version}.zip`;
    zipPath = path.join(OUT_DIR, zipName);
    console.log(`   [zip] ${zipName}`);
    const ps = [
      "$ErrorActionPreference='Stop'",
      `$src='${outApp.replace(/'/g, "''")}'`,
      `$zip='${zipPath.replace(/'/g, "''")}'`,
      "if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }",
      "Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip -CompressionLevel Optimal -Force",
    ].join("; ");
    execSync(`pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, { stdio: "pipe" });

    const sizeMB = (fs.statSync(zipPath).size / 1048576).toFixed(1);
    console.log(`   [ok] ${zipPath} (${sizeMB} MB)`);
  } else {
    console.log("   [zip] skipped");
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

function patchExeHash(exePath, oldHash, newHash) {
  const buf = fs.readFileSync(exePath);
  const oldBuf = Buffer.from(oldHash, "ascii");
  const idx = buf.indexOf(oldBuf);
  if (idx < 0) {
    console.log("   [!] old hash not found in exe");
    return;
  }
  Buffer.from(newHash, "ascii").copy(buf, idx);
  fs.writeFileSync(exePath, buf);
  console.log(`   [integrity] exe hash patched at offset ${idx}`);
}

function computeFileSha256(filePath) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function updateWindowsRuntimeIntegrity(resourcesDir, asarPath) {
  const owlConfigPath = path.join(resourcesDir, "owl-electron-app.json");
  if (!fs.existsSync(owlConfigPath)) {
    console.log("   [!] owl-electron-app.json not found for runtime integrity patching");
    return;
  }

  const runtimeSha = computeFileSha256(asarPath);
  const config = JSON.parse(fs.readFileSync(owlConfigPath, "utf-8"));
  config.runtimeArchiveSha = runtimeSha;
  fs.writeFileSync(owlConfigPath, JSON.stringify(config, null, 2) + "\n");
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
  const vendor = await resolveCodexVendor(platform);
  if (vendor) {
    const dest = path.join(resourcesDir, binName);
    fs.copyFileSync(vendor, dest);
    try { fs.chmodSync(dest, 0o755); } catch {}
    console.log(`   [codex] replaced with @cometix/codex`);
  } else {
    console.log(`   [!] @cometix/codex not found, keeping upstream codex`);
  }
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

main().catch((e) => {
  console.error(`[x] ${e.message}`);
  process.exit(1);
});
