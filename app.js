/**
 * AETHER · 极简七巧板斜线拼合触屏中控核心逻辑
 * 设计约束：
 * 1. 非滚动 1600x900 跨分辨率等比缩放
 * 2. 纯触屏按压 3D 沉降反馈（彻底无鼠标跟随效果）
 * 3. 七巧板大斜线精确几何坐标拼合，大小对比鲜明
 * 4. 仅在巨型中枢块保留唯一的同心三角旋转呼吸核心
 * 5. 二级菜单（精细调参 / 安防定时）带全缓动转场
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'aether_tangram_v3';
  /** 以 iPad 横屏为参考基准（高 960px，四周 56px 呼吸留白，缝隙 22px，兼顾 iPad Mini 与 iPad Pro） */
  const BASE_H = 960;
  const MIN_RATIO = 1.28;
  const MAX_RATIO = 1.66;
  const STAGE_PAD = 56;
  const TANGRAM_GAP = 22;
  const SLASH_SLOPE = -0.18;

  let currentStageW = 1280;
  let currentStageH = BASE_H;

  /** 4 个核心空间场景 */
  const SCENES = [
    {
      id: 'bright',
      name: '明亮',
      en: 'DAYLIGHT',
      preset: {
        living_light: { on: true, value: 92, temp: 5200 },
        bedroom_light: { on: true, value: 85, temp: 5000 },
        ambient_strip: { on: true, value: 45, temp: 4800 },
        curtain: { on: true, value: 100 },
        climate: { on: true, value: 23.5 }
      }
    },
    {
      id: 'warm',
      name: '温馨',
      en: 'WARM',
      preset: {
        living_light: { on: true, value: 58, temp: 2900 },
        bedroom_light: { on: true, value: 42, temp: 2700 },
        ambient_strip: { on: true, value: 76, temp: 2700 },
        curtain: { on: true, value: 25 },
        climate: { on: true, value: 24.5 }
      }
    },
    {
      id: 'cool',
      name: '酷炫',
      en: 'COOL',
      preset: {
        living_light: { on: true, value: 40, temp: 6200 },
        bedroom_light: { on: false, value: 20, temp: 5600 },
        ambient_strip: { on: true, value: 100, temp: 6500 },
        curtain: { on: true, value: 35 },
        climate: { on: true, value: 22.0 }
      }
    },
    {
      id: 'night',
      name: '熄灯',
      en: 'LIGHTS OUT',
      preset: {
        living_light: { on: false, value: 0, temp: 2700 },
        bedroom_light: { on: false, value: 0, temp: 2700 },
        ambient_strip: { on: false, value: 0, temp: 2700 },
        curtain: { on: false, value: 0 },
        climate: { on: true, value: 25.5 }
      }
    }
  ];

  /** 5 组核心电器（少而精，突出大小主次） */
  const DEFAULT_DEVICES = [
    { id: 'living_light', name: '客厅主灯', zone: '客厅', kind: 'light', on: true, value: 92, temp: 5200, wattMax: 44 },
    { id: 'bedroom_light', name: '卧室灯', zone: '卧室', kind: 'light', on: true, value: 85, temp: 5000, wattMax: 32 },
    { id: 'ambient_strip', name: '氛围灯带', zone: '客厅', kind: 'light', on: true, value: 45, temp: 4800, wattMax: 24 },
    { id: 'curtain', name: '全屋窗帘', zone: '遮阳', kind: 'curtain', on: true, value: 100, wattMax: 14 },
    { id: 'climate', name: '中央空调', zone: '环境', kind: 'climate', on: true, value: 23.5, wattMax: 680 }
  ];

  /**
   * 参数化七巧板几何生成器（根据实时弹性舞台尺寸 W x H 计算精确顶点）
   * 所有相邻斜边共享同一斜率 SLASH_SLOPE，缝隙严格等于 TANGRAM_GAP，在任意 iPad 尺寸与顶栏偏差下布局结构完全一致
   */
  function computeTangramPieces(W, H) {
    const g = TANGRAM_GAP;
    const hg = g * 0.5;
    const s = SLASH_SLOPE;

    // 求解斜线 x = x0 + s * y 与微倾横线 y = y0 + k * x 的交点
    const hit = (x0, y0, k = 0) => {
      const x = (x0 + s * y0) / (1 - s * k);
      const y = y0 + k * x;
      return [x, y];
    };

    // 主分割斜线 x0 锚点（宽裕比例，确保任何板块都不狭小拥挤）
    const xA = W * 0.445;       // 左区（中枢+场景）与右区（电器）分界
    const xSceneMid = W * 0.235; // 场景左右分割斜线
    const xC = W * 0.745;       // 中央主灯/卧室灯 与 最右侧窗帘/空调/氛围灯带分界

    // 横向微倾线锚点
    const kL = -0.055;          // 左区微向上倾
    const yHeroBot = H * 0.575;
    const ySceneMid = H * 0.790;

    const kR = 0.055;           // 中央主灯底边微向下倾，打破十字交叉
    const yMainBot = H * 0.515;
    const yCurtainBot = H * 0.305;
    const yClimateBot = H * 0.610;
    const yBotStrip = H * 0.835;

    // 底部三条二级菜单斜线分割锚点
    const xNav1 = W * 0.635;
    const xNav2 = W * 0.825;

    return [
      // 1. 巨型中枢块（左上最大焦点，承载唯一同心三角转动核心）
      {
        id: 'hero',
        role: 'hero',
        points: [
          [0, 0],
          [xA - hg, 0],
          hit(xA - hg, yHeroBot - hg, kL),
          [0, yHeroBot - hg]
        ],
        out: [-34, -24]
      },
      // 2~5. 左下 4 块场景七巧板
      {
        id: 'scene_bright',
        role: 'scene',
        sceneId: 'bright',
        points: [
          [0, yHeroBot + hg],
          hit(xSceneMid - hg, yHeroBot + hg, kL),
          hit(xSceneMid - hg, ySceneMid - hg, kL),
          [0, ySceneMid - hg]
        ],
        out: [-36, 12]
      },
      {
        id: 'scene_warm',
        role: 'scene',
        sceneId: 'warm',
        points: [
          hit(xSceneMid + hg, yHeroBot + hg, kL),
          hit(xA - hg, yHeroBot + hg, kL),
          hit(xA - hg, ySceneMid - hg, kL),
          hit(xSceneMid + hg, ySceneMid - hg, kL)
        ],
        out: [-22, 18]
      },
      {
        id: 'scene_cool',
        role: 'scene',
        sceneId: 'cool',
        compact: true,
        points: [
          [0, ySceneMid + hg],
          hit(xSceneMid - hg, ySceneMid + hg, kL),
          [xSceneMid - hg + s * H, H],
          [0, H]
        ],
        out: [-40, 30]
      },
      {
        id: 'scene_night',
        role: 'scene',
        sceneId: 'night',
        compact: true,
        points: [
          hit(xSceneMid + hg, ySceneMid + hg, kL),
          hit(xA - hg, ySceneMid + hg, kL),
          [xA - hg + s * H, H],
          [xSceneMid + hg + s * H, H]
        ],
        out: [-26, 34]
      },
      // 6. 客厅主灯（中央超大核心主块）
      {
        id: 'dev_living_light',
        role: 'device',
        deviceId: 'living_light',
        size: 'large',
        points: [
          [xA + hg, 0],
          [xC - hg, 0],
          hit(xC - hg, yMainBot - hg, kR),
          hit(xA + hg, yMainBot - hg, kR)
        ],
        out: [14, -34]
      },
      // 7. 卧室灯（中央下方宽幅斜切块）
      {
        id: 'dev_bedroom_light',
        role: 'device',
        deviceId: 'bedroom_light',
        size: 'medium',
        points: [
          hit(xA + hg, yMainBot + hg, kR),
          hit(xC - hg, yMainBot + hg, kR),
          [xC - hg + s * (yBotStrip - hg), yBotStrip - hg],
          [xA + hg + s * (yBotStrip - hg), yBotStrip - hg]
        ],
        out: [-10, 14]
      },
      // 8. 全屋窗帘（右上修长大气块）
      {
        id: 'dev_curtain',
        role: 'device',
        deviceId: 'curtain',
        size: 'medium',
        points: [
          [xC + hg, 0],
          [W, 0],
          [W, yCurtainBot - hg],
          [xC + hg + s * (yCurtainBot - hg), yCurtainBot - hg]
        ],
        out: [40, -24]
      },
      // 9. 中央空调（右中主控块）
      {
        id: 'dev_climate',
        role: 'device',
        deviceId: 'climate',
        size: 'medium',
        points: [
          [xC + hg + s * (yCurtainBot + hg), yCurtainBot + hg],
          [W, yCurtainBot + hg],
          [W, yClimateBot - hg],
          [xC + hg + s * (yClimateBot - hg), yClimateBot - hg]
        ],
        out: [42, 0]
      },
      // 10. 氛围灯带（右下宽幅斜切块）
      {
        id: 'dev_ambient_strip',
        role: 'device',
        deviceId: 'ambient_strip',
        size: 'tall',
        points: [
          [xC + hg + s * (yClimateBot + hg), yClimateBot + hg],
          [W, yClimateBot + hg],
          [W, yBotStrip - hg],
          [xC + hg + s * (yBotStrip - hg), yBotStrip - hg]
        ],
        out: [36, 18]
      },
      // 11~13. 底部二级菜单与休眠斜切条
      {
        id: 'nav_inspector',
        role: 'nav',
        targetView: 'inspector',
        title: '精细调参',
        sub: '亮度 · 色温',
        points: [
          [xA + hg + s * (yBotStrip + hg), yBotStrip + hg],
          [xNav1 - hg + s * (yBotStrip + hg), yBotStrip + hg],
          [xNav1 - hg + s * H, H],
          [xA + hg + s * H, H]
        ],
        out: [-6, 36]
      },
      {
        id: 'nav_automation',
        role: 'nav',
        targetView: 'automation',
        title: '安防与定时',
        sub: '警戒 · 熄灯',
        points: [
          [xNav1 + hg + s * (yBotStrip + hg), yBotStrip + hg],
          [xNav2 - hg + s * (yBotStrip + hg), yBotStrip + hg],
          [xNav2 - hg + s * H, H],
          [xNav1 + hg + s * H, H]
        ],
        out: [18, 36]
      },
      {
        id: 'nav_sleep',
        role: 'sleep',
        title: '全屋休眠',
        sub: '一键熄灯',
        points: [
          [xNav2 + hg + s * (yBotStrip + hg), yBotStrip + hg],
          [W, yBotStrip + hg],
          [W, H],
          [xNav2 + hg + s * H, H]
        ],
        out: [40, 36]
      }
    ];
  }

  const state = {
    currentView: 'hub',
    activeScene: 'bright',
    selectedDeviceId: 'living_light',
    securityArmed: false,
    sleepTimerRemaining: 0,
    devices: JSON.parse(JSON.stringify(DEFAULT_DEVICES))
  };

  /* ========================================================================
     1. iPad 横屏弹性等比缩放（自动兼容 Safari 地址栏、PWA 全屏与不同分辨率）
     ======================================================================== */
  let hasInitialized = false;
  function fitStage() {
    const stage = document.getElementById('touch-stage');
    const lock = document.querySelector('.viewport-lock');
    if (!stage || !lock) return;

    // 优先读取 visualViewport 与容器可用区，精确扣除 iPad Safari 顶部栏与安全区
    const rect = lock.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = Math.min(rect.width || window.innerWidth, vv ? vv.width : window.innerWidth);
    const vh = Math.min(rect.height || window.innerHeight, vv ? vv.height : window.innerHeight);

    const vpRatio = vw / Math.max(vh, 1);
    const clampedRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, vpRatio));
    const nextW = Math.round(BASE_H * clampedRatio);
    const nextH = BASE_H;

    const sizeChanged = Math.abs(nextW - currentStageW) > 2;
    currentStageW = nextW;
    currentStageH = nextH;

    stage.style.width = `${nextW}px`;
    stage.style.height = `${nextH}px`;

    // 使用绝对居中 + translate(-50%, -50%) scale(s)，彻底修复小分辨率（如 iPad Mini）下 grid 溢出偏移
    const scale = Math.min(vw / nextW, vh / nextH);
    stage.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(5)})`;

    if (hasInitialized && sizeChanged) {
      renderTangramHub();
    }
  }
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', () => setTimeout(fitStage, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitStage);
  }

  /* ========================================================================
     2. 持久化存储
     ======================================================================== */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.activeScene && SCENES.some((s) => s.id === saved.activeScene)) state.activeScene = saved.activeScene;
      if (typeof saved.securityArmed === 'boolean') state.securityArmed = saved.securityArmed;
      if (Array.isArray(saved.devices)) {
        state.devices.forEach((d) => {
          const hit = saved.devices.find((x) => x.id === d.id);
          if (hit) {
            d.on = Boolean(hit.on);
            if (typeof hit.value === 'number') d.value = hit.value;
            if (typeof hit.temp === 'number') d.temp = hit.temp;
          }
        });
      }
    } catch (_) {
      // 忽略异常
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeScene: state.activeScene,
        securityArmed: state.securityArmed,
        devices: state.devices.map(({ id, on, value, temp }) => ({ id, on, value, temp }))
      }));
    } catch (_) {
      // 忽略限制
    }
  }

  /* ========================================================================
     3. 七巧板多边形几何计算工具
     ======================================================================== */
  function buildPolygonGeometry(points) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const height = Math.max(...ys) - minY;

    const clipParts = points.map(([x, y]) => {
      const px = (((x - minX) / width) * 100).toFixed(2);
      const py = (((y - minY) / height) * 100).toFixed(2);
      return `${px}% ${py}%`;
    });

    const svgPoints = points.map(([x, y]) => `${(x - minX).toFixed(1)},${(y - minY).toFixed(1)}`).join(' ');

    return {
      minX,
      minY,
      width,
      height,
      clip: `polygon(${clipParts.join(', ')})`,
      svgPoints
    };
  }

  /** 为七巧板块绑定纯触屏按压沉降反馈（无任何鼠标跟随效果） */
  function bindTouchPress(pieceEl) {
    pieceEl.addEventListener('pointerdown', () => pieceEl.classList.add('is-pressed'));
    const clear = () => pieceEl.classList.remove('is-pressed');
    pieceEl.addEventListener('pointerup', clear);
    pieceEl.addEventListener('pointercancel', clear);
    pieceEl.addEventListener('pointerleave', clear);
  }

  /* ========================================================================
     4. 遥测计算与轻提示
     ======================================================================== */
  function calcWatt(dev) {
    if (!dev.on) return 0;
    if (dev.kind === 'climate') return Math.round(140 + Math.abs(26 - dev.value) * 68);
    if (dev.kind === 'curtain') return 2;
    return Math.max(2, Math.round((dev.value / 100) * dev.wattMax));
  }

  function getTotalWatt() {
    return state.devices.reduce((s, d) => s + calcWatt(d), 12);
  }

  function formatDeviceMetric(dev) {
    if (!dev.on) return dev.kind === 'curtain' ? '已闭合' : '已关闭';
    if (dev.kind === 'light') return `${Math.round(dev.value)}%`;
    if (dev.kind === 'curtain') return `${Math.round(dev.value)}%`;
    if (dev.kind === 'climate') return `${dev.value.toFixed(1)}°C`;
    return '运行中';
  }

  function getDevicePercent(dev) {
    if (!dev.on) return 0;
    if (dev.kind === 'climate') return Math.round(((dev.value - 16) / 14) * 100);
    return Math.max(0, Math.min(100, Math.round(dev.value)));
  }

  /**
   * 异常/告警底部轻提示（常规正常操作不弹出，仅在断网、指令异常等非正常情况下调用）
   */
  function showToast(msg) {
    const box = document.getElementById('toast-container');
    if (!box) return;
    // 同一时刻仅保留一条告警提示，避免堆叠
    box.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 420);
    }, 2800);
  }

  /* ========================================================================
     5. 渲染一级七巧板总览
     ======================================================================== */
  function renderTangramHub() {
    const canvas = document.getElementById('tangram-canvas');
    if (!canvas) return;
    canvas.innerHTML = '';

    const activeSceneObj = SCENES.find((s) => s.id === state.activeScene) || SCENES[0];
    document.body.setAttribute('data-scene', activeSceneObj.id);
    if (window.AetherBG) window.AetherBG.setScene(activeSceneObj.id);

    const ac = state.devices.find((d) => d.id === 'climate');
    const roomTemp = ac && ac.on ? ac.value.toFixed(1) : '26.0';
    const now = new Date();
    const clockStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const innerW = currentStageW - STAGE_PAD * 2;
    const innerH = currentStageH - STAGE_PAD * 2;
    const pieces = computeTangramPieces(innerW, innerH);

    pieces.forEach((piece, idx) => {
      const geo = buildPolygonGeometry(piece.points);
      const wrap = document.createElement('div');
      wrap.className = 'tan-piece';
      wrap.style.left = `${geo.minX}px`;
      wrap.style.top = `${geo.minY}px`;
      wrap.style.width = `${geo.width}px`;
      wrap.style.height = `${geo.height}px`;
      wrap.style.setProperty('--poly', geo.clip);
      wrap.style.setProperty('--out-x', `${piece.out[0]}px`);
      wrap.style.setProperty('--out-y', `${piece.out[1]}px`);
      wrap.style.transitionDelay = `${(idx * 18)}ms`;

      let isActive = false;
      let innerHtml = '';

      if (piece.role === 'hero') {
        wrap.classList.add('is-hero');
        innerHtml = `
          <div class="tan-inner hero-inner">
            <div class="hero-top-bar">
              <span class="hero-clock" id="hero-clock">${clockStr}</span>
              <span class="hero-climate">${roomTemp}°C · ${state.securityArmed ? '警戒中' : '居家'}</span>
            </div>
            <div class="hero-center-stage">
              <div class="core-tri-wrap" aria-hidden="true">
                <svg viewBox="0 0 210 210" class="core-tri-svg">
                  <polygon points="105,12 194,166 16,166" class="core-ring r1" />
                  <polygon points="105,36 172,152 38,152" class="core-ring r2" />
                  <polygon points="105,64 146,136 64,136" class="core-ring r3" />
                  <circle cx="105" cy="112" r="5" class="core-dot" />
                </svg>
              </div>
              <div class="hero-scene-meta">
                <span class="hero-kicker">${activeSceneObj.en}</span>
                <div class="hero-scene-name">${activeSceneObj.name}</div>
                <span class="hero-watt-line">实时功耗 ${getTotalWatt()} W</span>
              </div>
            </div>
          </div>
        `;
      } else if (piece.role === 'scene') {
        const sc = SCENES.find((s) => s.id === piece.sceneId);
        isActive = state.activeScene === sc.id;
        innerHtml = `
          <button class="tan-inner scene-inner${piece.compact ? ' is-compact' : ''}" type="button" aria-pressed="${isActive}">
            <span class="scene-state-line">${sc.en}</span>
            <span class="scene-label">${sc.name}</span>
          </button>
        `;
      } else if (piece.role === 'device') {
        const dev = state.devices.find((d) => d.id === piece.deviceId);
        isActive = dev.on;
        innerHtml = `
          <div class="tan-inner dev-inner is-${piece.size}" role="button" tabindex="0" aria-pressed="${dev.on}">
            <div class="dev-top-row">
              <span class="dev-zone">${dev.zone}</span>
              <button class="dev-tune-link" type="button">精调 ▸</button>
            </div>
            <div>
              <div class="dev-title">${dev.name}</div>
              <div class="dev-metric">${formatDeviceMetric(dev)}</div>
              <div class="dev-progress-line">
                <div class="dev-progress-fill" style="width: ${getDevicePercent(dev)}%"></div>
              </div>
            </div>
          </div>
        `;
      } else if (piece.role === 'nav' || piece.role === 'sleep') {
        innerHtml = `
          <button class="tan-inner nav-inner" type="button">
            <div>
              <div class="nav-title">${piece.title}</div>
              <div class="nav-sub">${piece.sub}</div>
            </div>
            <span class="nav-sub">▸</span>
          </button>
        `;
      }

      if (isActive) wrap.classList.add('is-active');

      wrap.innerHTML = `
        <div class="tan-extrude" aria-hidden="true"></div>
        <div class="tan-surface">
          <div class="tan-breath" aria-hidden="true"></div>
          <svg class="tan-svg" viewBox="0 0 ${geo.width} ${geo.height}" aria-hidden="true">
            <polygon points="${geo.svgPoints}" />
          </svg>
          ${innerHtml}
        </div>
      `;

      // 绑定触屏按压与点击动作
      if (piece.role !== 'hero') {
        bindTouchPress(wrap);
      }

      if (piece.role === 'scene') {
        wrap.querySelector('.scene-inner').addEventListener('click', (e) => {
          applyScene(piece.sceneId, e.clientX, e.clientY);
        });
      } else if (piece.role === 'device') {
        wrap.querySelector('.dev-tune-link').addEventListener('click', (e) => {
          e.stopPropagation();
          state.selectedDeviceId = piece.deviceId;
          switchView('inspector', e.clientX, e.clientY);
        });
        wrap.querySelector('.dev-inner').addEventListener('click', (e) => {
          state.selectedDeviceId = piece.deviceId;
          toggleDevice(piece.deviceId, e.clientX, e.clientY);
        });
      } else if (piece.role === 'nav') {
        wrap.querySelector('.nav-inner').addEventListener('click', (e) => {
          switchView(piece.targetView, e.clientX, e.clientY);
        });
      } else if (piece.role === 'sleep') {
        wrap.querySelector('.nav-inner').addEventListener('click', (e) => {
          applyScene('night', e.clientX, e.clientY);
        });
      }

      canvas.appendChild(wrap);
    });
  }

  /* ========================================================================
     6. 一级 <-> 二级菜单全缓动转场
     ======================================================================== */
  const CAM_SHIFTS = {
    hub: [0, 0],
    inspector: [0.16, -0.04],
    automation: [-0.14, 0.05]
  };

  function switchView(target, cx, cy) {
    state.currentView = target;
    document.body.setAttribute('data-view', target);

    document.querySelectorAll('.stage-view').forEach((v) => {
      const isTarget = v.id === `view-${target}`;
      v.classList.toggle('is-current', isTarget);
      v.setAttribute('aria-hidden', String(!isTarget));
    });

    if (window.AetherBG) {
      const [sx, sy] = CAM_SHIFTS[target] || [0, 0];
      window.AetherBG.setCameraShift(sx, sy);
      window.AetherBG.triggerSweep();
      if (typeof cx === 'number') window.AetherBG.triggerPulse(cx, cy);
    }

    if (target === 'inspector') renderInspector();
    if (target === 'automation') syncAutomationUI();
  }

  /* ========================================================================
     7. 二级菜单 A：触屏精细调参
     ======================================================================== */
  function getPresets(dev) {
    if (dev.kind === 'light') {
      return [
        { label: '25% 柔光', apply: (d) => { d.on = true; d.value = 25; d.temp = 2800; } },
        { label: '60% 舒适', apply: (d) => { d.on = true; d.value = 60; d.temp = 3800; } },
        { label: '100% 明亮', apply: (d) => { d.on = true; d.value = 100; d.temp = 5400; } },
        { label: '关闭', apply: (d) => { d.on = false; d.value = 0; } }
      ];
    }
    if (dev.kind === 'curtain') {
      return [
        { label: '全闭 0%', apply: (d) => { d.on = false; d.value = 0; } },
        { label: '微启 35%', apply: (d) => { d.on = true; d.value = 35; } },
        { label: '半开 70%', apply: (d) => { d.on = true; d.value = 70; } },
        { label: '全开 100%', apply: (d) => { d.on = true; d.value = 100; } }
      ];
    }
    return [
      { label: '20.5° 强冷', apply: (d) => { d.on = true; d.value = 20.5; } },
      { label: '23.5° 舒适', apply: (d) => { d.on = true; d.value = 23.5; } },
      { label: '25.5° 睡眠', apply: (d) => { d.on = true; d.value = 25.5; } },
      { label: '待机关闭', apply: (d) => { d.on = false; } }
    ];
  }

  function updateInspectorReadout(dev) {
    const big = document.getElementById('insp-big-value');
    const sub = document.getElementById('insp-sub-value');
    const btn = document.getElementById('insp-power-btn');
    const lbl = document.getElementById('insp-power-label');

    if (big) {
      if (!dev.on) big.textContent = 'OFF';
      else if (dev.kind === 'climate') big.textContent = `${dev.value.toFixed(1)}°`;
      else big.textContent = `${Math.round(dev.value)}%`;
    }
    if (sub) {
      const k = dev.kind === 'light' ? `${dev.temp}K · ` : '';
      sub.textContent = `${k}${calcWatt(dev)}W`;
    }
    if (btn) {
      btn.classList.toggle('is-on', dev.on);
      btn.setAttribute('aria-pressed', String(dev.on));
    }
    if (lbl) lbl.textContent = dev.on ? '已开启 · 点击关闭' : '已关闭 · 点击开启';
  }

  function renderInspector() {
    const dev = state.devices.find((d) => d.id === state.selectedDeviceId) || state.devices[0];
    if (!dev) return;

    const roomEl = document.getElementById('insp-room-label');
    const nameEl = document.getElementById('insp-device-name');
    if (roomEl) roomEl.textContent = dev.zone;
    if (nameEl) nameEl.textContent = dev.name;

    updateInspectorReadout(dev);

    // 顶部设备切换栏
    const sw = document.getElementById('insp-switcher');
    if (sw) {
      sw.innerHTML = '';
      state.devices.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `sub-sw-pill${d.id === dev.id ? ' is-selected' : ''}`;
        b.textContent = d.name;
        b.addEventListener('click', () => {
          state.selectedDeviceId = d.id;
          renderInspector();
        });
        sw.appendChild(b);
      });
    }

    // 超宽大触屏滑块
    const sliders = document.getElementById('insp-sliders');
    if (sliders) {
      sliders.innerHTML = '';
      const primary = dev.kind === 'climate'
        ? { label: '目标温度', min: 16, max: 30, step: 0.5, unit: '°C', prop: 'value' }
        : dev.kind === 'curtain'
          ? { label: '开合比例', min: 0, max: 100, step: 1, unit: '%', prop: 'value' }
          : { label: '亮度', min: 5, max: 100, step: 1, unit: '%', prop: 'value' };

      sliders.appendChild(makeSlider(dev, primary));
      if (dev.kind === 'light') {
        sliders.appendChild(makeSlider(dev, { label: '色温', min: 2400, max: 6500, step: 100, unit: 'K', prop: 'temp' }));
      }
    }

    // 快捷档位
    const presets = document.getElementById('insp-presets');
    if (presets) {
      presets.innerHTML = '';
      getPresets(dev).forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slash-choice-btn';
        b.textContent = p.label;
        b.addEventListener('click', (e) => {
          p.apply(dev);
          if (window.AetherBG) window.AetherBG.triggerPulse(e.clientX, e.clientY);
          saveState();
          renderTangramHub();
          renderInspector();
        });
        presets.appendChild(b);
      });
    }
  }

  function makeSlider(dev, spec) {
    const block = document.createElement('div');
    block.className = 'touch-slider-block';
    const valStr = spec.step < 1 ? dev[spec.prop].toFixed(1) : Math.round(dev[spec.prop]);

    block.innerHTML = `
      <div class="touch-slider-head">
        <span>${spec.label}</span>
        <strong>${valStr}${spec.unit}</strong>
      </div>
      <input class="touch-range" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${dev[spec.prop]}" />
    `;

    const input = block.querySelector('input');
    const readout = block.querySelector('strong');
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      dev[spec.prop] = v;
      if (spec.prop === 'value') dev.on = v > 0;
      readout.textContent = `${spec.step < 1 ? v.toFixed(1) : Math.round(v)}${spec.unit}`;
      updateInspectorReadout(dev);
      saveState();
    });
    input.addEventListener('change', () => {
      renderTangramHub();
    });
    return block;
  }

  /* ========================================================================
     8. 核心业务动作：场景、开关、安防、定时
     ======================================================================== */
  function applyScene(sceneId, cx, cy) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) return;
    state.activeScene = sceneId;
    state.devices.forEach((d) => {
      const t = scene.preset[d.id];
      if (t) {
        d.on = t.on;
        d.value = t.value;
        if (typeof t.temp === 'number') d.temp = t.temp;
      }
    });
    if (window.AetherBG) {
      window.AetherBG.triggerPulse(cx, cy);
      window.AetherBG.triggerSweep();
    }
    saveState();
    renderTangramHub();
    if (state.currentView === 'inspector') renderInspector();
  }

  function toggleDevice(deviceId, cx, cy) {
    const dev = state.devices.find((d) => d.id === deviceId);
    if (!dev) return;
    dev.on = !dev.on;
    if (dev.on && dev.value === 0) dev.value = dev.kind === 'curtain' ? 80 : 65;
    if (window.AetherBG) window.AetherBG.triggerPulse(cx, cy);
    saveState();
    renderTangramHub();
    if (state.currentView === 'inspector') renderInspector();
  }

  function syncAutomationUI() {
    const title = document.getElementById('sec-state-title');
    const desc = document.getElementById('sec-state-desc');
    const btn = document.getElementById('btn-security-toggle');
    const text = document.getElementById('sec-btn-text');
    const armed = state.securityArmed;

    if (title) title.textContent = armed ? '警戒布防中' : '居家态';
    if (desc) desc.textContent = armed ? '全屋门窗与红外传感已锁定警戒' : '门窗传感待命，点击下方即可切换离家警戒';
    if (btn) btn.setAttribute('aria-pressed', String(armed));
    if (text) text.textContent = armed ? '解除离家警戒' : '开启离家警戒';

    const curtain = state.devices.find((d) => d.id === 'curtain');
    const cBtn = document.getElementById('macro-curtains-toggle');
    if (cBtn && curtain) cBtn.textContent = curtain.on && curtain.value > 0 ? '窗帘一键闭合' : '窗帘一键全开';
  }

  let sleepTimerId = null;
  function setSleepTimer(minutes) {
    if (sleepTimerId) {
      clearInterval(sleepTimerId);
      sleepTimerId = null;
    }
    state.sleepTimerRemaining = minutes * 60;

    document.querySelectorAll('.timer-touch-row .slash-choice-btn').forEach((b) => {
      const m = Number(b.dataset.minutes);
      b.classList.toggle('is-active', minutes > 0 && m === minutes);
    });

    const readout = document.getElementById('sleep-timer-readout');
    if (minutes <= 0) {
      if (readout) readout.textContent = '未设定';
      return;
    }

    const tickReadout = () => {
      const m = Math.floor(state.sleepTimerRemaining / 60);
      const s = state.sleepTimerRemaining % 60;
      if (readout) readout.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    tickReadout();

    sleepTimerId = setInterval(() => {
      state.sleepTimerRemaining -= 1;
      if (state.sleepTimerRemaining <= 0) {
        clearInterval(sleepTimerId);
        sleepTimerId = null;
        if (readout) readout.textContent = '已执行熄灯';
        document.querySelectorAll('.timer-touch-row .slash-choice-btn').forEach((b) => b.classList.remove('is-active'));
        applyScene('night');
      } else {
        tickReadout();
      }
    }, 1000);
  }

  /* ========================================================================
     9. 事件绑定与启动
     ======================================================================== */
  function bindStaticEvents() {
    document.querySelectorAll('[data-back-hub]').forEach((btn) => {
      btn.addEventListener('click', (e) => switchView('hub', e.clientX, e.clientY));
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.currentView !== 'hub') switchView('hub');
    });

    const inspPower = document.getElementById('insp-power-btn');
    if (inspPower) {
      inspPower.addEventListener('click', (e) => toggleDevice(state.selectedDeviceId, e.clientX, e.clientY));
    }

    const secBtn = document.getElementById('btn-security-toggle');
    if (secBtn) {
      secBtn.addEventListener('click', (e) => {
        state.securityArmed = !state.securityArmed;
        if (window.AetherBG) window.AetherBG.triggerPulse(e.clientX, e.clientY);
        saveState();
        syncAutomationUI();
        renderTangramHub();
      });
    }

    document.querySelectorAll('.timer-touch-row .slash-choice-btn').forEach((b) => {
      b.addEventListener('click', () => setSleepTimer(Number(b.dataset.minutes || 0)));
    });

    const allOn = document.getElementById('macro-all-lights-on');
    if (allOn) {
      allOn.addEventListener('click', (e) => {
        state.devices.forEach((d) => { if (d.kind === 'light') { d.on = true; d.value = 100; } });
        if (window.AetherBG) window.AetherBG.triggerPulse(e.clientX, e.clientY);
        saveState();
        renderTangramHub();
      });
    }

    const cToggle = document.getElementById('macro-curtains-toggle');
    if (cToggle) {
      cToggle.addEventListener('click', (e) => {
        const c = state.devices.find((d) => d.id === 'curtain');
        if (!c) return;
        const closeIt = c.on && c.value > 0;
        c.on = !closeIt;
        c.value = closeIt ? 0 : 100;
        if (window.AetherBG) window.AetherBG.triggerPulse(e.clientX, e.clientY);
        saveState();
        syncAutomationUI();
        renderTangramHub();
      });
    }

    const away = document.getElementById('macro-away-mode');
    if (away) {
      away.addEventListener('click', (e) => {
        state.securityArmed = true;
        applyScene('night', e.clientX, e.clientY);
        syncAutomationUI();
      });
    }

    // 仅在网络断开等非正常情况下弹出底部异常提示
    window.addEventListener('offline', () => {
      showToast('网络连接已断开，当前仅作本地状态记录');
    });
  }

  function startClock() {
    setInterval(() => {
      const el = document.getElementById('hero-clock');
      if (!el) return;
      const now = new Date();
      el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }, 15000);
  }

  function init() {
    fitStage();
    loadState();
    bindStaticEvents();
    renderTangramHub();
    syncAutomationUI();
    startClock();
    hasInitialized = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
