/**
 * AETHER · 二级视图 A：触屏精细调参视图
 */
import { mixColorInto } from '../../engine/theme.js';
import { compileInspectorLayout } from '../../core/geometry.js';
import { draw3DPolySlab, drawTouchSlider } from '../primitives.js';

const tmpCol = [0, 0, 0, 1];

export class InspectorView {
  constructor() {
    this.id = 'inspector';
    this.layout = null;
  }

  rebuild(metrics, store) {
    this.layout = compileInspectorLayout(metrics.innerW, metrics.innerH, store.state.devices);
  }

  render(ctx, alpha, collectHits) {
    const { renderer, fontAtlas, theme, store } = ctx;
    const L = this.layout;
    if (!L) return;

    const dev = store.getSelectedDevice();
    const spec = store.getDeviceSpec(dev);
    const inSlide = (1 - alpha) * 68;

    // 左上返回按钮（使用强调色保证明暗模式下均有高对比度）
    const backPress = ctx.anim.pressMap.get('insp_back') || 0;
    const backDrop = backPress * 5;
    renderer.fillPolySolid(L.backPoly, theme.extrudeActive, alpha, inSlide * 0.5, 8 - backPress * 5);
    renderer.fillPolySolid(L.backPoly, theme.accentSolid, alpha, inSlide * 0.5, backDrop);
    fontAtlas.drawText(renderer, '◁  返回', L.backCenter[0] + inSlide * 0.5, L.backCenter[1] + backDrop, 16, 'center', theme.toastText, alpha, 'regular', 1.2);
    if (collectHits) {
      ctx.hitRegions.push({
        id: 'insp_back',
        poly: L.backPoly,
        zIndex: 15,
        kind: 'button',
        onTap: (cx, cy) => store.switchView('hub', { x: cx, y: cy })
      });
    }

    // 顶部设备快捷切换胶囊
    for (let i = 0; i < L.switchers.length; i++) {
      const sw = L.switchers[i];
      const isSel = sw.deviceId === dev.id ? 1 : 0;
      const d = draw3DPolySlab(ctx, sw.poly, sw.id, isSel, alpha, inSlide * 0.6, 0, false);
      mixColorInto(tmpCol, theme.textPrimary, theme.textInverse, isSel);
      fontAtlas.drawText(renderer, sw.name, sw.cx + inSlide * 0.6, sw.cy + d, 14, 'center', tmpCol, alpha, 'regular', 0.4);
      if (collectHits) {
        ctx.hitRegions.push({
          id: sw.id,
          poly: sw.poly,
          zIndex: 15,
          kind: 'button',
          onTap: () => store.selectDevice(sw.deviceId)
        });
      }
    }

    // 左斜切大面板：读数与开关
    draw3DPolySlab(ctx, L.leftPanel, 'insp_left', 0, alpha, inSlide, 0, true);
    const lr = L.leftRect;
    fontAtlas.drawText(renderer, dev.zone, lr.x + 42 + inSlide, lr.y + 48, 13, 'left', theme.textSecondary, alpha, 'regular', 1.8);
    fontAtlas.drawText(renderer, dev.name, lr.x + 42 + inSlide, lr.y + 94, 38, 'left', theme.textPrimary, alpha, 'light', 1.5);

    const bigText = !dev.on ? 'OFF' : dev.kind === 'climate' ? `${dev.value.toFixed(1)}°` : `${Math.round(dev.value)}%`;
    const subText = `${dev.kind === 'light' ? `${dev.temp}K · ` : ''}${store.calcDeviceWatt(dev)}W`;
    fontAtlas.drawText(renderer, bigText, lr.x + 42 + inSlide, lr.y + lr.h * 0.48, 84, 'left', theme.textPrimary, alpha, 'light', 1);
    fontAtlas.drawText(renderer, subText, lr.x + 44 + inSlide, lr.y + lr.h * 0.48 + 64, 16, 'left', theme.textSecondary, alpha, 'regular', 1);

    const pwrAct = dev.on ? 1 : 0;
    const pwrDrop = draw3DPolySlab(ctx, L.powerBtn, 'insp_power', pwrAct, alpha, inSlide, 0, false);
    mixColorInto(tmpCol, theme.textPrimary, theme.textInverse, pwrAct);
    fontAtlas.drawText(
      renderer,
      dev.on ? '已开启 · 点击关闭' : '已关闭 · 点击开启',
      L.powerCenter[0] + inSlide,
      L.powerCenter[1] + pwrDrop,
      17,
      'center',
      tmpCol,
      alpha,
      'regular',
      1.2
    );
    if (collectHits) {
      ctx.hitRegions.push({
        id: 'insp_power',
        poly: L.powerBtn,
        zIndex: 15,
        kind: 'button',
        onTap: (cx, cy) => store.toggleDevice(dev.id, { x: cx, y: cy })
      });
    }

    // 右斜切大面板：数据驱动的宽大触屏滑块与预设按钮
    draw3DPolySlab(ctx, L.rightPanel, 'insp_right', 0, alpha, inSlide * 1.25, 0, false);
    const rr = L.rightRect;
    const trackX = rr.x + 44;
    const trackW = rr.w - 88;
    const sliders = spec.sliders;
    const baseSliderY = sliders.length === 2 ? rr.y + 135 : rr.y + 225;

    for (let i = 0; i < sliders.length; i++) {
      const sp = sliders[i];
      const sy = baseSliderY + i * 165;
      const val = dev[sp.prop];
      const norm = Math.max(0, Math.min(1, (val - sp.min) / (sp.max - sp.min)));
      const valueText = `${sp.step < 1 ? val.toFixed(1) : Math.round(val)}${sp.unit}`;

      drawTouchSlider(ctx, {
        id: sp.id,
        label: sp.label,
        valueText,
        norm,
        x: trackX,
        y: sy,
        w: trackW,
        alpha,
        slideOffsetX: inSlide * 1.25,
        collectHits,
        onDrag: (sx) => {
          const ratio = Math.max(0, Math.min(1, (sx - trackX) / trackW));
          const stepped = Math.round((sp.min + ratio * (sp.max - sp.min)) / sp.step) * sp.step;
          store.setDeviceProperty(dev.id, sp.prop, Number(stepped.toFixed(1)), false);
        },
        onRelease: () => store.save()
      });
    }

    const presets = spec.presets;
    for (let i = 0; i < presets.length; i++) {
      const pr = presets[i];
      const box = L.presetPolys[i];
      const pid = `insp_preset_${i}`;
      const d = draw3DPolySlab(ctx, box.poly, pid, 0, alpha, inSlide * 1.25, 0, false);
      fontAtlas.drawText(renderer, pr.label, box.x + box.w * 0.5 + inSlide * 1.25, box.y + box.h * 0.5 + d, 15, 'center', theme.textPrimary, alpha, 'regular', 0.6);
      if (collectHits) {
        ctx.hitRegions.push({
          id: pid,
          poly: box.poly,
          zIndex: 16,
          kind: 'button',
          onTap: (cx, cy) => store.applyDevicePreset(dev.id, pr.patch, { x: cx, y: cy })
        });
      }
    }
  }
}
