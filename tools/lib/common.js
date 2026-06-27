const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { execFileSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function makeTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function compareVersions(a, b) {
  const left = String(a).split(".").map((part) => Number(part) || 0);
  const right = String(b).split(".").map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function formatSize(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return "Unknown";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
  return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function parseWindowsPackageVersion(name, arch = "x64") {
  const escapedArch = String(arch).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^OpenAI\\.Codex_(\\d+\\.\\d+\\.\\d+(?:\\.\\d+)?)_${escapedArch}__.*\\.(?:msix|appx)$`, "i");
  const match = String(name).match(pattern);
  return match ? match[1] : "";
}

function selectLatestWindowsPackage(packages, arch = "x64") {
  return packages
    .map((pkg) => ({ ...pkg, version: parseWindowsPackageVersion(pkg.name, arch) }))
    .filter((pkg) => pkg.version)
    .sort((a, b) => compareVersions(b.version, a.version))[0] || null;
}

function httpGetBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        httpGetBuffer(new URL(res.headers.location, url).toString()).then(resolve, reject);
        return;
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

function downloadFile(url, destPath, options = {}) {
  const { progress = true, logPrefix = "   [download]", logIntervalMs = 500 } = options;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    let finished = false;

    const fail = (error) => {
      if (finished) return;
      finished = true;
      file.destroy();
      try { fs.unlinkSync(destPath); } catch {}
      reject(error);
    };

    const request = (currentUrl) => {
      const client = currentUrl.startsWith("https:") ? https : http;
      const req = client.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          request(new URL(res.headers.location, currentUrl).toString());
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          fail(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const total = Number(res.headers["content-length"] || 0);
        let downloaded = 0;
        let lastLog = 0;

        res.on("data", (chunk) => {
          downloaded += chunk.length;
          const now = Date.now();
          if (progress && total > 0 && now - lastLog > logIntervalMs) {
            lastLog = now;
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r${logPrefix} ${pct}% (${formatSize(downloaded)} / ${formatSize(total)})`);
          }
        });

        res.pipe(file);
        res.on("error", fail);
        file.on("error", fail);
        file.on("finish", () => {
          if (finished) return;
          finished = true;
          if (progress && total > 0) process.stdout.write("\n");
          file.close(() => resolve(destPath));
        });
      });

      req.on("error", fail);
      req.setTimeout(30000, () => req.destroy(new Error("Download timeout")));
    };

    request(url);
  });
}

function clearDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function shouldSkip(filter, entry) {
  if (!filter) return false;
  if (filter instanceof Set) return filter.has(entry.name);
  if (typeof filter === "function") return filter(entry);
  return false;
}

function copyRecursive(src, dest, options = {}) {
  const { skipFiles, skipDirs, preserveSymlinks = false } = options;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && shouldSkip(skipDirs, entry)) continue;
    if (!entry.isDirectory() && shouldSkip(skipFiles, entry)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyRecursive(srcPath, destPath, options);
    } else if (entry.isSymbolicLink()) {
      if (preserveSymlinks) {
        const target = fs.readlinkSync(srcPath);
        try { fs.symlinkSync(target, destPath); } catch {}
        count++;
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return count;
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return fullPath;
    if (entry.isDirectory()) {
      const result = findFile(fullPath, name);
      if (result) return result;
    }
  }
  return null;
}

function hashFile(filePath, algorithm = "sha256") {
  const crypto = require("crypto");
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest("hex");
}

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPowerShell(script, options = {}) {
  return execFileSync("pwsh", [
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ], { stdio: "pipe", ...options });
}

function assertInside(child, parent) {
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  const relative = path.relative(resolvedParent, resolvedChild);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside expected directory: ${resolvedChild}`);
  }
}

function safeRemoveInside(target, parent) {
  if (!fs.existsSync(target)) return;
  assertInside(target, parent);
  fs.rmSync(target, { recursive: true, force: true });
}

module.exports = {
  PROJECT_ROOT,
  assertInside,
  clearDir,
  compareVersions,
  copyRecursive,
  countFiles,
  downloadFile,
  findFile,
  formatSize,
  hashFile,
  httpGetBuffer,
  makeTimestamp,
  parseWindowsPackageVersion,
  psLiteral,
  runPowerShell,
  safeRemoveInside,
  selectLatestWindowsPackage,
};
