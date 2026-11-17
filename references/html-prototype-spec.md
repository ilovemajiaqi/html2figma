# HTML 手机原型制作规范（Phase 0）

没有现成 HTML 原型时，先按本规范做一版；**做完必须停下来给用户看图确认**，通过后才进入 Figma 导入。HTML 是后续几何、文字、交互的唯一基准，基准错了后面全错。

## 1. 交付物

```text
prototype/
├── index.html            # 全部屏幕的画布（单文件或按屏拆分均可）
├── assets/
│   ├── fonts/            # 本地字体（勿依赖在线 CDN）
│   └── img/              # 图片（@2x）
└── README.md             # 屏幕清单、路由表、交互说明
```

要求：离线可打开、无网络请求、每屏默认 393×852（CSS px；其他设备尺寸写进项目配置并同步到导入/视口化步骤），画布可横向排布全部屏幕。

## 2. DOM 结构（导入管线依赖，尽量遵守）

```html
<section class="frame" data-screen-id="home" data-title="今天 · 首页">
  <div class="phone">                     <!-- 393×852，圆角 44，overflow:hidden -->
    <div class="screen">                  <!-- 内容 + 常驻层 -->
      <div class="scroll">                <!-- 可滚动区，overflow-y:auto -->
        <div class="scroll-inner"> …内容… </div>
      </div>
      <nav class="dock" data-persistent="bottom" data-h2f-name="nav.dock"> … </nav>
      <header class="topbar" data-persistent="top" data-h2f-name="nav.top"> … </header>
      <button class="fab" data-persistent="fab" data-h2f-name="fab"> … </button>
    </div>
  </div>
</section>
```

约定：

- `.phone` 定高定宽、圆角、`overflow:hidden`；`.screen` 绝对铺满；`.scroll` 是唯一的滚动容器。
- **常驻层**（底部栏/顶栏/FAB/浮条）必须是 `.screen` 的直接子层，加 `data-persistent` 标注类型；不要塞进 `.scroll-inner`。
- 常驻层用规范名称（导入后插件靠它识别与定位）：底部栏 `nav.dock`、顶栏 `nav.top`、悬浮件 `fab`、浮条 `toast`；`data-persistent` 取 `bottom | top | fab | toast`，两者必须一致。
- 弹层/半屏 sheet 单独做成一屏（`data-screen-id="sheet-xxx"`），不要用 JS 模态——Figma 导入按"屏"处理最稳。
- 每屏一个 `data-screen-id`（与 `data-goto` 目标同名，只含 `[a-z0-9-]`）；`data-title` 用于图层命名。

## 3. 交互与热区

- 任何可点击元素写 `data-goto="<screen-id>"`：返回、tab、卡片、按钮、遮罩关闭。
- 一个元素只挂一个 goto；嵌套可点击时，内层写内层目标（导入后按 `closest` 语义还原）。
- 热区必须是真实 DOM 元素（`<button>`/`<a>`/带 role 的 div），不要用透明覆盖层叠一堆无意义 div。
- 自跳（goto 当前屏）不要写，导入时会跳过。
- 可选：给原型演示写少量 JS（tab 切换、滚动定位），但**静态结构必须不依赖 JS 也能完整渲染**。

## 4. 视觉与排版纪律

- 设计令牌集中在 `:root`：颜色、圆角、阴影、间距、字号；禁止散落魔法数。
- 字体：`@font-face` 指向本地文件；只用真实字重文件，不靠浏览器合成粗体；正文行高写死（如 22px/1.55），避免不同渲染器算值不同。
- 文本截断：需要 `-webkit-line-clamp` 时同时设 `overflow:hidden`；文案长度按"至少完整显示 N 行"控制。
- 图标：内联 `<svg><symbol>` 雪碧图，统一 `stroke-width`/`viewBox`；不要用 emoji 当图标，不要外链图标字体。
- 图片：本地 @2x，显式宽高，避免布局抖动。
- 阴影/描边：用 CSS 变量；不要用多层伪元素模拟（导入后难还原）。
- 安全区：顶部状态栏（9:41/信号/电量）与底部 home indicator 用统一组件，不逐屏手画。

## 5. 自检清单（脚本化，别肉眼扫）

| 检查 | 方法 | 通过标准 |
|------|------|----------|
| 屏数/命名 | 统计 `[data-screen-id]` | 与需求清单一致，id 唯一 |
| 路由完整 | 收集所有 `data-goto`，比对 screen-id | 无悬空目标 |
| 溢出 | 每屏测 `.scroll-inner.scrollHeight` vs 视口 | 记录清单；需要滚动的屏标记出来 |
| 文字压层 | 遍历文本节点 rect 与下方元素相交 | 0 处肉眼可见重叠 |
| clamp | 查 `-webkit-line-clamp` 节点 | 截断后无溢出墨迹 |
| 字体 | `document.fonts.check()` 或截图比对 | 全部命中本地字体 |
| 离线 | 断网/禁外链重开 | 页面完整渲染 |
| 截图 | 每屏 2x 全屏截图 | 与需求逐屏对照 |

## 6. 用户确认门禁（强制）

1. 生成每屏 @2x 截图（或一张总览长图）；
2. 附一页交互说明：屏清单、路由表、常驻层清单、哪些屏需要滚动；
3. **停下来问用户**：布局 / 文案 / 交互是否符合预期？需要改的先改 HTML；
4. 用户确认后再进入 Phase 1（体检）→ Phase 2（feed）。不要在未确认时直接导入 Figma。

## 7. 验收清单（HTML 阶段）

- [ ] 所有屏可离线渲染，无控制台报错
- [ ] 每屏为配置视口（默认 393×852），圆角/状态栏/home indicator 一致
- [ ] 所有热区有 `data-goto`，目标全部存在
- [ ] 常驻层已标注 `data-persistent`，且位于 `.screen` 直接子层
- [ ] 文本无溢出压字；clamp 节点清单已记录
- [ ] 字体本地化且命中；图片本地化
- [ ] 全屏截图 + 路由表 + 常驻层清单已交付用户并获确认
