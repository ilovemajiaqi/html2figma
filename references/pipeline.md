# 管线细节（feed → 字体 → 导入 → reaction → 视口化）

以下步骤按依赖顺序排列。脚本默认放在项目的 `scripts/` 与 Figma 插件目录，命名可自定。

> 没有现成 HTML 原型时，先按 [html-prototype-spec.md](html-prototype-spec.md) 做出原型并取得用户确认，再回到本文。

## 1. feed 构建

目标：把"带外壳/定高/滚动的画布页"变成"每屏自上而下自然展开的静态 HTML"，供导入插件在 iframe 里真实渲染。

### 1.1 注入与序列化

用 Chrome CDP（`--remote-debugging-port`）打开原型页，`Runtime.evaluate` 注入，再取 `document.documentElement.outerHTML` 写盘。关键 CSS（按实际 class 调整）：

```css
/* 隐藏画布外壳 */
.topbar, .side, .frame-label { display: none !important; }
.canvas { background: #fff !important; }
.frames { display: block !important; }

/* UNCLIP：让内容自然展开 */
.phone { height: auto !important; overflow: visible !important; border-radius: 44px !important; }
.screen { position: static !important; height: auto !important; overflow: visible !important; }
.scroll { overflow: visible !important; height: auto !important; }
.scroll-inner { height: auto !important; }
```

注意保留 `.phone` 圆角（导入后视口板要用），只去定高与裁剪。

### 1.2 文本截断（先决定在哪一层做）

两条路，按需求选：

- **Figma 原生截断**（首选，快）：导入后对文本层执行
  `await figma.loadFontAsync(t.fontName); t.textTruncation = 'ENDING'; t.maxLines = N;`
  适合"只要不超过 N 行"的场景；与浏览器断行不保证逐字一致。
- **feed 烘焙**（需要与浏览器逐字一致时）：在 HTML 里提前截断并补 `…`，Figma 只是照抄。

如果要烘焙，算法（与浏览器逐字一致的近似）：

1. 对每个 `-webkit-line-clamp: N` 的节点，取内容盒宽度 `contentW = clientWidth - padL - padR`；
2. 用 `Range` 逐字符 `getClientRects()` 重建**自然行**（按 top 分组；inline 元素与 `<br>` 都要处理）；
3. 取第 N 行作为截断行；从行尾回退，直到 `已用宽度 + 省略号宽 <= contentW`，但**至少保留该行首字符**（浏览器允许省略号溢出内容盒）；
4. 把结果写回 DOM 文本节点（可能落在行内的某个子节点上），补 `…`；记录截断后的墨迹高度，后续 bbox 用它收敛。

常见误判：用 `scrollHeight - padT - padB` 判断是否 clamp；漏算 padding 会把不需要截断的节点误砍。Range 重建对连字/字距/双向文本可能与浏览器有差异，关键屏要对比截图。

### 1.3 命名

给需要定位的节点写 `data-h2f-name`：
- 板根：`NN id · 标题`（NN 两位数，id 与路由一致，id 只含 `[a-z0-9-]`）；
- 常驻层用规范名：`nav.dock` / `nav.top` / `fab` / `toast`（导入后按名称识别，无需额外 pluginData）；
- 其余按语义路径（`div.screen`、`div.page` 等）。

导入插件按 `data-h2f-name` 生成图层名。选板正则以“两位数字 + 任意标题 + · ”为准：`/^\d{2} .+? · /`；更稳的是给板根加专用标记（如名称前缀 `[board] `）。

### 1.4 字体自包含

原型 CSS 的 `@font-face` 若指向本地路径，改为 base64 dataURI 或相对路径（feed 目录内带 `fonts/`），确保渲染端与 Figma 端同字体。

### 1.5 自检

- 无 JS 渲染 feed 的截图 vs 原型参考：MAE 应 < 5；
- 序列化两份：一份含脚本（自动导入用），一份剥掉全部 `<script>`（插件默认会剥，但提前剥可避免注入脚本被 feed 里的 `</script>` 截断）。

## 2. 字体子集化 + 改名 + 安装

目的：Figma 命中"我们的字体"，避免替换导致断行/字宽变化。

```bash
# fontTools：按字符集子集化（70MB → 2MB 量级）
pyftsubset NotoSansSC-Regular.ttf \
  --text-file=chars.txt --output-file=instances/NotoSansSC-Regular.ttf \
  --layout-features='*' --glyph-names --symbol-cmap --legacy-cmap \
  --notdef-glyph --notdef-outline --recommended-glyphs
```

改名与安装用仓库脚本（完整可运行）：

```bash
python scripts/rename_font.py --src fonts/ --prefix "MP " --out instances/
powershell -NoProfile -File scripts/install_font.ps1 -Src instances -Prefix "MP"
```

