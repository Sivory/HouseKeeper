/**
 * AETHER · WebGL UI 可复用绘制原语（Primitives）
 * 封装 3D 挤出多边形板块、同心三角核心、进度条与宽大触屏滑块，消除各视图重复绘制代码
 */
import { mixColorInto } from '../engine/theme.js';
import { buildRotatedPoly, makeSlashRect } from '../core/geometry.js';

const tmpA = [0, 0, 0, 1];
const tmpB = [0, 0, 0, 1];
const tmpC = [0, 0, 0, 1];

/**
 * 绘制带 3D 挤出厚度、触屏按压沉降、145° 陶瓷渐变、呼吸微光与发丝描边的多边形板块
 * @returns {number} 当前表面按压下沉量 surfaceDrop（供内部文字同步位移）
 */
export function draw3DPolySlab(ctx, poly, id, activeAmt, alpha, dx = 0, dy = 0, isHero = false) {
  const { renderer, theme, anim } = ctx;
  const press = anim.pressMap.get(id) || 0;
  const extrudeDrop = 9 - press * 6.5;
  const surfaceDrop = press * 6.0;

  // 底层 3D 挤出底座
  mixColorInto(tmpA, theme.extrudeIdle, theme.extrudeActive, activeAmt);
  renderer.fillPolySolid(poly, tmpA, alpha, dx, dy + extrudeDrop);

  // 表面 145° 陶瓷渐变
  const baseA = isHero ? theme.heroA : theme.idleA;
  const baseB = isHero ? theme.heroB : theme.idleB;
  mixColorInto(tmpA, baseA, theme.activeA, activeAmt);
  mixColorInto(tmpB, baseB, theme.activeB, activeAmt);
  renderer.fillPolyGradient(poly, tmpA, tmpB, alpha, dx, dy + surfaceDrop);

  // 激活态或主中枢角点呼吸微光（严格贴合多边形边界，使用增量相位彻底消除切场景闪烁）
  if (isHero || activeAmt > 0.05) {
    const breath = 0.55 + 0.45 * Math.sin(anim.breathPhase);
    const glowCol = isHero ? theme.breathGlow : theme.activeBreathGlow;
    const glowAlpha = alpha * breath * (isHero ? 0.72 : activeAmt * 0.85);
    renderer.fillPolyCornerGlow(poly, glowCol, glowAlpha, dx, dy + surfaceDrop);
  }

  // 精确发丝描边
  mixColorInto(tmpC, theme.strokeIdle, theme.strokeActive, activeAmt);
  renderer.strokePolyline(poly, true, 1.3, tmpC, alpha, dx, dy + surfaceDrop);

  return surfaceDrop;
}

/** 绘制全场唯一的同心三角旋转呼吸核心 */
export function drawConcentricCore(ctx, cx, cy, alpha) {
  const { renderer, theme, anim } = ctx;
  const breathScale = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(anim.breathPhase));

  const tri1 = buildRotatedPoly(cx, cy, 82, 3, anim.triAngle1, 0);
  const tri2 = buildRotatedPoly(cx, cy, 62 * breathScale, 3, 0, 0);
  const tri3 = buildRotatedPoly(cx, cy, 38, 3, anim.triAngle3, 0);

  renderer.strokePolyline(tri1, true, 1.3, theme.coreRing1, alpha);
  renderer.strokePolyline(tri2, true, 2.0, theme.accentCore, alpha * (0.68 + 0.32 * (breathScale - 0.8) * 10));
  renderer.strokePolyline(tri3, true, 1.3, theme.coreRing3, alpha);
  renderer.fillRegularPoly(cx, cy, 4.8, 12, 0, theme.accentCore, alpha);
}

/** 绘制极简细进度条 */
export function drawProgressBar(ctx, x, y, w, h, progress, fillColor, alpha) {
  const { renderer, theme } = ctx;
  renderer.fillRect(x, y, w, h, theme.trackBg, alpha);
  if (progress > 0.005) {
    renderer.fillRect(x, y, w * progress, h, fillColor, alpha * 0.92);
  }
}

/**
 * 绘制宽大斜切触屏滑块并注册拖动碰撞热区
 */
export function drawTouchSlider(ctx, opts) {
  const { renderer, fontAtlas, theme } = ctx;
  const { id, label, valueText, norm, x, y, w, alpha, slideOffsetX, collectHits, onDrag, onRelease } = opts;

  fontAtlas.drawText(renderer, label, x + slideOffsetX, y - 34, 17, 'left', theme.textSecondary, alpha, 'regular', 1);
  fontAtlas.drawText(renderer, valueText, x + w + slideOffsetX, y - 34, 30, 'right', theme.textPrimary, alpha, 'light', 0.6);

  const trackPoly = makeSlashRect(x, y, w, 40, 14);
  renderer.fillPolySolid(trackPoly, theme.trackBg, alpha, slideOffsetX, 0);

  const fillW = Math.max(24, w * norm);
  const fillPoly = makeSlashRect(x, y, fillW, 40, 14);
  renderer.fillPolySolid(fillPoly, theme.accentSolid, alpha * 0.88, slideOffsetX, 0);

  const thumbX = x + norm * (w - 44);
  const thumbPoly = makeSlashRect(thumbX, y - 4, 44, 48, 12);
  renderer.fillPolySolid(thumbPoly, theme.accentSolid, alpha, slideOffsetX, 0);
  renderer.strokePolyline(thumbPoly, true, 1.4, theme.toastText, alpha * 0.35, slideOffsetX, 0);

  if (collectHits) {
    ctx.hitRegions.push({
      id,
      poly: makeSlashRect(x - 10, y - 14, w + 20, 68, 14),
      zIndex: 18,
      kind: 'slider',
      onDrag,
      onRelease
    });
  }
}
