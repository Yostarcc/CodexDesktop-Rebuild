const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const tar = require("tar");

const { clearDir } = require("./common");

const TARGET_TRIPLE_MAP = {
  "mac-arm64": "aarch64-apple-darwin",
  "mac-x64": "x86_64-apple-darwin",
  "linux-x64": "x86_64-unknown-linux-musl",
  "linux-arm64": "aarch64-unknown-linux-musl",
  "win": "x86_64-pc-windows-msvc",
};

const PLATFORM_PACKAGE_MAP = {
  "linux-x64": "codex-linux-x64",
  "linux-arm64": "codex-linux-arm64",
  "mac-arm64": "codex-darwin-arm64",
  "mac-x64": "codex-darwin-x64",
  "win": "codex-win32-x64",
};

const PLATFORM_SUFFIX_MAP = {
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
  "mac-arm64": "darwin-arm64",
  "mac-x64": "darwin-x64",
  "win": "win32-x64",
};

const REMOTE_CONTROL_CODEX_MARKERS = [
  "remote_control_app_server_isolated_oauth_used",
  "remote_control_native_remote_json_first",
  "remote_control_websocket_proxy_attempt",
  "remote_control_websocket_proxy_connected",
  "remote-control-oauth.json",
  "remote.json",
  "codex.remote_control.enroll",
];

const vendorRootCache = new Map();

function getCodexBinName(platform) {
  return platform === "win" ? "codex.exe" : "codex";
}

function getRgBinName(platform) {
  return platform === "win" ? "rg.exe" : "rg";
}

function validateRemoteControlCodex(filePath) {
  const bytes = fs.readFileSync(filePath);
  const missing = REMOTE_CONTROL_CODEX_MARKERS.filter((marker) =>
    !bytes.includes(Buffer.from(marker, "utf8")),
  );
  if (missing.length > 0) {
    throw new Error(`remote-control codex.exe is missing marker(s): ${missing.join(", ")}`);
  }
}

async function resolveCometixVendorRoot(projectRoot, platform) {
  const cacheKey = `${projectRoot}:${platform}`;
  if (vendorRootCache.has(cacheKey)) return vendorRootCache.get(cacheKey);

  const triple = TARGET_TRIPLE_MAP[platform];
  if (!triple) return null;

  const platformPackage = PLATFORM_PACKAGE_MAP[platform];
  if (platformPackage) {
    const candidate = path.join(projectRoot, "node_modules", "@cometix", platformPackage, "vendor", triple);
    if (fs.existsSync(candidate)) {
      vendorRootCache.set(cacheKey, candidate);
      return candidate;
    }
  }

  const oldPath = path.join(projectRoot, "node_modules", "@cometix", "codex", "vendor", triple);
  if (fs.existsSync(oldPath)) {
    vendorRootCache.set(cacheKey, oldPath);
    return oldPath;
  }

  const suffix = PLATFORM_SUFFIX_MAP[platform];
  if (!suffix) return null;

  let baseVersion;
  try {
    baseVersion = execSync("npm view @cometix/codex version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }

  const spec = `@cometix/codex@${baseVersion}-${suffix}`;
  console.log(`   [vendor] fetching ${spec} via npm pack...`);
  const tmpDir = path.join(os.tmpdir(), "cometix-codex-pack");
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const tgzName = execSync(`npm pack ${spec} --pack-destination "${tmpDir}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim().split("\n").pop();

    const extractDir = path.join(tmpDir, "extracted");
    clearDir(extractDir);
    await tar.x({ file: path.join(tmpDir, tgzName), cwd: extractDir });

    const vendorRoot = path.join(extractDir, "package", "vendor", triple);
    if (fs.existsSync(vendorRoot)) {
      vendorRootCache.set(cacheKey, vendorRoot);
      return vendorRoot;
    }
  } catch (error) {
    console.log(`   [!] npm pack failed: ${error.message}`);
  }

  return null;
}

async function resolveCodexVendor(projectRoot, platform, options = {}) {
  if (platform === "win" && options.remoteControlPath && fs.existsSync(options.remoteControlPath)) {
    validateRemoteControlCodex(options.remoteControlPath);
    return options.remoteControlPath;
  }

  const vendorRoot = await resolveCometixVendorRoot(projectRoot, platform);
  if (!vendorRoot) return null;

  const binPath = path.join(vendorRoot, "codex", getCodexBinName(platform));
  return fs.existsSync(binPath) ? binPath : null;
}

async function resolveRgVendor(projectRoot, platform) {
  const vendorRoot = await resolveCometixVendorRoot(projectRoot, platform);
  if (!vendorRoot) return null;

  const binPath = path.join(vendorRoot, "path", getRgBinName(platform));
  return fs.existsSync(binPath) ? binPath : null;
}

module.exports = {
  TARGET_TRIPLE_MAP,
  getCodexBinName,
  getRgBinName,
  resolveCodexVendor,
  resolveCometixVendorRoot,
  resolveRgVendor,
  validateRemoteControlCodex,
};
