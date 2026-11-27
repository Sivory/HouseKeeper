/**
 * AETHER · 一级主控总览视图（七巧板大斜线拼合视图）
 * 仅负责根据 compiled layout 与 HomeStore 状态向渲染原语发射绘制指令与命中热区
 */
import { mixColorInto } from '../../engine/theme.js';
import { compileHubLayout } from '../../core/geometry.js';
import { draw3DPolySlab, drawConcentricCore, drawProgressBar } from '../primitives.js';

const tmpTextCol = [0, 0, 0, 1];
const tmpTuneBg = [0, 0, 0, 1];

export class HubView {
  constructor() {
    this.id = 'hub';
    this.pieces = [];
  }

  /** 视口尺寸变更时重新编译七巧板几何 */
  rebuild(metrics) {
    this.pieces = compileHubLayout(metrics.innerW, metrics.innerH);
  }

  render(ctx, alpha, collectHits) {
    const { renderer, fontAtlas, theme, store, anim } = ctx;
    const outProgress = 1 - alpha;
    const activeScene = store.getActiveScene();
    const roomTemp = store.getRoomTempText();
    const now = new Date();
    const clockStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      const dx = p.out[0] * outProgress;
      const dy = p.out[1] * outProgress;

      if (p.role === 'hero') {
        this._renderHero(ctx, p, dx, dy, alpha, clockStr, roomTemp, activeScene);
      } else if (p.role === 'scene') {
        this._renderScenePiece(ctx, p, dx, dy, alpha, collectHits);
      } else if (p.role === 'device') {
        this._renderDevicePiece(ctx, p, dx, dy, alpha, collectHits);
      } else if (p.role === 'nav' || p.role === 'sleep') {
        this._renderNavPiece(ctx, p, dx, dy, alpha, collectHits);
      }
    }
  }

  _renderHero(ctx, p, dx, dy, alpha, clockStr, roomTemp, activeScene) {
    const { renderer, fontAtlas, theme, store } = ctx;
    const drop = draw3DPolySlab(ctx, p.points, p.id, 0, alpha, dx, dy, true);
    const topY = p.tl[1] + 50 + dy + drop;
    const leftX = p.tl[0] + 36 + dx;
    const rightX = p.tr[0] - 44 + dx;

    fontAtlas.drawText(renderer, clockStr, leftX, topY, 42, 'left', theme.textPrimary, alpha, 'light', 2);
    fontAtlas.drawText(
      renderer,
      `${roomTemp}°C · ${store.state.securityArmed ? '警戒中' : '居家'}`,
      rightX,
      topY + 4,
      15,
      'right',
      theme.textSecondary,
      alpha,
      'regular',
      0.6
    );

    const coreX = leftX + 86;
    const coreY = p.tl[1] + p.bounds.h * 0.62 + dy + drop;
    drawConcentricCore(ctx, coreX, coreY, alpha);

    const textX = coreX + 106;
    fontAtlas.drawText(renderer, activeScene.en, textX, coreY - 40, 12, 'left', theme.textSecondary, alpha, 'regular', 2.2);
    fontAtlas.drawText(renderer, activeScene.name, textX, coreY + 2, 44, 'left', theme.heroSceneText, alpha, 'light', 2);
    fontAtlas.drawText(renderer, `实时功耗 ${store.getTotalWatt()} W`, textX, coreY + 46, 13, 'left', theme.textSecondary, alpha, 'regular', 0.8);
  }

  _renderScenePiece(ctx, p, dx, dy, alpha, collectHits) {
    const { renderer, fontAtlas, theme, store, anim } = ctx;
    const sc = store.getScenes().find((s) => s.id === p.sceneId);
    if (!sc) return;

    const act = anim.activeMap.get(p.id) || 0;
    const drop = draw3DPolySlab(ctx, p.points, p.id, act, alpha, dx, dy, false);

    mixColorInto(tmpTextCol, theme.textPrimary, theme.textInverse, act);
    const baseX = p.bl[0] + 28 + dx;
    const baseY = p.bl[1] - (p.compact ? 26 : 30) + dy + drop;

    fontAtlas.drawText(renderer, sc.en, baseX, baseY - 26, 11, 'left', tmpTextCol, alpha * 0.62, 'regular', 1.4);
    fontAtlas.drawText(renderer, sc.name, baseX, baseY, p.compact ? 21 : 25, 'left', tmpTextCol, alpha, 'regular', 1.2);

    if (collectHits) {
      ctx.hitRegions.push({
        id: p.id,
        poly: p.points,
        zIndex: 10,
        kind: 'button',
        onTap: (cx, cy) => store.applyScene(sc.id, { x: cx, y: cy })
      });
    }
  }

  _renderDevicePiece(ctx, p, dx, dy, alpha, collectHits) {
    const { renderer, fontAtlas, theme, store, anim } = ctx;
    const dev = store.getDevice(p.deviceId);
    if (!dev) return;

    const act = anim.activeMap.get(p.id) || 0;
    const drop = draw3DPolySlab(ctx, p.points, p.id, act, alpha, dx, dy, false);

    mixColorInto(tmpTextCol, theme.textPrimary, theme.textInverse, act);
    const padL = p.size === 'large' ? 42 : 34;
    const leftTopX = p.tl[0] + padL + dx;
    const topY = Math.max(p.tl[1], p.tr[1]) + 36 + dy + drop;

    fontAtlas.drawText(renderer, dev.zone, leftTopX, topY, 12, 'left', tmpTextCol, alpha * 0.6, 'regular', 1.6);

    // 嵌套子按钮：「精调 ▸」
    const tuneId = `tune_${dev.id}`;
    const tunePress = anim.pressMap.get(tuneId) || 0;
    mixColorInto(tmpTuneBg, theme.tuneBgIdle, theme.tuneBgActive, act);
    renderer.fillPolySolid(p.tunePoly, tmpTuneBg, alpha, dx, dy + drop + tunePress * 2.5);
    fontAtlas.drawText(
      renderer,
      '精调 ▸',
      p.tuneCenter[0] + dx,
      p.tuneCenter[1] + dy + drop + tunePress * 2.5,
      12,
      'center',
      tmpTextCol,
      alpha * 0.92,
      'regular',
      0.6
    );

    const botLeftX = p.bl[0] + padL + dx;
    const botRightX = p.br[0] - 32 + dx;
    const barY = p.bl[1] - 28 + dy + drop;
    const barW = Math.max(60, botRightX - botLeftX);

    const isLarge = p.size === 'large';
    fontAtlas.drawText(renderer, dev.name, botLeftX, barY - (isLarge ? 68 : 54), isLarge ? 36 : 24, 'left', tmpTextCol, alpha, isLarge ? 'light' : 'regular', 1);
    fontAtlas.drawText(renderer, store.formatDeviceMetric(dev), botLeftX, barY - (isLarge ? 28 : 22), isLarge ? 24 : 18, 'left', tmpTextCol, alpha * 0.8, 'light', 0.6);

    drawProgressBar(ctx, botLeftX, barY, barW, 3.2, anim.progressMap.get(dev.id) || 0, tmpTextCol, alpha);

    if (collectHits) {
      ctx.hitRegions.push({
        id: p.id,
        poly: p.points,
        zIndex: 10,
        kind: 'button',
        onTap: (cx, cy) => store.toggleDevice(dev.id, { x: cx, y: cy })
      });
      // 子按钮 zIndex 更高，优先拦截点击避免误触父开关
      ctx.hitRegions.push({
        id: tuneId,
        poly: p.tunePoly,
        zIndex: 20,
        kind: 'button',
        onTap: (cx, cy) => {
          store.selectDevice(dev.id);
          store.switchView('inspector', { x: cx, y: cy });
        }
      });
    }
  }

  _renderNavPiece(ctx, p, dx, dy, alpha, collectHits) {
    const { renderer, fontAtlas, theme, store } = ctx;
    const drop = draw3DPolySlab(ctx, p.points, p.id, 0, alpha, dx, dy, false);
    const cy = (p.tl[1] + p.bl[1]) * 0.5 + dy + drop;
    const lx = p.bl[0] + 34 + dx;
    const rx = p.br[0] - 28 + dx;

    fontAtlas.drawText(renderer, p.title, lx, cy - 11, 18, 'left', theme.textPrimary, alpha, 'regular', 0.8);
    fontAtlas.drawText(renderer, p.sub, lx, cy + 13, 12, 'left', theme.textSecondary, alpha * 0.85, 'regular', 0.5);
    fontAtlas.drawText(renderer, '▸', rx, cy, 15, 'right', theme.textSecondary, alpha * 0.8, 'regular');

    if (collectHits) {
      ctx.hitRegions.push({
        id: p.id,
        poly: p.points,
        zIndex: 10,
        kind: 'button',
        onTap: (cx, cyPt) => {
          if (p.role === 'sleep') store.applyScene('night', { x: cx, y: cyPt });
          else store.switchView(p.targetView, { x: cx, y: cyPt });
        }
      });
    }
  }
}
