/* gen-pipeline-svg.mjs - generate light/dark SVG pipeline diagrams for the README */
import fs from 'node:fs';

const W = 1200, H = 596;

function theme(dark) {
  return dark ? {
    bg: '#0D1117', card: '#161B22', border: '#30363D', text: '#E6EDF3', muted: '#8B949E',
    accent: '#3FB950', accentSoft: '#0F2A1A', accentText: '#7EE2A8',
    blue: '#58A6FF', blueSoft: '#0C2D6B', blueText: '#A5D6FF',
    purple: '#BC8CFF', purpleSoft: '#271041', purpleText: '#D2A8FF',
    orange: '#F0883E', orangeSoft: '#3A1D0B', orangeText: '#FFC08A',
    teal: '#39C5CF', tealSoft: '#0B2E31', tealText: '#8BE9EF',
    chip: '#21262D',
  } : {
    bg: '#FFFFFF', card: '#F6F8FA', border: '#D0D7DE', text: '#1F2328', muted: '#57606A',
    accent: '#1F6F4F', accentSoft: '#E8F5EE', accentText: '#14532D',
    blue: '#0969DA', blueSoft: '#DDF4FF', blueText: '#0A3069',
    purple: '#8250DF', purpleSoft: '#FBEFFF', purpleText: '#3C1E70',
    orange: '#BC4C00', orangeSoft: '#FFF1E5', orangeText: '#7A2E00',
    teal: '#1B7C83', tealSoft: '#E0F7F9', tealText: '#0B4F55',
    chip: '#EAEEF2',
  };
}

