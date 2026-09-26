[English](README_en.md) | 中文

# SakuraMeter — ChatGPT & Codex Usage Tracker

![SakuraMeter](assets/sakurameter-128.png)

**3.6.0.61**

在浏览器本地记录 ChatGPT 活动，查看热力图、使用趋势和 Codex 额度。保留 Sakura 玻璃风格，提供樱花粉浅色和深色主题、中英文界面。

## 产品预览

<img src="https://raw.githubusercontent.com/YinL-k/chatgpt-codex-usage-tracker/main/store-assets/en/preview/large-promotional.jpg?v=3a031125" alt="SakuraMeter promotional banner" />

下面展示 6 张英文版商店截图。

<table>
<tr><td width="50%"><img src="https://raw.githubusercontent.com/YinL-k/chatgpt-codex-usage-tracker/main/store-assets/en/preview/01-popup-dark.jpg?v=3a031125" alt="Popup dark" /></td><td width="50%"><img src="https://raw.githubusercontent.com/YinL-k/chatgpt-codex-usage-tracker/main/store-assets/en/preview/02-popup-light.jpg?v=3a031125" alt="Popup light" /></td></tr>
<tr><td width="50%"><img src="https://raw.githubusercontent.com/YinL-k/chatgpt-codex-usage-tracker/main/store-assets/en/preview/03-overview-dark.jpg?v=3a031125" alt="Overview dark" /></td><td width="50%"><img src="https://raw.githubusercontent.com/YinL-k/chatgpt-codex-usage-tracker/main/store-assets/en/preview/04-overview-light.jpg?v=3a031125" alt="Overview light" /></td></tr>
<tr><td width="50%"><img src="https://raw.githubusercontent.com/YinL-k/chatgpt-codex-usage-tracker/main/store-assets/en/preview/05-activity-dark.jpg?v=3a031125" alt="Activity dark" /></td><td width="50%"><img src="https://raw.githubusercontent.com/YinL-k/chatgpt-codex-usage-tracker/main/store-assets/en/preview/06-activity-light.jpg?v=3a031125" alt="Activity light" /></td></tr>
</table>

## 本版功能

- **发送确认**：点击、Enter 或表单提交只记录发送意图，匹配到新用户消息后才计数；排除空输入、失败发送、重复事件和历史回放。
- **Overview / Activity / Usage**：活动趋势、全年热力图、月周柱状图、时段分布、个人用量和校准。三张统计卡片等高，周记录较多时仅图表内部横向滚动。
- **一致的主题与控件**：主题切换保持尺寸、滚动、输入和展开状态；统一会员栏、Live 标签、下拉菜单、整框可点击的日期时间选择和操作按钮，支持键盘与 reduced-motion。
- **只读额度刷新**：读取已有 ChatGPT 登录会话与 usage，动态显示 Codex 窗口时长；失败保留缓存，不自动重载聊天页，不提交聊天或调用模型。
- **Codex Reset**：读取 codex-reset.com 公开全局重置预测。属于实验性第三方预测，不是个人额度重置或官方保证。

## 安装与升级

下载此仓库 ZIP 并解压，打开 `chrome://extensions`，开启开发者模式，点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的仓库目录。安装后正常刷新一次 ChatGPT 页面，使消息统计脚本生效。

升级前先导出活动备份并备份原源码目录。要保留同一扩展 ID 下的历史、手动计划和校准，请更新原加载路径的文件，再在扩展管理页重新加载；不要先卸载旧扩展。活动导出仅含日期统计，不包含计划或校准。另选路径可能生成不同扩展 ID。

## 数据、权限与网络

统计在本地保存，不保存聊天正文、密码或认证令牌；发送确认短暂在内存比较文本，过期即丢弃。保留历史日期键、`__gptUsageV4`、schema 3、手动计划与校准；活动导出格式 version 5，appVersion 3.6.0.61。

当前权限为 `storage`、`tabs` 和 `https://chatgpt.com/*`。与本次优化前的 3.4 源码一致；与仓库旧 2.0.0 的仅 storage 权限不同。个人额度使用 GET `/api/auth/session` 和 `/backend-api/wham/usage`，令牌仅用于请求内存。公开预测使用不携带账户信息的 GET；第三方会收到 IP 等普通连接元数据。无开发者后台、遥测、对话创建或模型生成请求。详见 [隐私说明](PRIVACY.md)。

未知额度不补造数值；Pro 余额在手动校准后为本地估算。私有 API 和页面结构可能变化。当前自动化使用本地合成夹具，未将其视为真实登录账户或扩展安装验收。

## 验证

在 `tests` 目录执行 `npm install`，再执行 `npm test`。浏览器测试需要安装 Google Chrome（脚本使用 Playwright 的 chrome channel）：`npm run browser`、`npm run themes`、`npm run readability`、`npm run controls`。测试使用本地夹具，不消耗模型额度。

本版通过 40 项单元测试、14 组 DOM/网络场景、37 组 UI 流程、42 组主题/状态、12 项阅读检查，以及表单/图表专项检查。精简结果见 [验证报告](verification/3.5.0/report.json)。[TESTING.md](TESTING.md) 保留开发阶段记录；其中早期截图与本地交付路径未包含在此仓库。


## 品牌与图标

采用确认的 01「含苞」图标，应用于扩展、工具栏、Popup 与 Dashboard，支持深浅主题。中英文扩展名称包含 ChatGPT / Codex 用量关键词。详见 [品牌资源](BRANDING.md)。本项目为独立社区扩展。
