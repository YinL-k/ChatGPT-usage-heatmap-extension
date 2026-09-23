# SakuraMeter 3.5.0 — 验证记录

## 已执行

| 项目 | 结果 |
|---|---|
| Node 单元/后台集成测试 | 19 项通过 |
| 浏览器 DOM 与网络夹具 | 13 个场景通过 |
| 浏览器 UI 冒烟 | 36 组页面配置 + 1 组操作流程通过 |
| 视觉矩阵 | 84 张截图，包含明暗、中英、空数据/有数据/错误 |
| 控制台与页面脚本错误 | 0 |
| 测试期间外部网络请求 | 0 |
| JavaScript 语法 / JSON / 入口与权限 | 通过 |

浏览器使用独立无头 Chrome 会话，页面由 `127.0.0.1` 临时服务提供。`chrome.*`、session 和 usage 响应使用本地夹具；没有加载扩展到用户配置文件，没有真实 ChatGPT 提示词或模型请求。

## 覆盖范围

单元/集成：计划识别优先级和未知档位；百分比与无效字段；动态窗口；绝对/相对重置；基线递增、模型匹配、过期和未来事件；schema 迁移、额外字段与校准保留；日期边界；导入去重、旧记录合并、畸形备份原子拒绝；导出元数据；后台授权、事件串行与重启去重；跨标签刷新合并、退避及缓存保留；本地化键完整性和语言请求竞态。

DOM：点击与 submit 双事件、Enter、单独表单提交、空输入/禁用按钮、失败提示、输入框未清空、旧消息重新挂载、无关新消息、SPA 历史切换、新对话路由、Shift+Enter/IME、意图过期。网络夹具验证单 flight、GET-only、令牌不进入消息、HTTP 429、隐藏页面暂停和超时。

UI：Popup 338×600；Dashboard 1280×900 与 390×844；两种语言、两种主题、三种数据状态。三个 Dashboard 页签均截图；错误态配置启用 reduced-motion 并断言动画关闭。检查页面无水平溢出及用量徽章边界。人工复核截图及联系表，修复浅色对比度、徽章定位和缺失单位文案。

操作流程：主题/语言切换、Tab 的方向键/Home/End、热力图键盘打开详情、弹窗 Tab/Escape/返回焦点、导出 JSON、导入夹具、手动校准/清除、只读刷新反馈和 Popup 打开 Dashboard。未来日期不进入活动时段图。

## 重跑

扩展运行不依赖 Node/npm 或 Playwright。以下仅供开发者重跑测试：

```powershell
node --test tests/core.test.cjs
npm --prefix tests install
npm --prefix tests run browser
```

测试依赖固定为 Playwright 1.62.1，默认使用已安装的 Chrome；可设置 `BROWSER_CHANNEL=msedge` 使用 Edge。截图默认写入 `tests/artifacts`，可通过 `TEST_OUTPUT` 指定其他目录。`DOM_ONLY=1` / `UI_ONLY=1` 可仅运行对应部分。

交付旁的 `verification/` 保存浏览器报告与截图；报告分为完整功能轮次及最后一次样式修正后的 UI 复验。没有既有黄金截图，因此这是矩阵截图、布局断言与人工视觉复核，不是与历史黄金图片的逐像素比较。

## 尚未验证与使用边界

- 未安装到用户的 Chrome，未在真实 ChatGPT DOM/usage 响应上验证。若要由助手执行安装，须先单独确认。
- DOM 确认是本地可见状态，不等同于服务器计费成功。无稳定 ID、仅附件消息及不支持的页面结构保守漏记；迟于确认时限出现的发送失败无法由当前夹具保证识别。
- Pro 数字规则沿用原包参考预设，未在本次重新核实商业额度；模糊 Pro/Business 不推断具体档位，无校准不显示剩余消息。
- 换目录加载可能产生不同扩展 ID；Chrome 按 ID 隔离存储。活动 JSON 不包含计划和校准，完整原位升级注意事项见安装说明。

原始 ZIP：`GPT-Tracker-3.4.0.22-Light-Mode-Test.zip`，保持不变。

SHA-256：`92D5C13274E9D4F81BEEF39759C9CF6D24FBF1BC69649613F90C553C8147E7FA`

## 淡樱粉浅色重设计复验