脚本要点：按字符集子集化（70MB → 2MB 量级）；改名覆盖 nameID 1/3/4/6/16（17 保留原值）；保留 `OS/2.usWeightClass`（300–900）；安装时复制到 `%LOCALAPPDATA%\Microsoft\Windows\Fonts`、写 HKCU 注册表、`AddFontResourceW` + `WM_FONTCHANGE` 广播。

字体许可是使用者的责任：只对允许修改/嵌入的字体做子集化与改名（OFL 可以；多数商业字体不行）。

验证：Figma 重启后选中文字，字体下拉应显示 `MP ...`；`fontName.family` 前缀检查可通过插件批量跑。

## 3. 导入与拆板

### 3.0 安装上游插件（open-htmltofigma）

1. `git clone https://github.com/kevicebryan/open-htmltofigma.git`（MIT）
2. 固定版本：`git checkout <tag-or-commit>`，把版本写进项目 README/配置，升级前先回归
3. Figma 桌面 → 菜单 **Plugins → Development → Import plugin from manifest…** → 选择仓库里的 `manifest.json`
4. 若提示 id 冲突/已有同名插件，修改 `manifest.json` 的 `id` 后重新导入
5. 插件是静态文件（manifest / code.js / ui.html），通常无需构建；若上游 README 要求 `npm install` 或 build，以它为准

- **固定 open-htmltofigma 版本**（记 commit/tag），并在导入前确认插件行为；避免依赖未文档化的 `ui.html` 元素 ID 以外的私有实现。
- **先把插件视口设成原型尺寸**（本项目 393×852）。插件默认 1440×1024，若 HTML 用 `vh`/媒体查询，不设会把移动布局按桌面解析。
- 注入自动导入脚本时**轮询就绪**，不要固定 sleep（骨架：`BAKED` 由构建脚本替换为 JSON 字符串）：

```html
<script>(function(){
  var BAKED = /* 剥 script 后的 feed HTML，JSON 字符串 */;
  var wait = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  window.addEventListener('load', async function(){
    for (var i = 0; i < 50; i++) {
      if (document.getElementById('html') && document.getElementById('convert')) break;
      await wait(100);
    }
    var ta = document.getElementById('html');
    ta.value = BAKED; ta.dispatchEvent(new Event('input', {bubbles:true}));
    document.getElementById('convert').click();
  });
})();</script>
```

- 拆板插件模式（导入产物通常是一棵"HTML Import"根 + 每屏一个子 Frame）：

```js
const boards = page.findAll(n => n.type === 'FRAME' && /^\d{2} .+? · /.test(n.name));
boards.forEach((b, i) => {
  page.appendChild(b);                 // 提升到顶层
  b.x = i * (b.width + 80); b.y = 0;   // 横排
});
for (const n of page.children.slice()) if (/^HTML Import/.test(n.name)) n.remove();
```

选板正则要放宽到"两位数字 + 任意标题 + ·"，否则 `01 首页` 这类没有 ASCII id 的板会漏掉；更稳的做法是导入时给每板写标记（如 `data-h2f-board="1"` → 插件名 `[board]`），用标记选板。Phase 0 里应校验 `data-screen-id` 为 `[a-z0-9-]+`，保证热区与板名两端一致。

注意：同名重复导入会让 Figma 永久卡 Loading —— 每次导入用全新文件名/页。

## 4. reaction 写入（核心语义）

数据源 `hotspots.json`：`{ artboards: { "<板名>": [{x,y,w,h,goto,name}] } }`，坐标相对板左上角。

```js
/* 命中：bbox 四边 ±2 全等、面积最小的非 TEXT 节点；兜底中心点最深节点 */
function nodeByBox(root, bx, by, bw, bh) { /* walk subtree, compare absBox */ }
function pickNodeAt(root, px, py) { /* walk, keep deepest containing node */ }

async function attachReaction(hit, targetId, board) {
  let cur = hit;
  while (cur && cur !== board) {
    if ((cur.reactions || []).length) { cur = cur.parent; continue; } // 被更具体热区占用 → 上爬
    try { await cur.setReactionsAsync([nav(targetId)]); return cur; }
    catch (e) { cur = cur.parent; }                                    // 节点类型不支持 → 上爬
  }
  return null;
}
const nav = (id) => ({ trigger:{type:'ON_CLICK'},
  actions:[{type:'NODE', destinationId:id, navigation:'NAVIGATE', transition:null, preserveScrollPosition:false}] });
```

规则：
- 按面积**升序**处理热区（子先于父）；
- `goto` 指向当前板自己时跳过（自跳无意义，且会干扰校验计数）；
- 写前只清理**本插件写入**的 reactions：写入时给节点打标记（`node.setPluginData('html2figma','1')` 或按 destinationId 集合匹配），清理时只清带标记的；不要无差别 `setReactionsAsync([])`，那会删掉用户手写的交互；
- 动结构前先复制 Figma 文件并导出 reactions 快照（见 §5 的 `snapshot`），出问题可回滚；
- 校验器要**回放同一套命中 + 上爬逻辑**，否则会把"挂在祖先上的 reaction"误判为缺失。

