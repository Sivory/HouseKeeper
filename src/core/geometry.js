/**
 * AETHER · 纯几何数学与声明式布局求值引擎
 * 负责将 layout.config.js 中的声明式比例/交点规则编译为精确多边形顶点，供渲染与碰撞共用
 */
import {
  STAGE_CONFIG,
  HUB_GUIDES,
  HUB_SLOTS_CONFIG,
  SUB_LAYOUT_CONFIG
} from '../config/layout.config.js';
import { SLEEP_TIMER_OPTIONS, MACROS_CONFIG } from '../config/home.config.js';

/** 生成斜切平行四边形顶点 */
export function makeSlashRect(x, y, w, h, slant = 14) {
  return [
    [x + slant, y],
    [x + w, y],
    [x + w - slant, y + h],
    [x, y + h]
  ];
}

/** 生成双切角大面板顶点 */
export function makeChamferPanel(x, y, w, h, cTR = 42, cBL = 34) {
  return [
    [x, y],
    [x + w - cTR, y],
    [x + w, y + cTR],
    [x + w, y + h],
    [x + cBL, y + h],
    [x, y + h - cBL]
  ];
}

/** 生成旋转正多边形顶点（用于背景色块、同心三角与扩散波纹） */
export function buildRotatedPoly(cx, cy, radius, sides, angle, skew = 0) {
  const pts = [];
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI * 0.5;
    let x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    x += y * skew;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

/** 计算多边形包围盒 */
export function computeBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const px = points[i][0], py = points[i][1];
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, maxX, maxY };
}

/** 计算弹性舞台视口参数 */
export function computeViewportMetrics(vw, vh) {
  const { baseHeight, minRatio, maxRatio, outerPadding } = STAGE_CONFIG;
  const ratio = Math.max(minRatio, Math.min(maxRatio, vw / Math.max(vh, 1)));
  const stageW = Math.round(baseHeight * ratio);
  const stageH = baseHeight;
  const scale = Math.min(vw / stageW, vh / stageH);
  const offsetX = (vw - stageW * scale) * 0.5;
  const offsetY = (vh - stageH * scale) * 0.5;
  const innerW = stageW - outerPadding * 2;
  const innerH = stageH - outerPadding * 2;

  return {
    vw, vh, stageW, stageH, scale, offsetX, offsetY, innerW, innerH,
    innerOriginX: offsetX + outerPadding * scale,
    innerOriginY: offsetY + outerPadding * scale
  };
}

/** 根据声明式规则求值单个七巧板顶点坐标 */
function resolveSlotVertex(spec, W, H, hg, slope) {
  const yVal = spec.edgeY === 'top'
    ? 0
    : spec.edgeY === 'bottom'
      ? H
      : HUB_GUIDES.y[spec.yLine] * H + (spec.yGap || 0) * hg;

  if (spec.edgeX === 'left') return [0, yVal];
  if (spec.edgeX === 'right') return [W, yVal];

  const x0 = HUB_GUIDES.x[spec.xLine] * W + (spec.xGap || 0) * hg;
  const k = spec.k ? HUB_GUIDES.k[spec.k] : 0;

  if (k === 0) {
    return [x0 + slope * yVal, yVal];
  }
  const x = (x0 + slope * yVal) / (1 - slope * k);
  const y = yVal + k * x;
  return [x, y];
}

/** 编译一级七巧板布局（纯数据驱动，无硬编码坐标） */
export function compileHubLayout(W, H) {
  const hg = STAGE_CONFIG.tangramGap * 0.5;
  const slope = STAGE_CONFIG.slashSlope;
  const tb = SUB_LAYOUT_CONFIG.tuneButton;

  return HUB_SLOTS_CONFIG.map((slot, index) => {
    const points = slot.verts.map((v) => resolveSlotVertex(v, W, H, hg, slope));
    const bounds = computeBounds(points);
    const [tl, tr, br, bl] = points;

    let tunePoly = null;
    let tuneCenter = null;
    if (slot.role === 'device') {
      const rightX = tr[0] - tb.rightInset;
      const topY = Math.max(tl[1], tr[1]) + tb.topInset;
      tunePoly = makeSlashRect(rightX - tb.width, topY, tb.width, tb.height, tb.slant);
      tuneCenter = [rightX - tb.width * 0.5, topY + tb.height * 0.5];
    }

    return { ...slot, index, points, bounds, tl, tr, br, bl, tunePoly, tuneCenter };
  });
}

