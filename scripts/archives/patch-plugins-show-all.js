#!/usr/bin/env node
/**
 * Patch: 让非登录状态下也能看到所有 OpenAI curated marketplace 插件
 *
 * 原逻辑：
 * - function pe(e){return e!=="chatgpt"&&e!=="apikey"&&e!=="amazonBedrock"}
 * - 当 authMethod 为 null（非登录）时，pe() 返回 true，导致隐藏 openai-curated 系列 marketplace
 *
 * 修改：
 * - 将 pe 函数改为永远返回 false，即 function pe(e){return false}
 * - 这样无论登录状态如何，都不会触发隐藏逻辑
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.join(__dirname, '../src/win/_asar/webview/assets/use-plugins-fSkqJBLX.js');

console.log('[Patch] 修改插件显示逻辑，让非登录状态也能看到所有插件...');

let content = fs.readFileSync(TARGET_FILE, 'utf8');

// 精确匹配 pe 函数定义
// 原函数：function pe(e){return e!==`chatgpt`&&e!==`apikey`&&e!==`amazonBedrock`}
const originalPattern = /function pe\(e\)\{return e!==`chatgpt`&&e!==`apikey`&&e!==`amazonBedrock`\}/;

if (!originalPattern.test(content)) {
  console.log('[Patch] ⚠️  未找到目标函数，可能已被修改或上游代码变更');
  process.exit(0);
}

// 替换为永远返回 false
content = content.replace(
  originalPattern,
  'function pe(e){return false}'
);

fs.writeFileSync(TARGET_FILE, content, 'utf8');

console.log('[Patch] ✅ 已将 pe 函数修改为永远返回 false');
console.log('[Patch] 现在非登录状态下也能看到完整的插件列表');