- 固定时钟的 32 张对照截图涵盖中英 Popup（数据、空状态、错误）及 Dashboard 桌面/窄屏。
- 上一轮仅配色与图标修改时，16 张深色基线逐像素相同；这是历史验证，不代表本轮动态文案与图表解释仍逐像素相同。历史结果见 `verification/light-redesign/report.json`。
- 最终主题另跑 37 组现有 UI 配置/操作，重新生成 84 张截图，并检查脚本与控制台错误、外部网络请求。
- 当时浅色正文/说明文字相对于卡片底色的对比度约 12.02:1 / 5.04:1。抽样底色为 #fcedf3，正文 #352b32、说明 #75616c。仅抽查主题主要色组，不宣称全面无障碍认证。
- 后台、核心统计、发送确认、权限和原始 PNG 图像资产与改版前字节相同；新增 2 个浅色专用 SVG；不安装扩展，不请求模型。

- 边界与图标修正：重新核对 Popup、Overview、Activity、Usage 和窄屏截图；本地夹具服务补充 SVG MIME 类型。32 张固定时间截图位于 `verification/light-redesign/pink-refined/`。

## 阅读与状态说明复验（历史轮次）

- 37 组中英、明暗、桌面/窄屏、空/有数据/错误状态及交互检查通过，更新 84 张截图。
- `npm --prefix tests run readability`：12 项专项行为检查通过，覆盖 Pro 标题随校准/清除变化、缓存时间、刷新恢复、当前月份定位、手动滚动保留、图例统计口径和空状态尺寸；包含 338×600 Popup 的提示边界检查。
- 缓存提示与统计语义的修正在明暗两种主题生效；不再以深色截图完全相同作为本轮验收条件，深色配色和原始图标保留。
- 全部 JavaScript 语法检查通过；最终 UI 轮次控制台/页面错误和外部请求均为 0。后台、核心统计、发送确认及 manifest 与桌面备份逐字节一致。
- 最新报告见 `verification/readability/report.json`，专项结果见 `verification/readability/readability-report.json`；均是本地合成夹具，不表示已安装或验证真实账户。

## 统一主题与通知复验（最新）

- `npm --prefix tests run themes`：42 组通过。36 组覆盖中英、1280/390 宽、三个页签、空/数据/错误；比较全部可见 HTML 元素的位置与大小，允许小于 0.6 CSS px 的取整差，文档高度必须完全相同。主题往返后保留滚动、焦点、表单输入和展开状态。
- 6 组 Popup 检查覆盖中英与三种数据状态：连续切换主题、超过 16 秒提示仍保留、通知不重叠、可滚动到底部、键盘关闭、重试单请求与成功收起。
- 原有 37 组 UI 配置/流程与 12 项阅读行为检查再次通过；更新 84 张矩阵截图，页面/控制台错误及外部网络请求均为 0；JavaScript 语法检查通过。
- `background.js`、`content.js`、`usage-core.js`、`manifest.json` 与本轮修改前逐字节一致。原桌面备份未修改，未安装扩展或调用模型。
- 最新报告：`verification/themes/report.json`、`themes-report.json`、`readability-report.json`。通知图额外提供完整滚动内容及底部视图。

## Codex Reset 接入验证（最新）

- 单元测试 29 项通过（原 19 项 + Reset 10 项）：百分比、缺失字段、无效/未来时间、预告过期、重置券区别及安全来源 URL。
- Reset 浏览器检查 12 组通过：中英 × 桌面/窄屏明暗尺寸对比、空/异常值、退避恢复、手动单请求、缓存保留、页签可见性、过期数据、10 秒超时、多个 Dashboard 共享锁和缓存。
- 既有主题/状态 42 组与 UI 37 组再次通过；UI 矩阵 84 张截图更新。所有自动化回归请求使用夹具，0 外部请求、0 页面/控制台错误。
- 单独执行一次 Chrome 公开 API CORS GET，200、responseType=cors；只检查公开预测，不携带账户数据。该实测不是零网络测试，也不是扩展安装验收。另有一次 PowerShell GET 检查 CORS 响应头。
- Manifest、后台、核心统计和发送确认未修改；未安装扩展、未请求任何模型。
- 报告：交付旁 `verification/reset/report.json`、`themes-report.json`、`cors-report.json`。
- 重跑：`node --test tests/core.test.cjs tests/reset.test.cjs`；`node tests/reset-browser.cjs`。

