const { XMLParser } = require("fast-xml-parser");

const msstore = require("../fetch-msstore");
const { httpGetBuffer, selectLatestWindowsPackage } = require("./common");

const APPCAST_ARM64 = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";
const APPCAST_X64 = "https://persistent.oaistatic.com/codex-app-prod/appcast-x64.xml";
const MS_STORE_PRODUCT_ID = "9plm9xgg6vks";

async function getAppcastVersion(url, platformLabel = "") {
  const res = await httpGetBuffer(url);
  if (res.status !== 200) throw new Error(`Appcast fetch failed: ${res.status}`);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
  });
  const parsed = parser.parse(res.body.toString("utf-8"));
  const items = parsed.rss?.channel?.item;
  const latest = Array.isArray(items) ? items[0] : items;
  if (!latest) throw new Error(`${platformLabel || url}: no version in appcast`);

  let enclosure = latest.enclosure;
  if (Array.isArray(enclosure)) enclosure = enclosure[0];

  return {
    platform: platformLabel,
    version: latest.shortVersionString || latest.title,
    build: String(latest.version || ""),
    pubDate: latest.pubDate || "",
    downloadUrl: enclosure?.["@_url"] || "",
    url: enclosure?.["@_url"] || "",
    size: Number(enclosure?.["@_length"] || 0),
    minimumSystemVersion: latest.minimumSystemVersion || "",
  };
}

async function getWindowsVersion(options = {}) {
  const {
    productId = MS_STORE_PRODUCT_ID,
    market = "US",
    ring = "Retail",
    arch = "x64",
  } = options;

  const cookie = await msstore.getCookie();
  const appInfo = await msstore.getAppInfo(productId, market);
  if (!appInfo.categoryId) throw new Error("No CategoryID");

  const packages = await msstore.getFileList(cookie, appInfo.categoryId, ring);
  if (packages.length === 0) throw new Error("No packages");

  const pkg = selectLatestWindowsPackage(packages, arch);
  if (!pkg) throw new Error(`No Windows ${arch} package`);

  const url = await msstore.getDownloadUrl(pkg.updateID, pkg.revisionNumber, ring, pkg.digest);
  if (!url) throw new Error(`Could not resolve download URL for ${pkg.name}`);

  return {
    platform: "Windows",
    version: pkg.version,
    build: "",
    pubDate: "",
    downloadUrl: url,
    url,
    size: Number(pkg.size || 0),
    packageName: pkg.name,
    appInfo,
    package: pkg,
  };
}

module.exports = {
  APPCAST_ARM64,
  APPCAST_X64,
  MS_STORE_PRODUCT_ID,
  getAppcastVersion,
  getWindowsVersion,
};
