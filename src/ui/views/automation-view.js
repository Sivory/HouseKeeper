/**
 * AETHER · 二级视图 B：安防警戒与睡眠定时视图
 */
import { mixColorInto } from '../../engine/theme.js';
import { compileAutomationLayout } from '../../core/geometry.js';
import { draw3DPolySlab } from '../primitives.js';

const tmpCol = [0, 0, 0, 1];

export class AutomationView {
  constructor() {
    this.id = 'automation';
    this.layout = null;
  }

  rebuild(metrics) {
    this.layout = compileAutomationLayout(metrics.innerW, metrics.innerH);
  }

  render(ctx, alpha, collectHits) {
    const { renderer, fontAtlas, theme, store, metrics } = ctx;
    const L = this.layout;
    if (!L) return;

    const inSlide = (1 - alpha) * 68;

    // 顶部返回与标题（使用强调色保证明暗模式下均有高对比度）
    const backPress = ctx.anim.pressMap.get('auto_back') || 0;
    const backDrop = backPress * 5;
    renderer.fillPolySolid(L.backPoly, theme.extrudeActive, alpha, inSlide * 0.5, 8 - backPress * 5);
    renderer.fillPolySolid(L.backPoly, theme.accentSolid, alpha, inSlide * 0.5, backDrop);
    fontAtlas.drawText(renderer, '◁  返回', L.backCenter[0] + inSlide * 0.5, L.backCenter[1] + backDrop, 16, 'center', theme.toastText, alpha, 'regular', 1.2);
    fontAtlas.drawText(renderer, '安防与定时联动', metrics.innerW + inSlide * 0.5, 28, 17, 'right', theme.textSecondary, alpha, 'light', 2);
    if (collectHits) {
      ctx.hitRegions.push({
        id: 'auto_back',
        poly: L.backPoly,
        zIndex: 15,
        kind: 'button',
        onTap: (cx, cy) => store.switchView('hub', { x: cx, y: cy })
      });
    }

    // 左侧：全屋安防警戒
    draw3DPolySlab(ctx, L.secPanel, 'auto_sec_panel', 0, alpha, inSlide, 0, true);
    const sr = L.secRect;
    const armed = store.state.securityArmed;
    fontAtlas.drawText(renderer, '全屋安防', sr.x + 42 + inSlide, sr.y + 48, 13, 'left', theme.textSecondary, alpha, 'regular', 1.8);
    fontAtlas.drawText(renderer, armed ? '警戒布防中' : '居家态', sr.x + 42 + inSlide, sr.y + sr.h * 0.44, 50, 'left', theme.textPrimary, alpha, 'light', 2);
    fontAtlas.drawText(
      renderer,
      armed ? '全屋门窗与红外传感已锁定警戒' : '门窗传感待命，点击下方切换离家警戒',
      sr.x + 42 + inSlide,
      sr.y + sr.h * 0.44 + 54,
      14,
      'left',
      theme.textSecondary,
      alpha,
      'regular',
      0.4
    );

    const secAct = armed ? 1 : 0;
    const secDrop = draw3DPolySlab(ctx, L.secBtn, 'auto_sec_btn', secAct, alpha, inSlide, 0, false);
    mixColorInto(tmpCol, theme.textPrimary, theme.textInverse, secAct);
    fontAtlas.drawText(
      renderer,
      armed ? '解除离家警戒' : '开启离家警戒',
      L.secBtnCenter[0] + inSlide,
      L.secBtnCenter[1] + secDrop,
      17,
      'center',
      tmpCol,
      alpha,
      'regular',
      1.2
    );
    if (collectHits) {
      ctx.hitRegions.push({
        id: 'auto_sec_btn',
        poly: L.secBtn,
        zIndex: 15,
        kind: 'button',
        onTap: (cx, cy) => store.toggleSecurity({ x: cx, y: cy })
      });
    }

    // 右上：睡眠倒计时熄灯
    draw3DPolySlab(ctx, L.timerPanel, 'auto_timer_panel', 0, alpha, inSlide * 1.2, 0, false);
    const tr = L.timerRect;
    fontAtlas.drawText(renderer, '睡眠倒计时熄灯', tr.x + 44 + inSlide * 1.2, tr.y + 48, 13, 'left', theme.textSecondary, alpha, 'regular', 1.8);

    let timerText = '未设定';
    if (store.state.sleepRemainingSec > 0) {
      const mm = String(Math.floor(store.state.sleepRemainingSec / 60)).padStart(2, '0');
      const ss = String(store.state.sleepRemainingSec % 60).padStart(2, '0');
      timerText = `${mm}:${ss}`;
    }
    fontAtlas.drawText(renderer, timerText, tr.x + tr.w - 44 + inSlide * 1.2, tr.y + 50, 28, 'right', theme.textPrimary, alpha, 'light', 1);

    for (let i = 0; i < L.timerBtns.length; i++) {
      const tb = L.timerBtns[i];
      const act = store.state.sleepMinutesSelected > 0 && store.state.sleepMinutesSelected === tb.minutes ? 1 : 0;
      const d = draw3DPolySlab(ctx, tb.poly, tb.id, act, alpha, inSlide * 1.2, 0, false);
      mixColorInto(tmpCol, theme.textPrimary, theme.textInverse, act);
      fontAtlas.drawText(renderer, tb.label, tb.x + tb.w * 0.5 + inSlide * 1.2, tb.y + tb.h * 0.5 + d, 16, 'center', tmpCol, alpha, 'regular', 0.6);
      if (collectHits) {
        ctx.hitRegions.push({
          id: tb.id,
          poly: tb.poly,
          zIndex: 16,
          kind: 'button',
          onTap: (cx, cy) => store.setSleepTimer(tb.minutes, { x: cx, y: cy })
        });
      }
    }

    // 右下：全屋一键同步宏
    draw3DPolySlab(ctx, L.macroPanel, 'auto_macro_panel', 0, alpha, inSlide * 1.35, 0, false);
    const mr = L.macroRect;
    fontAtlas.drawText(renderer, '全屋一键同步', mr.x + 44 + inSlide * 1.35, mr.y + 48, 13, 'left', theme.textSecondary, alpha, 'regular', 1.8);

    const curtainDev = store.getDevice('curtain');
    const curtainOpen = curtainDev && curtainDev.on && curtainDev.value > 0;

    for (let i = 0; i < L.macroBtns.length; i++) {
      const mb = L.macroBtns[i];
      const label = mb.action === 'toggleCurtains'
        ? (curtainOpen ? mb.labelOpen : mb.labelClosed)
        : mb.label;
      const d = draw3DPolySlab(ctx, mb.poly, mb.id, 0, alpha, inSlide * 1.35, 0, false);
      fontAtlas.drawText(renderer, label, mb.x + mb.w * 0.5 + inSlide * 1.35, mb.y + mb.h * 0.5 + d, 16, 'center', theme.textPrimary, alpha, 'regular', 0.6);
      if (collectHits) {
        ctx.hitRegions.push({
          id: mb.id,
          poly: mb.poly,
          zIndex: 16,
          kind: 'button',
          onTap: (cx, cy) => store.runMacro(mb.action, { x: cx, y: cy })
        });
      }
    }
  }
}
