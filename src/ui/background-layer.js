/**
 * AETHER · 全屏背景与转场光效图层（纯几何批处理，零全屏片元 SDF 过绘）
 */
import { STAGE_CONFIG } from '../config/layout.config.js';
import { buildRotatedPoly } from '../core/geometry.js';

export class BackgroundLayer {
  render(ctx) {
    const { renderer, theme, anim, metrics } = ctx;
    const { vw, vh } = metrics;
    renderer.setTransform(0, 0, 1);

    // 底层斜向渐变面
    renderer.fillPolyGradient([[0, 0], [vw, 0], [vw, vh], [0, vh]], theme.bgA, theme.bgB, 1.0);

    const t = anim.simTime;
    const breath = 0.5 + 0.5 * Math.sin(t * 1.1);
    const minDim = Math.min(vw, vh);

    // 3 块缓慢漂移的斜切几何色块
    const p1 = buildRotatedPoly(
      vw * 0.16 + Math.sin(t * 0.24) * 32 - anim.camX * 0.5,
      vh * 0.24 + Math.cos(t * 0.19) * 26 - anim.camY * 0.5,
      minDim * (0.46 + breath * 0.014),
      3,
      0.34 + t * 0.03,
      0.14
    );
    renderer.fillPolySolid(p1, theme.bgBlockA, 1.0);

    const p2 = buildRotatedPoly(
      vw * 0.84 + Math.cos(t * 0.20) * 38 - anim.camX * 0.7,
      vh * 0.76 + Math.sin(t * 0.22) * 28 - anim.camY * 0.7,
      minDim * (0.50 - breath * 0.014),
      4,
      -0.32 - t * 0.025,
      -0.20
    );
    renderer.fillPolySolid(p2, theme.bgBlockB, 1.0);

    const p3 = buildRotatedPoly(
      vw * 0.56 + Math.sin(t * 0.28) * 44 - anim.camX * 0.9,
      vh * 0.12 - anim.camY * 0.4,
      minDim * 0.28,
      3,
      0.95 + t * 0.035,
      -0.12
    );
    renderer.fillPolySolid(p3, theme.bgBlockC, 1.0);

    // 与前景七巧板同斜率的极细建筑平行斜线
    const slope = STAGE_CONFIG.slashSlope;
    const gap = 220;
    const drift = ((t * 14 - anim.camX * 1.6) % gap + gap) % gap;
    for (let x = -vh * 0.3 + drift; x < vw + vh * 0.35; x += gap) {
      renderer.strokePolyline([[x, 0], [x + vh * slope, vh]], false, 1.1, theme.bgLine, 1.0);
    }

    // 触控扩散六边形波纹
    for (let i = 0; i < anim.pulses.length; i++) {
      const p = anim.pulses[i];
      const poly = buildRotatedPoly(p.x, p.y, p.r, 6, p.rot, 0);
      renderer.strokePolyline(poly, true, 1.4, theme.bgLine, p.alpha * 3.2);
    }

    // 转场斜线扫光束
    for (let i = 0; i < anim.sweeps.length; i++) {
      const s = anim.sweeps[i];
      const sa = Math.sin(s.p * Math.PI) * 0.35;
      const xPos = -vw * 0.15 + s.p * vw * 1.35;
      renderer.strokePolyline([[xPos, 0], [xPos + vh * slope, vh]], false, 2.2, theme.bgLine, sa * 3.0);
    }
  }
}
