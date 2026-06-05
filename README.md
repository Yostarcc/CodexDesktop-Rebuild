# CodexDesktop-Rebuild

这个项目不是重写桌面端源码，而是：

- 同步官方 Codex Desktop 上游包
- 在官方 bundle 上做定点补丁
- 重新打包出可运行产物

目标只有一个：下次上游版本更新后，能最快完成同步、定位、补丁、打包。

## 最小工作流

固定流程：

`pure-src` -> 覆盖 `src` -> 应用 patch -> 打包到新的 `out-YYYYMMDDHHMMSS`

### 同步上游

```bash
node scripts/sync-upstream.js
```

作用：

- 拉取官方包
- 解包到 `pure-src/{platform}`
- 不直接改 `src`

### 应用补丁

```bash
node scripts/patch-all.js win
```

作用：

- 先用 `pure-src/win` 覆盖 `src/win`
- 再按 `scripts/patch-all.js` 的顺序打补丁

### 正式打包

```bash
node scripts/build-from-upstream.js --platform win
```

作用：

- 创建新的 `out-YYYYMMDDHHMMSS`
- 内部自动跑 `patch-all.js`
- 重打 `app.asar`
- 修正完整性 hash
- 输出最终可运行目录

## 目录约束

- `pure-src/`
  - 官方原始包
  - 永远不直接手改
- `src/`
  - patch 临时工作区
  - 每次 patch 前都会被 `pure-src` 覆盖
- `scripts/`
  - 正式 patch 和构建脚本
- `out-YYYYMMDDHHMMSS/`
  - 正式产物

## 补丁原则

- 只针对当前 upstream bundle 写 patch。
- 不在历史补丁产物上继续叠补丁。
- 不保留无意义的旧兼容逻辑。
- 优先用“当前真实 bundle 的精确字符串替换”。
- 只有在 `app-main-*.js` 这种超大文件里字符串不稳时，才考虑 AST。

## 当前正式补丁链路

`scripts/patch-all.js` 当前只保留这些正式 patch：

- `patch-i18n.js`
- `patch-sidebar-layout.js`
- `patch-single-tooltip.js`
- `patch-window-header-view-menu.js`
- `patch-thread-header-actions.js`
- `patch-composer-footer-layout.js`
- `patch-composer-run-controls-inline.js`
- `patch-composer-permissions-trigger.js`
- `patch-primary-runtime-progress.js`
- `patch-cursor-interaction.js`
- `patch-copyright.js`
- `patch-devtools.js`
- `patch-fast-mode.js`
- `patch-plugin-auth.js`
- `patch-updater.js`

## 快速定位规则

### 1. 侧栏项目相关

文件：

- `src/win/_asar/webview/assets/app-main-*.js`

常用搜索：

```bash
rg -n "children:\\[y,b,k\\]|function nE\\(|workspaceOptions|group-hover/folder-row" src/win/_asar/webview/assets/app-main-*.js
```

已验证有效的思路：

- 项目项右侧区域 `children:[y,b,k]` 中：
  - `y` = 本地项目菜单挂载器
  - `b` = 远程项目菜单挂载器
  - `k` = 新建对话按钮
- 不要再改 `children:[y,b,k]` 这层结构来隐藏按钮。
- 隐藏三点必须只隐藏菜单 trigger 按钮本身，不要删挂载器，不要删 `k`。
- 项目路径 tooltip 直接走 `nE(...)` 的 `labelTooltipContent`。
- tooltip 无延迟，改 `delayOpen:!0` 为 `delayOpen:0`。

### 2. 运行位置 / 分支按钮迁移

文件：

- `src/win/_asar/webview/assets/composer-external-footer-*.js`
- `src/win/_asar/webview/assets/local-remote-dropdown-*.js`
- `src/win/_asar/webview/assets/composer-*.js`

常用搜索：

```bash
rg -n "Qp.ExternalFooterSlot|localRemoteWhereRun|function Xm\\(e\\)|inline-composer" src/win/_asar/webview/assets
```

已验证有效的思路：

- 不要再用运行时 DOM 搬运。
- 直接改 bundle 渲染结构。
- `composer-external-footer` 中：
  - `inline-composer` 必须直接 `return zt`
  - 只返回两个按钮本身，不带外层 wrapper
- `composer-lF7iMnqa.js` 中：
  - 给 `Xm(...)` 增加 `inlineFooterControls`
  - 把 `ComposerExternalFooter` 的 `inline-composer` 版本塞进 `Qp.FooterAction`
  - `Qp.ExternalFooterSlot` 仅保留 `home`
- `local-remote-dropdown` 中：
  - inline trigger 去掉文字，只保留图标和箭头

### 3. 发送按钮左侧短暂出现的语音按钮

文件：

- `src/win/_asar/webview/assets/composer-*.js`

已验证有效的思路：

- 只移除 footer 中插在发送按钮左侧的那颗 voice trigger
- 不碰 stop / send / realtime 其他逻辑
- 当前做法是在 `patch-composer-footer-layout.js` 中把 `Ue` 单独置空

## 不要再做的事

- 不要在 bundle 里注入 `MutationObserver + querySelector` 去搬节点。
- 不要在 README 里保留泛化 Electron 模板说明。
- 不要把“调试脚本 / 临时分析文件 / 对比文本”长期留在项目根目录。
- 不要为了兼容旧 patch 结构去增加新的兼容分支。

## 推荐升级步骤

1. 跑 `node scripts/sync-upstream.js`
2. 跑 `node scripts/patch-all.js win`
3. 如果 patch 失败：
   - 直接在 `src/win/_asar/webview/assets` 搜当前真实字符串
   - 修 patch，不要猜旧变量名
4. 跑 `node scripts/build-from-upstream.js --platform win`
5. 只验证最新的 `out-YYYYMMDDHHMMSS`

## 当前交付习惯

- 保留最新一个可运行 `out-*` 目录即可。
- 旧 `out-*`、临时 bundle 拷贝、对比文本、调试 patch 脚本都应该及时清理。
