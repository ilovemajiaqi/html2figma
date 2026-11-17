# Figma 能力边界与桌面自动化

> 本文的自动化章节以 **Windows + Figma 桌面端** 为准（PowerShell/UIA/鼠标键盘注入）。macOS/Linux 上工作流不变，用 AppleScript、`screencapture`、`xdotool` 等等价手段实现同样的"选中 → 面板设置 → 截图核对"。

## 1. 能力边界矩阵（先查表再动手）

| 需求 | 插件 API | UI（Prototype 面板） | 备注 |
|------|----------|----------------------|------|
| 板改尺寸 + `clipsContent` | ✅ `resize()` / `clipsContent = true` | ✅ | 尺寸改完内容坐标不变（无 auto-layout） |
| 帧纵向滚动 | ✅ `frame.overflowDirection = 'VERTICAL'` | ✅ `Scroll behavior → Overflow → Vertical` | 普通 FRAME 可写；合法值只有 `NONE/VERTICAL/HORIZONTAL/BOTH`，传 `VERTICAL_SCROLLING` 会报 validation error |
| 子层滚动固定 | ✅ `frame.numberOfFixedChildren = N` | ✅ `Scroll behavior → Position → Fixed (stay in place)` | 固定层必须是帧的**前 N 个子层**（`insertChild(0, layer)`）；`isFixed` 布尔属性确实不存在 |
| 文本按行截断 | ✅ `textTruncation = 'ENDING'` + `maxLines = N` | — | 写前需 `loadFontAsync`；断行不一定与浏览器逐字一致 |
| reaction 读写 | ✅ 读 `node.reactions`，写 `await setReactionsAsync()` | ✅ | 无 `getReactionsAsync`；跨页写入会被拒 |
| 设备模型（iPhone 15 Pro） | ❌ | ✅ 文件级 Prototype 设置 | 别手画圆角/灵动岛 |
| Flow 起点 | ✅ `page.flowStartingPoints = [{nodeId,name}]` | ✅ | |
| 页面名 | ✅ `page.name = '...'` | ✅ | 当无头状态通道用（截图可读） |
| 跨页移动/克隆后写 reaction | ⚠️ 克隆会带走 reaction，但 `destinationId` 仍指原节点；跨页 `setReactionsAsync` 实测全失败 | — | 要交互就原地改，不要跨页 |

> 实测环境：Figma 桌面版（2026-11）。API 行为以当前版本为准，升级后用 `scripts/` 里的探针思路复测。

## 2. 滚动与固定：API 优先，UI 兜底

```js
/* 1) 滚动：普通 FRAME 直接可写，注意枚举值 */
board.clipsContent = true;
board.overflowDirection = 'VERTICAL';        // NONE | VERTICAL | HORIZONTAL | BOTH

/* 2) 固定层：先排到子层最前，再声明前 N 个为固定 */
board.insertChild(0, layer);                 // 固定层必须是最前面的子层
board.numberOfFixedChildren = 1;
```

实测要点：
- 传 `VERTICAL_SCROLLING` / `HORIZONTAL_AND_VERTICAL_SCROLLING` 会报 `Invalid option`；正确值是上表四种。
- `numberOfFixedChildren` 可读写；设成 2 就是前两个子层固定。顺序错了（固定层不在最前）就不会按预期固定。
- 以上都可在插件里批量循环 51 板，无需 UI 自动化。UI 仅在旧版本插件 API 行为异常时兜底。

### UI 兜底步骤（多选批量）

前置：插件把目标对象一次性选中（`figma.currentPage.selection = nodes`），并 `scrollAndZoomIntoView` 到首板，保证右侧面板出现帧级设置。

#### Overflow = Vertical（全部视口板）

1. 选中全部视口板（本项目 51 块）→ 右侧切到 **Prototype** 标签；
2. 面板出现 `Scroll behavior → Overflow: No scrolling`（多选共享设置）；
3. 点开下拉 → 选 **Vertical**（一次应用到全部选中板）。

#### Position = Fixed（全部常驻层）

1. 选中所有常驻层节点（本项目 14 个 `nav.dock`；按项目不同可能是顶栏/FAB/浮条，选择器见 SKILL.md「常驻层判定」）；
2. 面板 → `Scroll behavior → Position: Scroll with parent`；
3. 下拉 → **Fixed (stay in place)**。

> 只给"语义上需要固定"的层设置；随内容滚走或滚动时自动隐藏的层不要选进来（决策表见 SKILL.md）。

### 下拉怎么点（webview 面板）

- 合成鼠标**在部分面板控件上可用**（标签页、下拉都能点开），但在插件 UI/画布/播放器上会被过滤；
- 打开下拉与选择选项必须放在**同一次 PowerShell 运行**里：每次脚本新运行都会重新前台化窗口，弹层会被关掉；
- 点击坐标用"截图坐标 == 窗口相对坐标"（见 §4.3）。示例（2300×1300 窗口布局）：

```text
Overflow 下拉中心 ≈ (2136, 626)   # 面板 x≥1880
Position 下拉中心 ≈ (2136, 475)
Fixed 选项行      ≈ (2020, 517)   # 弹出层相对下拉下方约 +42px
Vertical 选项行   ≈ (2216, 767)   # Overflow 弹出层
```

坐标随窗口/缩放变化，先截图核对再点。

## 3. 设备模型（Present 的手机外壳）

