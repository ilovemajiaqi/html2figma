---
name: html2figma
description: Convert HTML phone prototypes into editable, clickable, scrollable Figma prototypes — or author the HTML prototype first to spec and get user sign-off before importing. Covers multi-screen boards, vector layers, ON_CLICK→NAVIGATE reactions, device models, persistent-layer detection (bottom tab bar, top bar, FAB, toast — not only docks), real scrolling with fixed layers, and pixel-parity verification. 当用户提到「HTML 原型转 Figma」「Figma 原型演示/点击跳屏」「底部导航或常驻栏固定」「手机模型/设备模型」「还原度/逐屏比对」「open-htmltofigma」，或要求从零制作可交互 HTML 原型并交付 Figma 版本时使用。也适用于排查 dock 掉到长图底部、不能滚动、reaction 丢失、字体替换导致断行等问题。Do not use for native-Figma-only prototype wiring with no HTML source, desktop static design imports, or one-off how-to questions about Figma.
license: MIT
compatibility: 工作流与 Agent 平台无关（Agent Skills 规范）；导入依赖 open-htmltofigma 开发插件与 Figma 桌面端；仓库内 PowerShell 自动化仅面向 Windows，其他平台按文档手动操作或改写。
metadata:
  version: "1.1.1"
---

# html2figma — HTML 原型 ⇄ Figma 可编辑可点击原型

## 何时用

- 有现成 HTML 手机原型，要 1:1 搬进 Figma：可编辑图层 + 可点击跳屏 + 可滚动 + 常驻层固定。
- 还没有 HTML 原型：先按 [HTML 原型规范](references/html-prototype-spec.md) 做出来，用户确认后再进 Figma。
- 修 Figma 原型的疑难：文字重叠/断行错误、reaction 丢失、常驻层跑到长图底部、不能滚动。

**不适用**：只有 Figma 文件、没有 HTML 来源的原生连线；桌面端静态设计稿导入；单纯问 Figma 操作怎么点。

## 入口三问（不要跳过）

1. **有没有 HTML 原型？**
   - 有 → 从 Phase 1 开始。
   - 没有 → 走 Phase 0：按规范产出 HTML 原型 → 渲染全部屏幕截图 → **停下来请用户确认** → 通过后才进 Figma。HTML 是后续一切几何与交互的基准，未经确认就导入，返工成本极高。
2. **哪些是"常驻层"？**
   不要默认是 dock。按 §常驻层判定 扫 DOM/截图：`position:fixed`、或绝对定位锚在视口上下缘、`z-index` 高于内容、在 ≥2 屏同一视口坐标重复出现。可能是底部 dock、顶部导航、悬浮按钮 FAB、浮动提示、回到顶部、模态把手等。判不准就看 HTML 行为；HTML 里也没有就先问用户，别猜。
3. **交付边界？**
   三件都要：①像素还原（无文字重叠/断行/错位）②可编辑（Frame/Text/Vector/图片填充）③可点击（热区数量对得上，不是"大约"）。

## 心智模型（省几小时的 4 条）

- **HTML 是唯一基准**。Figma 里每个改造都要能在 HTML 找到语义：定高视口、`overflow:hidden`、`position:fixed/absolute`、`closest('[data-goto]')`。
- **导入 ≠ 还原**。插件给出的是"全高长图 + 静态图层"；视口、滚动、固定层、reaction 都是后处理。
- **能量化就别看图猜**：文字重叠用墨迹盒、还原度用 MAE、reaction 用数量审计、滚动/固定用 Present 截图序列。
- **Figma 插件 API 能设滚动与固定（实测）**：`frame.overflowDirection = 'VERTICAL'`（合法值只有 `NONE | VERTICAL | HORIZONTAL | BOTH`；传 `VERTICAL_SCROLLING` 之类会报 validation error，别误读成"不支持"）。固定子层用 `numberOfFixedChildren = N`，固定层必须是帧的**前 N 个子层**（先 `insertChild(0, layer)`）。Prototype 面板是兜底，以及设备模型等真正 UI-only 设置的地方。

## 管线（每阶段可独立验收）

### Phase 0 — 制作 HTML 原型（仅当没有现成 HTML）
按 [references/html-prototype-spec.md](references/html-prototype-spec.md)：393×852 视口、`.phone/.screen/.scroll` 结构、`data-goto` 热区、设计令牌、内联 SVG 图标、字体自包含、clamp 纪律。
完成标准：全部屏幕可渲染、无溢出/压字、热区齐全；输出全屏截图 + 交互说明，**让用户看图确认**，确认后才继续。

### Phase 1 — 原型体检
量清楚：屏数与尺寸、每屏内容高度、`-webkit-line-clamp` 节点、字体家族/字重、`data-goto` 去重后的有效热区数、常驻层清单（见 §常驻层判定）。
产物：`boards.json`、`hotspots.json`、`clamp.json`、`persistent.json`。

