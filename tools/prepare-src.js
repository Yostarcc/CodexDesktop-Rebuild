#!/usr/bin/env node
/**
 * Pre-build: Repack patched ASAR, replace codex CLI, assemble for forge.
 *
 * Flow:
 *   1. Repack _asar/ -> app.asar (with patches applied)
 *   2. Replace codex binary with @cometix/codex version
 *   3. Copy everything to src/ for forge (app.asar + unpacked + resources)
 *
 * For Linux: strip macOS-only resources, add Linux codex from @cometix/codex
 *
 * Usage:
 *   node tools/prepare-src.js --platform mac-arm64
 *   node tools/prepare-src.js --platform linux-x64
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { copyRecursive } = require("./lib/common");
const { resolveCodexVendor, resolveRgVendor } = require("./lib/codex-vendor");

const SRC = path.join(__dirname, "..", "src");
const PROJECT_ROOT = path.join(__dirname, "..");

const REMOTE_CONTROL_CODEX_EXE = path.join(PROJECT_ROOT, "resources", "remote-control", "codex.exe");

async function main() {
  const args = process.argv.slice(2);
  const platIdx = args.indexOf("--platform");
  const platform = platIdx !== -1 ? args[platIdx + 1] : null;

  const VALID = ["mac-arm64", "mac-x64", "win", "linux-x64", "linux-arm64"];
  if (!platform || !VALID.includes(platform)) {
    console.error(`[x] Usage: prepare-src.js --platform <${VALID.join("|")}>`);
    process.exit(1);
  }

  const isLinux = platform.startsWith("linux");
  const sourceDir = isLinux
    ? path.join(SRC, platform === "linux-arm64" ? "mac-arm64" : "mac-x64")
    : path.join(SRC, platform);

  if (!fs.existsSync(sourceDir)) {
    console.error(`[x] Source not found: ${path.relative(PROJECT_ROOT, sourceDir)}/`);
    process.exit(1);
  }

  const asarContentDir = path.join(sourceDir, "_asar");
  if (!fs.existsSync(asarContentDir)) {
    console.error(`[x] _asar/ not found in ${path.relative(PROJECT_ROOT, sourceDir)}/`);
    process.exit(1);
  }

  console.log(`-- prepare-src: ${platform}`);
  console.log(`   source: ${path.relative(PROJECT_ROOT, sourceDir)}/`);

  // 1. Repack _asar/ -> app.asar
  const repackedAsar = path.join(sourceDir, "app.asar");
  console.log("   [repack] _asar/ -> app.asar");
  execSync(`npx asar pack "${asarContentDir}" "${repackedAsar}"`);
  const asarSize = (fs.statSync(repackedAsar).size / 1048576).toFixed(1);
  console.log(`   [ok] app.asar: ${asarSize} MB`);

  // 2. Replace codex binary with @cometix/codex
  const isWin = platform === "win";
  const codexBinName = isWin ? "codex.exe" : "codex";
  const vendorCodex = await resolveCodexVendor(PROJECT_ROOT, platform, {
    remoteControlPath: REMOTE_CONTROL_CODEX_EXE,
  });
  if (vendorCodex) {
    // For Linux: put codex in sourceDir (mac-x64/) so it can be found,
    // but also mark for later copy to forge output.
    const dest = path.join(sourceDir, codexBinName);
    fs.copyFileSync(vendorCodex, dest);
    try { fs.chmodSync(dest, 0o755); } catch {}
    console.log(`   [codex] replaced with @cometix/codex`);
  } else {
    console.log(`   [!] @cometix/codex vendor not found for ${platform}, keeping upstream`);
  }

  // 2b. For Linux: replace rg with platform-native version from @cometix/codex
  if (isLinux) {
    const vendorRg = await resolveRgVendor(PROJECT_ROOT, platform);
    if (vendorRg) {
      const dest = path.join(sourceDir, "rg");
      fs.copyFileSync(vendorRg, dest);
      try { fs.chmodSync(dest, 0o755); } catch {}
      console.log(`   [rg] replaced with Linux rg from @cometix/codex`);
    } else {
      console.log(`   [!] Linux rg not found in vendor, keeping upstream (will fail on Linux)`);
    }
  }

  // 3. For Linux: copy _asar/ content to flat src/ (forge packs ASAR from src/)
  //    Skip node_modules/ — upstream has macOS .node binaries.
  //    Native modules are rebuilt by electron-rebuild and synced separately.
  if (isLinux) {
    // Clear flat src/ dirs
    for (const d of [".vite", "webview", "skills", "native-menu-locales", "node_modules"]) {
      const p = path.join(SRC, d);
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
    }
    for (const f of fs.readdirSync(SRC)) {
      const p = path.join(SRC, f);
      if (fs.statSync(p).isFile()) fs.unlinkSync(p);
    }
    const skipDirs = new Set(["node_modules"]);
    const count = copyRecursive(asarContentDir, SRC, { skipDirs });
    console.log(`   [linux] _asar/ -> src/ (${count} files, skipped node_modules/)`);
  }

  // 4. Sync version to root package.json
  const upstreamPkg = path.join(asarContentDir, "package.json");
  if (fs.existsSync(upstreamPkg)) {
    const upstream = JSON.parse(fs.readFileSync(upstreamPkg, "utf-8"));
    const rootPkgPath = path.join(PROJECT_ROOT, "package.json");
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
    const oldVer = rootPkg.version;
    rootPkg.version = upstream.version || rootPkg.version;
    rootPkg.main = "src/.vite/build/bootstrap.js";
    for (const key of [
      "codexBuildNumber", "codexBuildFlavor",
      "codexSparkleFeedUrl", "codexSparklePublicKey",
      "codexWindowsUpdateUrl", "codexWindowsPackageIdentity",
      "codexWindowsPackagePublisher",
    ]) {
      if (upstream[key]) rootPkg[key] = upstream[key];
    }
    fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");
    console.log(`   version: ${oldVer} -> ${rootPkg.version}`);
  }

  // For mac/win: create stub main entry so forge validation passes.
  // The real code is in app.asar which we copy in packageAfterCopy.
  if (!isLinux) {
    const stubDir = path.join(SRC, ".vite", "build");
    fs.mkdirSync(stubDir, { recursive: true });
    fs.writeFileSync(path.join(stubDir, "bootstrap.js"), "// stub - real code in app.asar\n");
    // Also need package.json in src/ for forge
    const asarPkg = path.join(asarContentDir, "package.json");
    if (fs.existsSync(asarPkg)) {
      fs.copyFileSync(asarPkg, path.join(SRC, "package.json"));
    }
  }

  // Write build mode marker for forge.config.js
  const marker = path.join(SRC, ".build-mode");
  fs.writeFileSync(marker, isLinux ? "linux" : "upstream-asar");
  console.log(`   [mode] ${isLinux ? "linux (forge packs ASAR)" : "upstream-asar (pre-built)"}`);

  console.log(`   [ok] src/ ready for ${platform} build`);
}

main().catch((e) => {
  console.error(`[x] ${e.message}`);
  process.exit(1);
});
