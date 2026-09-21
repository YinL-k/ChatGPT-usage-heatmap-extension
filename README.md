[English](README_en.md) | [中文](README.md)

# GPT Tracker – 使用热力图 + Usage Dashboard

Chrome 扩展：保留原来的 ChatGPT 使用热力图，同时增加会员识别、Pro Chat 本地额度估算，以及 ChatGPT Web 实际返回的 usage meter。

## v2.1

### 会员切换
Popup 支持 Auto-detect、Free、Go、Plus、Pro $100 / 5x、Pro $200 / 20x、Business Standard、Business Premium、Enterprise、Edu。

自动识别读取 ChatGPT 当前会话返回的 plan/seat 信号；OpenAI 内部字段变化时，也可以手动覆盖会员类型。

### Pro Chat
Pro Chat 在正常状态下没有稳定的官方 remaining counter，因此扩展根据实际成功发送的 conversation request，在本地记录 model / reasoning mode 并计算剩余量，卡片明确标记为 `local`。

当前 preset：
- Pro $100 / 5x：共享 Pro 50 / 7 天
- Pro $200 / 20x：GPT-6 Pro 200 / 7 天；GPT-5.6 Sol Pro 170 / 24h；全部 Pro 合计 200 / 24h
- Business Standard：共享 Pro 15 / 30 天
- Business Premium：共享 Pro 50 / 7 天
- Enterprise / Edu：不假设统一固定值，以 workspace 返回值为准

v2.1 以前的历史数据只有总消息数，没有 model 元数据，因此无法倒推过去用了多少条 Pro。Popup 可用 **Reset local Pro count** 从当前时刻重新计数。

### 能读取的服务端 usage
扩展从已登录的 ChatGPT 页面发起只读请求，并只保存经过清洗后的 quota 数字：

- `POST /backend-api/conversation/init`：`limits_progress`，可能包含 Deep Research、Image Generation、File Upload 等 remaining / reset
- `GET /backend-api/wham/usage`：Work/Codex rate-limit window、used percent、reset、credits、plan type
- `GET /backend-api/wham/tasks/rate_limit`
- `GET /codex/settings/usage`
- `GET /backend-api/accounts/check/v4-2023-04-27`：仅用于 plan / seat 信号识别

这些是 ChatGPT Web 的内部接口，不是稳定公开 API，可能随时改变。读取失败时扩展只显示缓存或 unavailable，不绕过认证与安全控制。

### 更准确的 Activity 记录
旧版监听 Enter；v2.1 改为监听 ChatGPT 页面真正发出的 conversation request，并在请求成功后才 +1，所以点击发送按钮也能统计。

扩展不会保存 Prompt/回答正文。

## 原有功能
- GitHub 风格年度热力图
- Today / Week / Month / Total
- Daily Activity 趋势
- JSON Import / Export
- Dark Mode

## 隐私
- 不保存 Prompt 或回答内容
- 不持久化 Cookie、Access Token、邮箱、Account ID
- Usage 请求只访问 ChatGPT 自己的 first-party endpoint
- 无开发者后端，无 telemetry 上传
- 本地数据存储在 `chrome.storage.local`

## 安装
1. 下载项目。
2. 打开 `chrome://extensions/`。
3. 开启 Developer mode。
4. 点击 Load unpacked。
5. 选择项目目录。
6. 更新 v2.1 后，刷新一次已经打开的 ChatGPT 标签页。

## 结构
```text
manifest.json
page-hook.js       # MAIN world：成功发送检测 + ChatGPT usage 只读抓取
content.js         # 本地存储与 popup bridge
popup.html
popup.js
heatmap.html
heatmap.js
style.css
privacy-policy.md
```

## License
MIT License.