1. 取消选中任何对象（Esc），右侧 Prototype 面板显示文件级设置；
2. `Device` 选与原型视口同尺寸的设备（iPhone 15 Pro = 393×852；其他尺寸按原型选）；
3. 标题选 Natural Title，设置朝向/背景色；
4. 给首页设 Flow starting point（画布上出现 "Flow 1" 徽标）；
5. 点右上 ▶ 进入 Present —— 自动套手机模型（灵动岛 + 侧键），不要手工画圆角/描边。

## 4. Windows 桌面自动化

### 4.1 总原则

- 需要 `SetProcessDPIAware()`；UIA 的 `BoundingRectangle` 是**绝对物理像素**；
- 前台化不可靠时：`AttachThreadInput` + `SetForegroundWindow` + **TOPMOST 往返**（`SetWindowPos(HWND_TOPMOST)` → `HWND_NOTOPMOST`）；
- 内容区（画布/webview/播放器）**过滤合成鼠标事件**（`mouse_event` 点击/滚轮可能无效）；菜单、原生对话框、部分面板控件可用；
- 键盘 `SendKeys` 在 webview 里**有效**（Tab/Enter/方向键），是最后的手段；
- 每次运行脚本都会重新前台化 → 打开弹层 + 选择必须同一次运行完成。

### 4.2 菜单与插件运行链

新版 Figma 桌面主菜单在左上角 2×2 图标（不是旧 logo）。示例布局（窗口 2300×1300 @80,60）：

```text
主菜单按钮 (62,107)
→ Plugins 行 (130,578)
→ hover Development (480,621)      # hover 展开子菜单
→ 开发插件按名称排序，第一行 y≈616（如 "My Plugin"）
```

开发插件列表顺序 = 名称字母序；行高约 41px。点插件行后等待 2–6s（导入/跑批更久），再用截图确认 toast 或页面名。

### 4.3 坐标与截图

- 用 `GetWindowRect` 得到窗口矩形；截图 `CopyFromScreen(rect)` 得到的图像，其像素坐标**就是**窗口相对坐标（不要再减窗口原点）；
- 点击 = `SetCursorPos(rect.L + x, rect.T + y)` + `mouse_event`；
- 截图裁剪放大务必用**整数倍**，否则产生小数尺寸 PNG 会解码失败；
- 看结果优先裁小图（面板/页面名/手机屏），避免整图看花 token。

### 4.4 UIA（webview 面板的稳妥通道）

- `-List` 枚举带名字/矩形的元素，找 `No scrolling`、`Vertical`、`Fixed (stay in place)` 这类文本节点；
- 按名称点击：取元素 `BoundingRectangle` 中心，用鼠标点击（面板控件通常响应）；
- 聚焦 + 发键：`element.SetFocus()` 后 `SendKeys`（下拉若支持 ExpandCollapse 也可用 pattern，实测该下拉没有 pattern，只能点）；
- UIA 名称可能重复（标签 + 值 + 容器），点击前先 `-List` 看清矩形大小，选最像交互控件的那个。

### 4.5 播放器（Present）里的输入

- 合成鼠标点击**无效**；用键盘 `Tab` 依次聚焦热区，`Enter` 触发（实测 home → AI 中心页成功）；
- 滚轮 `mouse_event(MOUSEEVENTF_WHEEL)` **无效**；改用 `PostMessage` 直接发给光标下的子窗口：

```powershell
$pt = New-Object POINT; $pt.X = $ax; $pt.Y = $ay
$target = [Win]::WindowFromPoint($pt)
$lparam = [IntPtr](($ay -shl 16) -bor ($ax -band 0xFFFF))
$wp = [IntPtr](([int]$delta -shl 16) -band 0xFFFFFFFF)   # 负=向下
[Win]::PostMessage($target, 0x020A, $wp, $lparam)        # WM_MOUSEWHEEL
```

实测：内容滚到 21:00 日程，dock 固定在底部不动。

### 4.6 标签页卫生

Figma 重启会恢复上次标签，还可能误开 `Untitled`（Agent 面板）。跑任何插件前：
1. 看标签栏，关闭 `Untitled`；
2. 点回目标文件标签（同文件可能有两个标签：编辑 + 演示）；
3. 再执行菜单链。跑错文件时插件会静默作用在别处（页面名/选中集不对），一定要有状态回读。

### 4.7 无头状态回读

插件没有可见 console 时，两个可靠通道：
- `page.name = '前缀 key=value ...'`（截图左上角页面名即可读）；
- `fetch('http://localhost:9876/save?name=report.dat', {method:'POST', body: JSON.stringify(...)})`
  配一个本地 Node 收集器（把 body 原样落盘即可），比截图 OCR 稳。

## 5. 常见 UI 操作误区

| 误区 | 事实 |
|------|------|
| "面板能点，所以哪都能点" | 插件 UI 开关、文件夹链接常失灵；画布/播放器完全过滤 |
| "hover 用点击代替" | 子菜单父项可点击展开，但点击会落在行上；用真 hover（只移动光标）更接近人工 |
| "窗口坐标要减标题栏" | 截图已是窗口内容坐标（含标题栏高度），保持一致即可 |
| "多选只能改通用属性" | Prototype 的 Overflow/Position 支持多选批量（实测 51 板 / 14 dock 一次生效） |
| "改完直接信" | 面板显示值 + Present 实测 + 导出图三方互证才算完成 |