### Phase 2 — Feed 构建（画布 → 可导入的单屏流）
注入 CSS/JS 后序列化 `feed/index.html`：
- 隐藏画布外壳（顶栏/侧栏/屏标签/网格）；
- **UNCLIP**：去掉定高与 `overflow:hidden`，让内容自然展开（后续按全高取图层、再裁回视口）；
- **截断策略（先试原生，再考虑烘焙）**：导入后可对文本层设 `textTruncation='ENDING'` + `maxLines=N`（写之前必须 `loadFontAsync`）。只有需要与浏览器逐字一致的断行时才在 feed 里烘焙 clamp（算法见 [pipeline](references/pipeline.md)）。完全不做截断会画出框外压字；
- `data-h2f-name` 命名板与常驻层；字体 `@font-face` 内联/自包含。

### Phase 3 — 字体精确命中（断行还原的关键）
对原型实际字体做子集化 + 改名加统一前缀 + 安装（HKCU/系统字体）。Figma 必须命中同名字体，否则替换会制造假"断行错误"。命令与改名脚本见 pipeline。

### Phase 4 — 导入与拆板
上游安装：`git clone https://github.com/kevicebryan/open-htmltofigma.git`，Figma 桌面 → Plugins → Development → Import plugin from manifest…（选仓库内 `manifest.json`）；固定 commit/tag，manifest id 冲突时改掉。插件在 iframe 真实渲染 feed → 直建 Frame/Text/Vector；本地注入脚本自动填写并 Convert（导入前把插件视口设成 393×852，否则 `vh`/媒体查询会按默认 1440×1024 解析）。导入后把每屏 Frame 提升为顶层、横排、命名 `NN id · 标题`，删根容器。**导入器不创建任何 reaction**，必须按 Phase 5 重写；插件版本要固定（见 [pipeline](references/pipeline.md)）。

### Phase 5 — 交互（reaction）
按面积升序遍历热区；bbox ±2 命中最小非 TEXT 节点，中心点兜底；节点不支持 reaction 就沿祖先上爬；**已有 reaction 是继续上爬的理由**（父热区挂自己节点），不是终止条件；自跳跳过。读 `node.reactions`，写 `await setReactionsAsync()`。
写完用同一套命中+上爬逻辑回放，`exp == ok && wrong == 0`；数量审计要求 `dangling == 0`。

### Phase 6 — 视口化 + 常驻层定位
先用 `persistent.json` 列出每个常驻层的锚点判定（bottom/top/fab/none）和依据，再动手；不确定的标出来问用户，不要默认全固定。
原地把每板改成原型视口尺寸（如 393×852；从 `.phone` 实测读取，不要写死，Android 常见 360×800/412×915），`resize` + `clipsContent`，把常驻层从内容层提到板根，按视口锚点定位：
- 底部条：`y = 视口高 - 高度`；
- 顶部条：`y = 0`；
- 右下 FAB：按 HTML 的 `right/bottom` 换算；
- 可隐藏/自动收起类（滚动时淡出的顶栏）：不要固定，保留内容流语义。

固定与滚动可以直接走 API（本项目实测，Figma 桌面版）：

```js
board.insertChild(0, layer);        // 固定层必须排在子层最前
board.numberOfFixedChildren = 1;    // 前 N 个子层 = 固定层
board.overflowDirection = 'VERTICAL';
```

UI 的 `Position = Fixed` 与 `Overflow = Vertical` 语义相同，可作兜底。要保留 reaction 就不要把板克隆到别的页：跨页 `setReactionsAsync` 实测全失败。先克隆全高板到 `ARCHIVE` 页存档，再原地重构。

### Phase 7 — 滚动 + 固定 + 设备模型
- 滚动：`board.overflowDirection = 'VERTICAL'`（枚举只有 `NONE | VERTICAL | HORIZONTAL | BOTH`）；
- 固定：`board.numberOfFixedChildren = N`（固定层=前 N 个子层，见 Phase 6）；
- UI 兜底：多选板 → Prototype → `Overflow = Vertical`；多选常驻层 → `Position = Fixed (stay in place)`；
- 设备模型（UI-only）：取消选中 → 文件级 Prototype 设置 → Device 选与原型同尺寸的设备（如 iPhone 15 Pro = 393×852）；首页设 Flow starting point。
理由与坐标细节见 [figma-ui-and-automation](references/figma-ui-and-automation.md)。

### Phase 8 — 三层验收
1. 像素：2x 导出 vs 参考，按 `@dx,dy` 裁阴影溢出 + ±2px 搜索，MAE 3–10 正常；
2. 交互：reaction 审计 + 回放校验；
3. 演示：Present 三连截图（初始 / 滚动后 / 跳屏后），确认常驻层始终在视口内、不随内容移动。
细节与阈值见 [verification](references/verification.md)。

## 常驻层判定（重要，不要只认 dock）

**判定信号**（满足任意两条即候选）：

| 信号 | 怎么看 |
|------|--------|
| CSS 定位 | `position:fixed`，或 `absolute` + `bottom/top` 贴视口缘 |
| 层级 | `z-index` 高于内容层；覆盖在滚动内容之上 |
| 跨屏重复 | 同一选择器/同一视口坐标在 ≥2 屏出现（底部导航、顶栏最常见） |
| 视觉 | 圆角悬浮条、毛玻璃、阴影浮层、FAB、toast |
| 行为 | HTML/JS 里监听滚动做 show/hide 或变色 |