## 5. 视口化 + 常驻层定位（原地重构）

先判定常驻层（底部栏/顶栏/FAB/浮条……），再按各自视口锚点定位。判定信号与决策表见 SKILL.md 的「常驻层判定」。

```js
/* 0) 安全前提：先复制整个 Figma 文件（云端副本或本地 .fig），并导出 reactions 快照 */
const snapshot = boards.map(b => ({
  board: b.name,
  nodes: b.findAll(n => { try { return (n.reactions || []).length > 0; } catch (e) { return false; } })
          .map(n => ({ name: n.name, reactions: n.reactions })),
}));

/* 1) 存档：全高板克隆到 ARCHIVE 页（存档不依赖 reaction） */
boards.forEach((b, i) => {
  const c = b.clone();
  archive.appendChild(c);
  c.x = i * (393 + 80); c.y = 0;
});

/* 2) 原地重构（关键：不移动板、不克隆，reaction 目标天然有效） */
const cfg = { viewportW: 393, viewportH: 852, fabBottom: 104 };  // 预检从 .phone 实测后写入
const VW = cfg.viewportW, VH = cfg.viewportH;
for (const b of boards) {
  b.resize(VW, VH); b.clipsContent = true;
  const pinned = [];
  for (const p of b.findAll(n => isPersistent(n))) {
    if (anchorOf(p) === 'none') continue;   // toast/未知：保留内容流语义，不要提层
    const rp = relPos(p, b);              // 先算相对板根的坐标
    b.appendChild(p);                     // 提到板根（视口层）
    p.x = rp.x;
    p.y = anchorY(p, VH);                 // bottom -> VH-h; top -> 0; fab -> VH-offset-h
    pinned.push(p);
  }
  /* 3) API 设置滚动 + 固定（实测可用；固定层必须是前 N 个子层） */
  for (const p of pinned.slice().reverse()) b.insertChild(0, p);  // 反转插入保持原相对顺序
  b.numberOfFixedChildren = pinned.length;
  b.overflowDirection = 'VERTICAL';
}

/* 锚点公式（名字/锚点因项目而异，按 HTML 真实 CSS 换算） */
function anchorOf(p) {
  const n = p.name.toLowerCase();
  if (/^nav\.dock$|^dock$|tabbar|bottombar/.test(n)) return 'bottom';
  if (/^nav\.top$|topbar|navbar|appbar/.test(n)) return 'top';
  if (n === 'fab') return 'fab';
  return 'none';                           // toast / 未知：不固定，保留内容流语义
}
function anchorY(p, VH) {
  const t = anchorOf(p);
  if (t === 'fab') return VH - (cfg.fabBottom ?? 104) - p.height;
  if (t === 'bottom') return VH - p.height;
  if (t === 'top') return 0;
  return p.y;                              // 语义不明：保留原坐标并标记待确认
}

/* 选择器：优先用导入时写入的标记，其次按完整名称匹配，避免 "header" 误命中内容标题 */
function isPersistent(n) {
  try { if (n.getPluginData && n.getPluginData('persistent')) return true; } catch (e) { }
  return /^(nav\.dock|nav\.top|dock|tabbar|bottombar|topbar|navbar|appbar|fab|toast)$/i.test(n.name);
}

/* 4) Flow 起点（home = 首页板节点） */
const home = boards.find((b) => /^01 /.test(b.name));
page.flowStartingPoints = [{ nodeId: home.id, name: 'Flow 1' }];
```

若插件 API 在该 Figma 版本表现异常，再退回 UI：`Overflow = Vertical` + `Position = Fixed (stay in place)`（见 figma-ui-and-automation.md）。

为什么固定层要提到板根：`Fixed (stay in place)` 的锚点是相对滚动视口的；只有滚动帧的直接子层能作为固定层，而滚动帧就是这块 393×852 的板。内容层（全高 `div.screen`）作为滚动内容保留原坐标即可。

不要固定这些：随内容滚走的卡片/按钮、滚动时自动隐藏的顶栏（Figma 原生交互复现不了完整逻辑，按状态屏或跟随处理）；判不准先问用户。

> 反面教材：克隆 51 板到新页再重构，然后重映射 destinationId —— 跨页 `setReactionsAsync` 实测 435/435 抛错，等于把交互全部报废。

## 6. 收尾

- 页面命名：`<项目> 51 · 393x852`；
- 跑批插件把结果写进 `page.name`（截图可读），跑完恢复；
- 设备模型 + Flow + Present 三连验证（见 verification.md）。
