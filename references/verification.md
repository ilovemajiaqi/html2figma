# 验收方法（像素 / 交互 / 演示）

三层验收必须都过；任何一层缺失都不算交付。

## 1. 像素还原（导出 vs 原型参考）

### 1.1 导出

```js
const bb = board.absoluteBoundingBox;            // 板框
const rb = board.absoluteRenderBounds || bb;     // 含阴影/描边溢出
const odx = Math.round(bb.x - rb.x), ody = Math.round(bb.y - rb.y);
const bytes = await board.exportAsync({ format:'PNG', constraint:{ type:'SCALE', value:2 } });
// 文件名带上偏移：NN id · title@odx,ody.png
```

- 必须 **2x** 导出（参考截图是 2x）；
- 文件名记录 `odx,ody`（CSS px），比对时按 `odx*2, ody*2` 裁掉阴影溢出；
- 不裁偏移直接比会把 MAE 拉到 30+，误判成"整体错位"。

### 1.2 比对

- 参考图若为**全高截图**（内容高度 > 视口），只取顶部 `视口高×2` 像素参与比对（如 852 → 1704px）；
- 对每屏做 ±2px（或 ±3px）平移搜索，取最小 MAE，避免 1px 舍入误伤；
- 采样可隔 2–3 像素加速；比较区域避开最外 8px（抗锯齿边界）。

### 1.3 阈值与基线

| 指标 | 正常 | 需排查 |
|------|------|--------|
| MAE | 3–12（文字抗锯齿/1–2px 行高差；本项目 4.05–10.51） | > 15 |
| 单屏最差 | 10–12（密集文字屏） | > 15 |

本机实测（393×852 视口 vs 参考顶部）：pomodoro 4.05、home 4.76、tasks 6.45、notes-list 7.06、schedule 7.48、ai-home 7.96、week 10.51。全高板阶段 home 3.02 / tasks 4.24，说明视口裁切本身不引入误差。

### 1.4 文字缺陷专项

- **墨迹盒 vs 声明框**：遍历文本节点，比较文本实际墨迹高度与 frame 高；clamp 节点修复后墨迹高应 ≤ 框高 + 1px；
- 输出"溢出对"清单后逐条判定：合法层叠（内联碎片、水印、阴影、刻意压层）排除，真叠字修复；
- 修复优先在 Figma 侧设 `textTruncation='ENDING'` + `maxLines=N`（需 `loadFontAsync`）；只有断行仍与浏览器不一致时，才回到 feed 烘焙（DOM 层）。不要在 Figma 里逐字手改——与下次导入不一致。

## 2. 交互（reaction）

### 2.1 数量审计（不依赖坐标，最稳）

遍历每块板的所有后代，统计带 `NODE` action 的节点：

```js
for (const x of board.findAll(() => true)) {
  const rs = x.reactions || [];
  for (const r of rs) for (const a of r.actions || []) if (a.type === 'NODE') {
    total++; if (boardIds.has(a.destinationId)) valid++; else dangling++;
  }
}
```

达标：`dangling === 0`，`valid` 与热区期望数一致（本项目 435 条 / 51 板；dock 每屏 6 条，`今天` 不含自跳）。数量不符时按板对比期望，差值定位到具体屏。

### 2.2 回放校验（坐标命中 + 上爬）

用**与写入器相同**的命中/上爬逻辑回放：

```
for 热区 (按面积升序):
  hit = nodeByBox(板, 热区框) || pickNodeAt(板, 中心)
  从 hit 向祖先走，第一个带 reaction 的节点其 destinationId 必须 == 目标板
```

输出 `exp / ok / wrong / noNode / noReact`，达标 `ok == exp && wrong == 0`。
注意：只做 `nodeByBox` 精确匹配而不做上爬回放，会把"挂在祖先上的 reaction"误报成 noReact/noNode（本项目曾出现 200 noNode 的假警报，全是 dock 坐标变化 + 未回放上爬语义所致）。

### 2.3 状态回读

插件结果写 `page.name = 'MPR exp=435 ok=435 wrong=0 noNode=0 noReact=0'`（数字以你的项目为准），截图左上角即可读；跑完把页名恢复为 `项目 51 · 393x852`。

## 3. 演示（Present 实测）

按顺序截三张图，缺一不可：

1. **首屏**：手机模型内常驻层（底部栏/顶栏/FAB）完整贴在视口锚点，内容与 HTML 初始视图一致；
2. **滚动后**：注入滚轮（`PostMessage WM_MOUSEWHEEL`，负 delta 向下），内容移动、**需要固定的常驻层不动**；
3. **跳屏后**：键盘 `Tab` 聚焦热区 + `Enter`，跳到目标屏，常驻层的高亮/选中态随屏切换。

判读要点：
- 常驻层是否真的在视口内（不是长图末尾）；
- 滚动时常驻层是否跟随内容（跟随 = Fixed 没生效）；
- 跳屏后底部安全区、圆角、状态栏是否仍与目标屏一致。

## 4. HTML 原型门禁（仅 Phase 0）

没有现成 HTML 时，在进入 Figma 之前必须完成：
- 全部屏 @2x 截图 + 路由表 + 常驻层清单交付用户；
- 用户明确确认布局/文案/交互；
- 自检清单全部通过（见 [html-prototype-spec.md](html-prototype-spec.md) §7）。
未确认就导入，后续所有几何与热区都要返工。

## 5. 失败分诊表

| 症状 | 先查什么 |
|------|----------|
| 导出比对 MAE 全屏 30+ | 是否忘记按 `@dx,dy` 裁阴影溢出；是否 1x vs 2x |
| 单屏局部错位 | 该屏文本是否未设原生截断/烘焙；字体是否命中（加前缀的字体家族） |
| 文字压层 | 墨迹盒专项：定位节点 → 先设原生截断 → 仍不一致再查 feed clamp 算法（padding/省略号规则） |
| reaction 数量少 | 是否克隆过板/换过页；写入器是否在正确标签运行 |
| reaction 有但点击无反应 | 节点是否在 clip 外；是否被更深层 reaction 拦截；Present 里用 Tab 顺序确认 |
| 滚动无效果 | Overflow 是否 Vertical；内容是否真的高于视口；是否把内容放在固定层里 |
| 常驻层滚动时跟着走 | Position 是否 Fixed；它是否是视口板的直接子层 |
| 常驻层根本不在视口内 | 视口化是否执行；锚点公式是否按 top/bottom 算对 |
| 播放器点击无效 | 合成点击被过滤 → Tab+Enter；滚动用 PostMessage |
| 面板值改了没生效 | 多选是否仍保持（点击画布会丢选择）→ 重新选中再设 |