function pill(x, y, w, label, c, opts = {}) {
  const h = opts.h || 34;
  const stroke = opts.dashed ? ` stroke-dasharray="5 4"` : '';
  return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${c.soft}" stroke="${c.line}" stroke-width="1"${stroke}/>
  <text x="${x + w / 2}" y="${y + h / 2 + 4.5}" text-anchor="middle" font-size="${opts.fs || 13}" font-weight="${opts.fw || 500}" fill="${c.text}">${label}</text>
</g>`;
}

function arrow(x1, y, w, c, opts = {}) {
  const y2 = opts.y2 || y;
  const d = opts.path ? opts.path : `M${x1},${y} L${x1 + w - 8},${y2}`;
  return `<path d="${d}" fill="nothing" stroke="${c.muted}" stroke-width="1.6" marker-end="url(#arrow-${opts.id})"/>`;
}

function stage(n, label, y, accent) {
  return `<g>
  <circle cx="64" cy="${y}" r="19" fill="${accent.solid}"/>
  <text x="64" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#FFFFFF">${n}</text>
  <text x="64" y="${y + 44}" text-anchor="middle" font-size="13" font-weight="600" fill="${accent.text}">${label}</text>
</g>`;
}

function build(dark) {
  const t = theme(dark);
  const A = (solid, soft, text) => ({ solid, soft, line: solid, text });
  const cBuild = A(t.accent, t.accentSoft, t.accentText);
  const cInter = A(t.blue, t.blueSoft, t.blueText);
  const cView = A(t.purple, t.purpleSoft, t.purpleText);
  const cVer = A(t.orange, t.orangeSoft, t.orangeText);
  const cNeutral = A(t.muted, t.chip, t.text);
  const cPhase = A(t.teal, t.tealSoft, t.tealText);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="html2figma pipeline">
<defs>
  <marker id="arrow-dark" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${t.muted}"/></marker>
  <marker id="arrow-light" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${t.muted}"/></marker>
  <filter id="soft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="${dark ? '#000000' : '#1F2328'}" flood-opacity="${dark ? '0.45' : '0.08'}"/></filter>
</defs>
<rect x="0" y="0" width="${W}" height="${H}" rx="20" fill="${t.bg}" stroke="${t.border}"/>
<text x="40" y="52" font-size="26" font-weight="700" fill="${t.text}" font-family="'Segoe UI','Noto Sans SC','Microsoft YaHei',sans-serif">html2figma · 管线</text>
<text x="40" y="78" font-size="13.5" fill="${t.muted}" font-family="'Segoe UI','Noto Sans SC','Microsoft YaHei',sans-serif">HTML 手机原型 → Figma 可编辑 · 可点击 · 可滚动 · 常驻层固定</text>
<g font-family="'Segoe UI','Noto Sans SC','Microsoft YaHei',sans-serif">`);

  /* Phase 0 dashed box */
  parts.push(`<rect x="40" y="102" width="920" height="94" rx="14" fill="${t.card}" stroke="${t.border}" stroke-dasharray="6 5"/>
  <text x="60" y="132" font-size="14" font-weight="700" fill="${t.text}">Phase 0 · 仅当还没有 HTML 原型</text>
  <text x="60" y="181" font-size="12" fill="${t.muted}">先做原型并确认，再进 Figma —— 基准错了后面全错</text>`);
  const p0 = [
    ['按规范制作 HTML 原型', 232],
    ['全屏截图 + 路由表', 180],
    ['用户确认（门禁）', 170],
  ];
  let x = 300;
  parts.push(pill(x, 120, p0[0][1], p0[0][0], cPhase, { fw: 600 }));
  x += p0[0][1];
  parts.push(`<path d="M${x + 6},137 L${x + 30},137" stroke="${t.muted}" stroke-width="1.6" marker-end="url(#arrow-${dark ? 'dark' : 'light'})"/>`);
  x += 36;
  parts.push(pill(x, 120, p0[1][1], p0[1][0], cPhase));
  x += p0[1][1];
  parts.push(`<path d="M${x + 6},137 L${x + 30},137" stroke="${t.muted}" stroke-width="1.6" marker-end="url(#arrow-${dark ? 'dark' : 'light'})"/>`);
  x += 36;
  parts.push(pill(x, 120, p0[2][1], p0[2][0], { solid: t.accent, soft: t.accentSoft, line: t.accent }, { fw: 700 }));
  /* gate down arrow */
  parts.push(`<path d="M500,196 L500,224" stroke="${t.muted}" stroke-width="1.6" marker-end="url(#arrow-${dark ? 'dark' : 'light'})"/>`);

  /* dotted spine */
  parts.push(`<path d="M64,238 L64,540" stroke="${t.border}" stroke-width="1.5" stroke-dasharray="3 5"/>`);

  /* Stage 01 build */
  parts.push(stage('01', '构建', 262, cBuild));
  let bx = 210;
  const s1 = [
    ['Feed 构建（UNCLIP · 截断 · 命名）', 236, cBuild],
    ['字体命中（子集化 · 改名 · 安装）', 226, cBuild],
    ['Figma 导入（open-htmltofigma）', 222, cBuild],
    ['拆板（NN id · 标题）', 156, cBuild],
  ];
  s1.forEach(([label, w, c], i) => {
    parts.push(pill(bx, 244, w, label, c, { fs: 12.5 }));
    bx += w;
    if (i < s1.length - 1) {
      parts.push(`<path d="M${bx + 5},261 L${bx + 25},261" stroke="${t.muted}" stroke-width="1.6" marker-end="url(#arrow-${dark ? 'dark' : 'light'})"/>`);
      bx += 30;
    }
  });

  /* Stage 02 interaction */
  parts.push(stage('02', '交互', 338, cInter));
  bx = 210;
  const s2 = [
    ['reactions 写入（bbox ±2 · 上爬 · 自跳跳过）', 322, cInter],
    ['回放校验（ok = exp · wrong = 0）', 236, cInter],
    ['数量审计（dangling = 0）', 196, cInter],
  ];
  s2.forEach(([label, w, c], i) => {
    parts.push(pill(bx, 320, w, label, c, { fs: 12.5 }));
    bx += w;
    if (i < s2.length - 1) {
      parts.push(`<path d="M${bx + 5},337 L${bx + 25},337" stroke="${t.muted}" stroke-width="1.6" marker-end="url(#arrow-${dark ? 'dark' : 'light'})"/>`);
      bx += 30;
    }
  });

  /* Stage 03 viewport */
  parts.push(stage('03', '视口', 414, cView));
  bx = 210;
  const s3 = [
    ['视口化（393×852 · clip）', 196, cView],
    ['常驻层贴视口边（底栏/顶栏/FAB）', 238, cView],
    ['滚动 / 固定（API 优先 · UI 兜底）', 236, cView],
    ['ARCHIVE 存档', 130, cNeutral],
  ];
  s3.forEach(([label, w, c], i) => {
    parts.push(pill(bx, 396, w, label, c, { fs: 12.5 }));
    bx += w;
    if (i < s3.length - 1) {
      parts.push(`<path d="M${bx + 5},413 L${bx + 25},413" stroke="${t.muted}" stroke-width="1.6" marker-end="url(#arrow-${dark ? 'dark' : 'light'})"/>`);
      bx += 30;
    }
  });

  /* Stage 04 verify */
  parts.push(stage('04', '验收', 492, cVer));
  bx = 210;
  const s4 = [
    ['像素 MAE（@dx,dy 裁剪 · ±2px 搜索）', 250, cVer],
    ['交互审计 / 回放', 140, cVer],
    ['Present 三连（初始 / 滚动 / 跳屏）', 252, cVer],
    ['全部通过才交付', 132, cNeutral],
  ];
  s4.forEach(([label, w, c], i) => {
    parts.push(pill(bx, 474, w, label, c, { fs: 12.5 }));
    bx += w;
    if (i < s4.length - 1) {
      parts.push(`<path d="M${bx + 5},491 L${bx + 25},491" stroke="${t.muted}" stroke-width="1.6" marker-end="url(#arrow-${dark ? 'dark' : 'light'})"/>`);
      bx += 30;
    }
  });

  /* footer note */
  parts.push(`<text x="40" y="562" font-size="11.5" fill="${t.muted}">每个阶段都有独立验收，可随时停下检查；构建阶段可并行，交互与视口必须按顺序。</text>`);
  parts.push(`</g></svg>`);
  return parts.join('\n');
}

fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/pipeline-light.svg', build(false), 'utf8');
fs.writeFileSync('assets/pipeline-dark.svg', build(true), 'utf8');
console.log('wrote assets/pipeline-light.svg', fs.statSync('assets/pipeline-light.svg').size);
console.log('wrote assets/pipeline-dark.svg', fs.statSync('assets/pipeline-dark.svg').size);