## 会员图标对齐修复

统一 Dashboard 会员图标为同一 SVG mask 和公共底板布局，图标与底板同向右下偏移 8%，外框 overflow:hidden 裁切。8 组主题配对检查覆盖 Overview / Usage × 中英 × 桌面/窄屏，逐项比较外框、圆角、内部 mask URL、尺寸、位置、图标/底板偏移矩阵和裁切属性；全部一致。更新 16 张页面截图并人工复核会员卡局部，0 页面/控制台错误和外部请求。报告：`verification/crown-alignment/report.json`。

## 自动恢复额度刷新（最新）

- 40 项单元测试通过，新增 11 项刷新用例：桥接失联、无标签页、后台页面、旧令牌、登录失效、验证、限流、超时、异常数据、缓存保留与多入口单请求；令牌不进入持久存储。
- 完整浏览器回归：14 组 DOM/网络、37 组 UI、84 张截图，0 页面/控制台错误，0 外部请求。新增本地草稿与生成中控件夹具，验证手动后台读取不触碰二者、不产生发送统计。
- 42 组深浅主题/状态检查通过；另 8 组 Popup/Usage × 中英 × 深浅检查登录入口与成功收起。
- 未安装扩展、未发送真实提示词、未读取真实账户。Service Worker 的真实 Cookie/session 可用性尚未在登录账户中验证，不将本地夹具视为线上兼容性保证。
- 最新报告：`verification/refresh/report.json`。重跑：`node --test tests/core.test.cjs tests/reset.test.cjs tests/refresh.test.cjs` 与 `node tests/browser.cjs`。

## 3.5.0 版本统一复验

本轮只升级产品版本与文档，不改变既有行为。Manifest/version_name、Popup/Overview 标识、本地化页面标题与导出 appVersion 均为 3.5.0。40 项单元测试、37 组 UI 配置/流程通过，更新 84 张矩阵截图；0 页面/控制台错误、0 外部请求。存储 schema 3 与活动备份格式 version 5 保持不变。报告：`verification/3.5.0/report.json`；前文为功能开发阶段的历史验证记录。


## 3.5.0 控件与统计一致性更新

- 月度与周度总量改为柱状图，桌面三张统计卡片统一为 292px 高；月份完整展示，较多周记录在图内横向滚动，保留原统计口径。支持悬停、点击和键盘查看数量。
- Overview / Usage 会员栏共用尺寸，Live 使用相同的 24px 标签；手机宽度将操作放到下一行，两页仍保持等高。
- 年份、套餐与校准规则使用主题下拉菜单。日期框整块可打开主题日历，支持日期、时分、今天、清空、取消和键盘操作；取消不写入值。
- 输入框增加底色、边界与内层阴影；保存同步、清除和刷新共用按钮语言。深浅主题只改变视觉，不改变控件尺寸。
- 保留原始字段、校准验证、UG_* 协议和存储格式；不新增权限。

本轮最终复验：40 项单元测试、14 组 DOM/网络场景、37 组 UI 流程、84 张矩阵截图、42 组主题/状态和 12 项阅读检查通过。另 8 组中英/主题/视口表单与图表流程通过；4 组控件边界专项覆盖空状态、键盘选择、取消/Escape/清空、无效时间、本地时区、弹层边界与 53 周数据。所有网络由本地夹具隔离，0 外部请求、0 页面/控制台错误。未安装扩展，未请求模型。

控件专项重跑：`npm --prefix tests run controls`。报告位于交付旁 `verification/3.5.0/controls/controls-report.json`；完整矩阵见 `verification/3.5.0/browser-report.json`。本轮后台、发送确认、统计核心及 Manifest SHA-256 与本轮开始前一致。


## SakuraMeter 品牌集成验证

通过 40 项单元测试、14 组 DOM/网络场景、37 组 UI 流程、84 张矩阵截图、42 组主题/状态检查。另验证 12 组中英/深浅/Popup/桌面/窄屏标题与图标排版、4 个 PNG 尺寸及 2 套 Manifest 文案。0 外部请求、0 页面错误。未安装扩展或请求模型。后台、发送统计核心和权限不变。
