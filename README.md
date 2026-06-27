你必须阅读下方的所有规则，并且严格遵守！！！

你必须阅读下方的所有规则，并且严格遵守！！！

你必须阅读下方的所有规则，并且严格遵守！！！



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
node tools/sync-upstream.js
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
node tools/build-from-upstream.js --platform win
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
  - 永远都不能改，作为最纯净的原本，绝对不能进行任何修改，除非是官方版本有更新，才能拉取最新的官方包进行覆盖
- `src/`
  - patch 临时工作区
  - 每次 patch 前都会被 `pure-src` 覆盖
  - 永远不直接改，只能作为在 bundle 上做定点补丁的目标文件进行参考
- `scripts/`
  - 正式 patch 脚本
- `tools/`
  - 同步、下载、构建等辅助工具脚本
- `out-YYYYMMDDHHMMSS/`
  - 正式产物

## 补丁原则

- 只针对当前 upstream bundle 写 patch。
- 一定程度上参考之前的Patch逻辑，如果只是变量名修改，那就进行最小代价的替换
- 不保留无意义的旧兼容逻辑。
- 优先用“当前真实 bundle 的精确字符串替换”。
- 只有在 `app-main-*.js` 这种超大文件里字符串不稳时，才考虑 AST。

## 当前正式补丁链路

`scripts/patch-all.js` 当前只保留这些正式 patch：

- `patch-i18n.js`
- `patch-sidebar-layout.js`
- `patch-thread-header-actions.js`
- `patch-composer-footer-voice-btn.js`
- `patch-composer-footer-run-controls.js`
- `patch-composer-permissions-trigger.js`
- `patch-devtools.js`
- `patch-fast-mode.js`
- `patch-updater.js`

## 可选补丁链路

这些补丁不进入默认 `patch-all.js`，需要明确确认对应功能后手动执行。

### 手机 Remote Control 本机入口

```bash
node scripts/patch-remote-control.js win --check
node scripts/patch-remote-control.js win
```

作用：

- 让 Windows 的 `Settings -> Connections` 显示 `Control this PC` 本机入口。
- 本机启用手机控制前，先触发 `authorize-remote-control-connections`。
- 401 时不再强制跳转 ChatGPT 登录页，只保留当前流程内的错误状态。

边界：

- 不默认加入正式 patch 链路。
- 不处理 MSIX 安装态、OAuth token 注入、device key fallback 或手机端 API endpoint 诊断。
- 如果后续要做完整手机远控链路，再单独把主进程 `app-main-*.js` 的授权和诊断补丁纳入评估。

### 手机 Remote Control native 二进制接入

如果需要把外部项目里重建过的 `codex.exe` 接到当前构建链，放到：

`resources/remote-control/codex.exe`

Windows 构建时会自动优先复制这个文件到最终产物的 `resources\codex.exe`。文件必须包含 remote-control 相关 marker；否则会回退到默认 `@cometix/codex`，或者在 marker 不完整时直接报错。

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
- 当前做法是在 `patch-composer-footer-voice-btn.js` 中把 voice trigger render 置空

## 不要再做的事

- 不要在 bundle 里注入 `MutationObserver + querySelector` 去搬节点。
- 不要在 README 里保留泛化 Electron 模板说明。
- 不要把“调试脚本 / 临时分析文件 / 对比文本”长期留在项目根目录。
- 不要为了兼容旧 patch 结构去增加新的兼容分支。

## 推荐升级步骤

1. 跑 `node tools/sync-upstream.js`
2. 跑 `node scripts/patch-all.js win`
3. 如果 patch 失败：
   - 直接在 `src/win/_asar/webview/assets` 搜当前真实字符串，同时参考之前的Patch逻辑，如果只是变量名修改，那就进行最小代价的替换！除非目标的代码结构发生变化，这个时候需要主动提醒用户
   - 修 patch，不要猜旧变量名
4. 跑 `node tools/build-from-upstream.js --platform win`
5. 只验证最新的 `out-YYYYMMDDHHMMSS`

## 当前交付习惯

- 每次正式打包都会生成新的 `out-YYYYMMDDHHMMSS` 产物目录。
- 旧 `out-*` 产物默认保留，不主动删除，也不主动移动到回收站。
- 只有用户明确要求清理旧产物时，才按回收站方式处理旧 `out-*`。
- 临时 bundle 拷贝、对比文本、调试 patch 脚本仍应及时清理。