**处理决策**：

- **始终覆盖、跨屏常驻**（底部 tab 栏、顶栏）→ Figma 视口内固定（`Fixed`）。
- **只覆盖不吸顶**（FAB）→ 同样提到视口层并固定。
- **随内容滚走**（普通卡片、内联按钮）→ 留在内容层，不要固定。
- **滚动时隐藏/出现**（auto-hide header）→ Figma 无法用原生交互复现完整逻辑：优先保持"滚动跟随/隐藏"的静态语义，或拆成状态屏；不要错误地设成 Fixed。判不准就问用户想要哪种演示效果。
- **弹层/模态把手** → 通常属于弹层屏本身，按该屏内容处理，不跨屏固定。

> 本项目实例：底部 dock 14 屏各 6 个热区，提到 `y = 852-72 = 780` 后设 Fixed；同一套公式对顶栏/FAB 适用——先判定语义，再套坐标。

## 高频坑（Top 14）

| # | 现象 | 根因 / 对策 |
|---|------|------------|
| 1 | 常驻层在长图最底下 | 导入 UNCLIP 把定高视口展开，`bottom:0` 落到内容末尾 → Phase 6 视口化 |
| 2 | 设滚动报 validation error | 枚举值写错（如 `VERTICAL_SCROLLING`）→ 用 `VERTICAL`；普通 FRAME 可写，别误判成不支持 |
| 3 | 固定子层设了没生效 | 固定层必须是帧的**前 N 个子层**：先 `insertChild(0, layer)` 再设 `numberOfFixedChildren = N` |
| 4 | 克隆到新页后 reaction 全失败 | 跨页 `setReactionsAsync` 被拒 → 原地重构，存档另存 |
| 5 | 文字压住下方标签 | 先试原生 `textTruncation='ENDING'` + `maxLines`；仍不一致再在 feed 烘焙逐字截断 |
| 6 | Figma 断行与浏览器不同 | 字体被替换 → 子集化+改名+安装 |
| 7 | 导出图比画板大、比对全错 | 导出含阴影溢出 → 按 `@dx,dy` 裁剪 |
| 8 | 合成鼠标点击/滚轮无效 | webview 过滤；菜单可点。面板用 UIA/键盘；播放器滚动用 PostMessage 滚轮 |
| 9 | 弹层第二次脚本点击落空 | 每次运行会重新前台化 → 打开+选择放同一次运行 |
| 10 | 截图坐标漂移 | DPI 感知；截图坐标 == 窗口相对坐标；UIA 是绝对物理像素 |
| 11 | 插件跑进别的文件 | Figma 恢复旧标签/误开 Untitled → 先确认激活标签 |
| 12 | 裁剪图打不开 | 非整数缩放产生小数尺寸 → 输出取整 |
| 13 | 画布多出奇怪文字 | 误粘贴生成 TEXT 节点 → 按内容正则清理 |
| 14 | 结果读不到 | 用 `page.name` 或本地 HTTP 收集器做状态回读 |

## 平台与兼容

- 本 skill 遵循 **Agent Skills** 规范（SKILL.md + references/ + scripts/），ZCode、Claude Code 及任何实现该规范的 agent 均可加载。
- 流程描述尽量通用，但导入环节**依赖** open-htmltofigma 开发插件与 Figma 桌面端，自动化脚本面向 Windows；macOS/Linux 用 AppleScript/`screencapture`/`xdotool` 等改写，或按文档手动操作。
- Figma **网页版不能导入本地开发插件**；插件相关步骤需桌面端（网页版可打开已发布的插件）。

## 参考与脚本

- [references/html-prototype-spec.md](references/html-prototype-spec.md) — 没有 HTML 原型时的制作规范与验收清单（含"先给用户看"的门禁）。
- [references/pipeline.md](references/pipeline.md) — feed/UNCLIP、clamp 算法、字体、导入拆板、reaction、视口化代码骨架。
- [references/figma-ui-and-automation.md](references/figma-ui-and-automation.md) — API/UI 能力矩阵、批量设置、设备模型、Windows 自动化与坐标规则。
- [references/verification.md](references/verification.md) — MAE、reaction 审计/回放、Present 三连、失败分诊。
- `scripts/rename_font.py`、`scripts/install_font.ps1` — 字体子集化/改名与当前用户安装（含卸载）。
- `scripts/figma_win.ps1`、`scripts/uia.ps1` — Windows 辅助（点击/悬停/按键/滚轮/截图、UIA 枚举/点击/聚焦）。
- `scripts/crop.mjs` — 跨平台 PNG 裁剪（整数缩放，截图审查用）。

## 工作方式

- 改代码前说明"改哪一行、为什么"，一次一个根因；中间产物带版本号新文件名。
- 每个"看起来对"都要有数字或截图证据；每个"应该能"都要在 Present 实测。
- 只围绕「还原 / 可编辑 / 可点击」三件事，不顺手重构管线、不升级依赖。