/** 编译二级视图 A：精细调参布局 */
export function compileInspectorLayout(W, H, devices) {
  const C = SUB_LAYOUT_CONFIG;
  const bodyY = C.headerHeight + C.headerGap;
  const bodyH = H - bodyY;
  const leftW = Math.round(W * C.leftColumnRatio);
  const rightX = leftW + C.columnGap;
  const rightW = W - rightX;

  const backPoly = makeSlashRect(0, 2, C.backButton.width, C.backButton.height, C.backButton.slant);

  const sw = C.switcher;
  const totalSwW = devices.length * sw.width + (devices.length - 1) * sw.gap;
  const swStartX = W - totalSwW;
  const switchers = devices.map((d, i) => {
    const x = swStartX + i * (sw.width + sw.gap);
    return {
      id: `insp_sw_${d.id}`,
      deviceId: d.id,
      name: d.name,
      poly: makeSlashRect(x, 5, sw.width, sw.height, sw.slant),
      cx: x + sw.width * 0.5,
      cy: 5 + sw.height * 0.5
    };
  });

  const leftPanel = makeChamferPanel(0, bodyY, leftW, bodyH, C.panelChamferTR, C.panelChamferBL);
  const rightPanel = makeChamferPanel(rightX, bodyY, rightW, bodyH, C.panelChamferTR, C.panelChamferBL);

  const btnY = bodyY + bodyH - C.actionButtonHeight - C.actionButtonBottomMargin;
  const powerBtn = makeSlashRect(C.actionButtonInsetX, btnY, leftW - C.actionButtonInsetX * 2, C.actionButtonHeight, 16);

  const presetGap = 14;
  const presetInnerW = rightW - C.actionButtonInsetX * 2;
  const presetW = (presetInnerW - presetGap * 3) / 4;
  const presetPolys = [0, 1, 2, 3].map((i) => {
    const x = rightX + C.actionButtonInsetX + i * (presetW + presetGap);
    return {
      x, y: btnY, w: presetW, h: C.actionButtonHeight,
      poly: makeSlashRect(x, btnY, presetW, C.actionButtonHeight, 14)
    };
  });

  return {
    backPoly,
    backCenter: [C.backButton.width * 0.5, 2 + C.backButton.height * 0.5],
    switchers,
    leftPanel,
    rightPanel,
    leftRect: { x: 0, y: bodyY, w: leftW, h: bodyH },
    rightRect: { x: rightX, y: bodyY, w: rightW, h: bodyH },
    powerBtn,
    powerCenter: [leftW * 0.5, btnY + C.actionButtonHeight * 0.5],
    presetPolys
  };
}

/** 编译二级视图 B：安防与定时布局 */
export function compileAutomationLayout(W, H) {
  const C = SUB_LAYOUT_CONFIG;
  const bodyY = C.headerHeight + C.headerGap;
  const bodyH = H - bodyY;
  const leftW = Math.round(W * C.leftColumnRatio);
  const rightX = leftW + C.columnGap;
  const rightW = W - rightX;
  const halfH = (bodyH - C.columnGap) * 0.5;

  const backPoly = makeSlashRect(0, 2, C.backButton.width, C.backButton.height, C.backButton.slant);
  const secPanel = makeChamferPanel(0, bodyY, leftW, bodyH, C.panelChamferTR, C.panelChamferBL);
  const timerPanel = makeChamferPanel(rightX, bodyY, rightW, halfH, C.panelChamferTR, C.panelChamferBL);
  const macroPanel = makeChamferPanel(rightX, bodyY + halfH + C.columnGap, rightW, halfH, C.panelChamferTR, C.panelChamferBL);

  const secBtnY = bodyY + bodyH - C.actionButtonHeight - C.actionButtonBottomMargin;
  const secBtn = makeSlashRect(C.actionButtonInsetX, secBtnY, leftW - C.actionButtonInsetX * 2, C.actionButtonHeight, 16);

  const innerW = rightW - C.actionButtonInsetX * 2;
  const btnGap = 14;

  const tW = (innerW - btnGap * (SLEEP_TIMER_OPTIONS.length - 1)) / SLEEP_TIMER_OPTIONS.length;
  const tY = bodyY + halfH - C.actionButtonHeight - 40;
  const timerBtns = SLEEP_TIMER_OPTIONS.map((opt, i) => {
    const x = rightX + C.actionButtonInsetX + i * (tW + btnGap);
    return { ...opt, x, y: tY, w: tW, h: C.actionButtonHeight, poly: makeSlashRect(x, tY, tW, C.actionButtonHeight, 14) };
  });

  const mW = (innerW - btnGap * (MACROS_CONFIG.length - 1)) / MACROS_CONFIG.length;
  const mY = bodyY + halfH + C.columnGap + halfH - C.actionButtonHeight - 40;
  const macroBtns = MACROS_CONFIG.map((cfg, i) => {
    const x = rightX + C.actionButtonInsetX + i * (mW + btnGap);
    return { ...cfg, x, y: mY, w: mW, h: C.actionButtonHeight, poly: makeSlashRect(x, mY, mW, C.actionButtonHeight, 14) };
  });

  return {
    backPoly,
    backCenter: [C.backButton.width * 0.5, 2 + C.backButton.height * 0.5],
    secPanel,
    timerPanel,
    macroPanel,
    secRect: { x: 0, y: bodyY, w: leftW, h: bodyH },
    timerRect: { x: rightX, y: bodyY, w: rightW, h: halfH },
    macroRect: { x: rightX, y: bodyY + halfH + C.columnGap, w: rightW, h: halfH },
    secBtn,
    secBtnCenter: [leftW * 0.5, secBtnY + C.actionButtonHeight * 0.5],
    timerBtns,
    macroBtns
  };
}
