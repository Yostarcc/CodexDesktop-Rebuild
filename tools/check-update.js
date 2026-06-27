#!/usr/bin/env node
/**
 * check-update.js — Codex 版本检测工具
 *
 * 检查 macOS (Sparkle appcast) 和 Windows (MS Store) 的最新版本
 * 与本地记录对比，仅在有更新时输出
 *
 * 用法:
 *   node tools/check-update.js              # 检查并对比
 *   node tools/check-update.js --force      # 强制输出（即使无更新）
 *   node tools/check-update.js --json       # JSON 输出
 *   node tools/check-update.js --save       # 更新本地版本记录
 */

const fs = require("fs");
const path = require("path");
const { formatSize } = require("./lib/common");
const {
  APPCAST_ARM64,
  APPCAST_X64,
  getAppcastVersion,
  getWindowsVersion,
} = require("./lib/codex-release");

// ─── 常量 ────────────────────────────────────────────────────────
const VERSION_FILE = path.join(__dirname, ".versions.json");

// ─── macOS: Sparkle appcast ──────────────────────────────────────
function toCheckUpdateInfo(info) {
  return {
    platform: info.platform,
    version: info.version,
    build: info.build || "",
    pubDate: info.pubDate || "",
    downloadUrl: info.downloadUrl || info.url || "",
    size: Number(info.size || 0),
    ...(info.minimumSystemVersion ? { minimumSystemVersion: info.minimumSystemVersion } : {}),
    ...(info.packageName ? { packageName: info.packageName } : {}),
  };
}

async function checkMacArm64Version() { return toCheckUpdateInfo(await getAppcastVersion(APPCAST_ARM64, "macOS-arm64")); }
async function checkMacX64Version() { return toCheckUpdateInfo(await getAppcastVersion(APPCAST_X64, "macOS-x64")); }

// ─── Windows: MS Store ───────────────────────────────────────────
async function checkWindowsVersion() {
  return toCheckUpdateInfo(await getWindowsVersion());
}

// ─── 版本记录读写 ────────────────────────────────────────────────
function loadVersions() {
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveVersions(versions) {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versions, null, 2) + "\n");
}

// ─── 主流程 ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const jsonOutput = args.includes("--json");
  const doSave = args.includes("--save");
  const quiet = jsonOutput || args.includes("--quiet") || args.includes("-q");

  const saved = loadVersions();
  const results = [];
  const updates = [];

  const checks = await Promise.allSettled([
    checkMacArm64Version(),
    checkMacX64Version(),
    checkWindowsVersion(),
  ]);

  for (const r of checks) {
    if (r.status === "fulfilled") {
      const info = r.value;
      results.push(info);
      const key = info.platform;
      const isNew = !saved[key] || saved[key].version !== info.version || saved[key].build !== info.build;
      if (isNew) updates.push(info);
    } else if (!quiet) {
      console.error(`  [!] ${r.reason.message}`);
    }
  }

  // JSON 输出模式
  if (jsonOutput) {
    const output = {
      timestamp: new Date().toISOString(),
      hasUpdates: updates.length > 0,
      platforms: Object.fromEntries(results.map((r) => [r.platform, r])),
      previous: saved,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    // 人类可读输出
    const toShow = force ? results : updates;

    if (toShow.length === 0 && !force) {
      if (!quiet) console.log("✅ 没有新版本。");
    } else {
      for (const info of toShow) {
        const isUpdate = updates.includes(info);
        const prevVersion = saved[info.platform]?.version || "无记录";
        const tag = isUpdate ? "🆕 新版本" : "📌 当前版本";

        console.log(`${tag} [${info.platform}]`);
        console.log(`  版本: ${info.version}${info.build ? ` (build ${info.build})` : ""}`);
        if (isUpdate && prevVersion !== "无记录") {
          console.log(`  旧版: ${prevVersion}${saved[info.platform]?.build ? ` (build ${saved[info.platform].build})` : ""}`);
        }
        if (info.pubDate) console.log(`  发布: ${info.pubDate}`);
        console.log(`  大小: ${formatSize(info.size)}`);
        if (info.packageName) console.log(`  包名: ${info.packageName}`);
        if (info.downloadUrl) {
          console.log(`  链接: ${info.downloadUrl.slice(0, 100)}${info.downloadUrl.length > 100 ? "..." : ""}`);
        }
        console.log();
      }
    }
  }

  // 保存版本记录
  if (doSave && results.length > 0) {
    const newSaved = { ...saved };
    for (const r of results) {
      newSaved[r.platform] = {
        version: r.version,
        build: r.build || undefined,
        checkedAt: new Date().toISOString(),
      };
    }
    saveVersions(newSaved);
    if (!quiet) console.log(`💾 版本记录已保存到 ${VERSION_FILE}`);
  }

  // 退出码: 0=有更新, 1=无更新（方便 CI 使用）
  if (!force && updates.length === 0) process.exitCode = 1;

  return { results, updates };
}

module.exports = { checkMacArm64Version, checkMacX64Version, checkWindowsVersion };

if (require.main === module) {
  main().catch((e) => {
    console.error(`\n❌ 错误: ${e.message}`);
    process.exit(2);
  });
}
