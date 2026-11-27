/**
 * AETHER WebGL 2.0 · 应用装配入口与主渲染调度器
 * 职责：连接领域状态（HomeStore）、WebGL 批处理引擎（GLRenderer/FontAtlas）、
 * 触控系统（TouchInputManager）与多视图（Hub / Inspector / Automation），驱动全缓动与动态限帧
 */
import { STAGE_CONFIG, VIEW_CAM_SHIFTS } from './config/layout.config.js';
import { computeViewportMetrics, makeSlashRect } from './core/geometry.js';
import { HomeStore } from './core/store.js';
import { createThemeState, stepTheme } from './engine/theme.js';
import { FontAtlas } from './engine/font-atlas.js';
import { GLRenderer } from './engine/gl-renderer.js';
import { TouchInputManager } from './engine/input.js';
import { BackgroundLayer } from './ui/background-layer.js';
import { HubView } from './ui/views/hub-view.js';
import { InspectorView } from './ui/views/inspector-view.js';
import { AutomationView } from './ui/views/automation-view.js';

function bootstrap() {
  const canvas = document.getElementById('app-canvas');
  let renderer;
  try {
    renderer = new GLRenderer(canvas);
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#222;">WebGL 2.0 初始化失败：${err.message}</div>`;
    return;
  }

  const store = new HomeStore();
  const fontAtlas = new FontAtlas(renderer.gl);
  const theme = createThemeState(store.state.activeScene);
  const bgLayer = new BackgroundLayer();

  // 注册视图列表（统一遵循 rebuild / render 协议，易于后续扩展新二级菜单）
  const views = [new HubView(), new InspectorView(), new AutomationView()];

  // 动画插值状态
  const anim = {
    simTime: 0,
    breathPhase: 0,
    triAngle1: 0,
    triAngle3: 0,
    camX: 0,
    camY: 0,
    viewAlpha: { hub: 1, inspector: 0, automation: 0 },
    pressMap: new Map(),
    activeMap: new Map(),
    progressMap: new Map(),
    pulses: [],
    sweeps: [],
    toast: { text: '', alpha: 0, timer: 0 },
    highFpsUntil: 0
  };

  store.state.devices.forEach((d) => {
    anim.activeMap.set(`dev_${d.id}`, d.on ? 1 : 0);
    anim.progressMap.set(d.id, store.getDevicePercent(d));
  });
  store.getScenes().forEach((s) => {
    anim.activeMap.set(`scene_${s.id}`, s.id === store.state.activeScene ? 1 : 0);
  });

  let metrics = null;
  let currentHitRegions = [];

  const wakeHighFps = (ms = 850) => {
    anim.highFpsUntil = Math.max(anim.highFpsUntil, performance.now() + ms);
  };

  // 订阅领域层事件，驱动动效反馈
  store.on('change', () => wakeHighFps(700));
  store.on('sweep', () => {
    anim.sweeps.push({ p: 0 });
    wakeHighFps(950);
  });
  store.on('pulse', (pt) => {
    anim.pulses.push({
      x: pt && typeof pt.x === 'number' ? pt.x : metrics.vw * 0.5,
      y: pt && typeof pt.y === 'number' ? pt.y : metrics.vh * 0.5,
      r: 18,
      maxR: Math.max(metrics.vw, metrics.vh) * 0.34,
      alpha: 0.32,
      rot: 0
    });
    wakeHighFps(1000);
  });
  store.on('toast', (msg) => {
    anim.toast.text = msg;
    anim.toast.timer = 2.8;
    wakeHighFps(1200);
  });

  function rebuildAllLayouts() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : window.innerWidth);
    const vh = Math.round(vv ? vv.height : window.innerHeight);

    renderer.resize(vw, vh, STAGE_CONFIG.maxDpr);
    metrics = computeViewportMetrics(vw, vh);
    views.forEach((v) => v.rebuild(metrics, store));
    wakeHighFps(400);
  }

  rebuildAllLayouts();
  window.addEventListener('resize', rebuildAllLayouts);
  window.addEventListener('orientationchange', () => setTimeout(rebuildAllLayouts, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', rebuildAllLayouts);
  }

  const input = new TouchInputManager(
    canvas,
    () => ({ originX: metrics.innerOriginX, originY: metrics.innerOriginY, scale: metrics.scale }),
    () => currentHitRegions,
    () => wakeHighFps(700)
  );

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.state.currentView !== 'hub') {
      store.switchView('hub');
    }
  });

  window.addEventListener('offline', () => {
    store.notifyAbnormal('网络连接已断开，当前仅作本地状态记录');
  });

  /* ---- 动画插值步进 ---- */
  function stepAnimations(dt) {
    let busy = stepTheme(theme, store.state.activeScene, dt);

    anim.simTime += dt * theme.bgSpeed * 2.2;
    // 增量累积呼吸相位（避免场景切换改变 breathSpeed 时 sin(t * speed) 相位跳变导致闪烁）
    anim.breathPhase = (anim.breathPhase + dt * theme.breathSpeed) % (Math.PI * 200);
    anim.triAngle1 += dt * 0.22;
    anim.triAngle3 -= dt * 0.34;

    const [tx, ty] = VIEW_CAM_SHIFTS[store.state.currentView] || [0, 0];
    const camK = 1 - Math.exp(-dt * 5.0);
    anim.camX += (tx - anim.camX) * camK;
    anim.camY += (ty - anim.camY) * camK;

    const viewK = 1 - Math.exp(-dt * 7.2);
    for (let i = 0; i < views.length; i++) {
      const vid = views[i].id;
      const target = store.state.currentView === vid ? 1 : 0;
      const diff = target - anim.viewAlpha[vid];
      if (Math.abs(diff) > 0.002) {
        anim.viewAlpha[vid] += diff * viewK;
        busy = true;
      } else {
        anim.viewAlpha[vid] = target;
      }
    }

    const pressK = 1 - Math.exp(-dt * 18.0);
    const activePressId = input.pressedId;
    if (activePressId && !anim.pressMap.has(activePressId)) anim.pressMap.set(activePressId, 0);
    anim.pressMap.forEach((val, id) => {
      const target = id === activePressId ? 1 : 0;
      const diff = target - val;
      if (Math.abs(diff) > 0.004) {
        anim.pressMap.set(id, val + diff * pressK);
        busy = true;
      } else if (target === 0) {
        anim.pressMap.delete(id);
      } else {
        anim.pressMap.set(id, 1);
      }
    });

    const stateK = 1 - Math.exp(-dt * 7.5);
    const scenes = store.getScenes();
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const key = `scene_${s.id}`;
      const target = store.state.activeScene === s.id ? 1 : 0;
      const cur = anim.activeMap.get(key) || 0;
      if (Math.abs(target - cur) > 0.003) {
        anim.activeMap.set(key, cur + (target - cur) * stateK);
        busy = true;
      } else {
        anim.activeMap.set(key, target);
      }
    }

    for (let i = 0; i < store.state.devices.length; i++) {
      const d = store.state.devices[i];
      const key = `dev_${d.id}`;
      const targetAct = d.on ? 1 : 0;
      const curAct = anim.activeMap.get(key) || 0;
      if (Math.abs(targetAct - curAct) > 0.003) {
        anim.activeMap.set(key, curAct + (targetAct - curAct) * stateK);
        busy = true;
      } else {
        anim.activeMap.set(key, targetAct);
      }

      const targetProg = store.getDevicePercent(d);
      const curProg = anim.progressMap.get(d.id) || 0;
      if (Math.abs(targetProg - curProg) > 0.003) {
        anim.progressMap.set(d.id, curProg + (targetProg - curProg) * stateK);
        busy = true;
      } else {
        anim.progressMap.set(d.id, targetProg);
      }
    }

    for (let i = anim.pulses.length - 1; i >= 0; i--) {
      const p = anim.pulses[i];
      p.r += (p.maxR - p.r) * Math.min(1, dt * 4.2);
      p.alpha *= Math.pow(0.05, dt);
      p.rot += dt * 0.25;
      if (p.alpha < 0.006) anim.pulses.splice(i, 1);
      else busy = true;
    }

    for (let i = anim.sweeps.length - 1; i >= 0; i--) {
      anim.sweeps[i].p += dt * 2.1;
      if (anim.sweeps[i].p >= 1) anim.sweeps.splice(i, 1);
      else busy = true;
    }

    if (anim.toast.timer > 0) {
      anim.toast.timer -= dt;
      anim.toast.alpha += (1 - anim.toast.alpha) * Math.min(1, dt * 10);
      busy = true;
    } else if (anim.toast.alpha > 0.005) {
      anim.toast.alpha += (0 - anim.toast.alpha) * Math.min(1, dt * 8);
      busy = true;
    } else {
      anim.toast.alpha = 0;
    }

    return busy;
  }

  /* ---- 辅助叠层：异常提示与左上角调试信息 ---- */
  const perf = { frames: 0, lastSample: performance.now(), fps: 60 };

  function renderOverlays(now) {
    renderer.setTransform(0, 0, 1);

    if (anim.toast.alpha > 0.01 && anim.toast.text) {
      const tw = fontAtlas.measureText(anim.toast.text, 14, 'regular', 0.8) + 56;
      const th = 42;
      const tx = (metrics.vw - tw) * 0.5;
      const ty = metrics.vh - 68 + (1 - anim.toast.alpha) * 14;
      renderer.fillPolySolid(makeSlashRect(tx, ty, tw, th, 12), theme.toastBg, anim.toast.alpha);
      fontAtlas.drawText(renderer, anim.toast.text, metrics.vw * 0.5, ty + th * 0.5, 14, 'center', theme.toastText, anim.toast.alpha, 'regular', 0.8);
    }

    perf.frames++;
    if (now - perf.lastSample >= 400) {
      perf.fps = Math.round((perf.frames * 1000) / (now - perf.lastSample));
      perf.frames = 0;
      perf.lastSample = now;
    }
    const dc = renderer.drawCallsLastFrame || 2;
    fontAtlas.drawText(renderer, `FPS ${perf.fps} · DC ${dc}`, 16, 18, 12, 'left', theme.textSecondary, 0.72, 'regular', 0.6);
  }

  /* ---- 主循环（动态限帧 + 后台暂停） ---- */
  let lastTs = performance.now();
  let lastRenderTs = 0;
  let rafId = null;

  const renderCtx = { renderer, fontAtlas, theme, store, anim, metrics: null, hitRegions: [] };

  function frame(now) {
    rafId = requestAnimationFrame(frame);

    const isBurst = now < anim.highFpsUntil || anim.pulses.length > 0 || anim.sweeps.length > 0;
    if (now - lastRenderTs < (isBurst ? 14 : 50)) return;
    lastRenderTs = now;

    const dt = Math.min((now - lastTs) / 1000, 0.06);
    lastTs = now;

    if (stepAnimations(dt)) wakeHighFps(200);

    renderer.beginFrame(theme.bgA);
    renderCtx.metrics = metrics;
    renderCtx.hitRegions = [];

    bgLayer.render(renderCtx);

    renderer.setTransform(metrics.innerOriginX, metrics.innerOriginY, metrics.scale);
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const a = anim.viewAlpha[v.id];
      if (a > 0.003) {
        v.render(renderCtx, a, store.state.currentView === v.id);
      }
    }
    currentHitRegions = renderCtx.hitRegions;

    renderOverlays(now);
    renderer.flush(fontAtlas);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (!rafId) {
      lastTs = performance.now();
      lastRenderTs = 0;
      rafId = requestAnimationFrame(frame);
    }
  });

  rafId = requestAnimationFrame(frame);
}

bootstrap();
