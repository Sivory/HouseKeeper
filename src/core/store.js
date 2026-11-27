/**
 * AETHER · 纯业务逻辑与领域状态机（HomeStore）
 * 与 WebGL / 视图完全解耦，负责场景联动、设备控制、安防、睡眠定时、功耗计算与持久化
 * 后续对接 Home Assistant / MQTT 时，仅需在此层挂载通信适配器即可
 */
import {
  STORAGE_KEY,
  SCENES_CONFIG,
  DEVICES_CONFIG,
  DEVICE_KIND_SPECS
} from '../config/home.config.js';

export class HomeStore {
  constructor() {
    this.state = {
      currentView: 'hub',
      activeScene: SCENES_CONFIG[0].id,
      selectedDeviceId: DEVICES_CONFIG[0].id,
      securityArmed: false,
      sleepMinutesSelected: 0,
      sleepRemainingSec: 0,
      devices: DEVICES_CONFIG.map((d) => ({ ...d }))
    };

    this._listeners = new Map();
    this._sleepInterval = null;
    this.load();
  }

  /** 订阅领域事件：'change' | 'view' | 'scene' | 'pulse' | 'sweep' | 'toast' */
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }

  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    set.forEach((fn) => fn(payload));
  }

  /* ---- 查询方法 ---- */
  getScenes() {
    return SCENES_CONFIG;
  }

  getActiveScene() {
    return SCENES_CONFIG.find((s) => s.id === this.state.activeScene) || SCENES_CONFIG[0];
  }

  getDevice(id) {
    return this.state.devices.find((d) => d.id === id) || null;
  }

  getSelectedDevice() {
    return this.getDevice(this.state.selectedDeviceId) || this.state.devices[0];
  }

  getDeviceSpec(dev) {
    return DEVICE_KIND_SPECS[dev.kind] || DEVICE_KIND_SPECS.light;
  }

  calcDeviceWatt(dev) {
    if (!dev || !dev.on) return 0;
    if (dev.kind === 'climate') return Math.round(140 + Math.abs(26 - dev.value) * 68);
    if (dev.kind === 'curtain') return 2;
    return Math.max(2, Math.round((dev.value / 100) * dev.wattMax));
  }

  getTotalWatt() {
    let sum = 12;
    for (let i = 0; i < this.state.devices.length; i++) {
      sum += this.calcDeviceWatt(this.state.devices[i]);
    }
    return sum;
  }

  getRoomTempText() {
    const ac = this.getDevice('climate');
    return ac && ac.on ? ac.value.toFixed(1) : '26.0';
  }

  getDevicePercent(dev) {
    if (!dev || !dev.on) return 0;
    if (dev.kind === 'climate') return Math.max(0, Math.min(1, (dev.value - 16) / 14));
    return Math.max(0, Math.min(1, dev.value / 100));
  }

  formatDeviceMetric(dev) {
    if (!dev.on) return this.getDeviceSpec(dev).offLabel;
    if (dev.kind === 'climate') return `${dev.value.toFixed(1)}°C`;
    return `${Math.round(dev.value)}%`;
  }

  /* ---- 业务动作 ---- */
  switchView(targetView, pt) {
    if (this.state.currentView === targetView) return;
    this.state.currentView = targetView;
    this._emit('sweep');
    if (pt) this._emit('pulse', pt);
    this._emit('view', targetView);
    this._emit('change');
  }

  selectDevice(deviceId) {
    if (this.getDevice(deviceId)) {
      this.state.selectedDeviceId = deviceId;
      this._emit('change');
    }
  }

  applyScene(sceneId, pt) {
    const sc = SCENES_CONFIG.find((s) => s.id === sceneId);
    if (!sc) return;
    this.state.activeScene = sceneId;
    this.state.devices.forEach((d) => {
      const target = sc.preset[d.id];
      if (target) {
        d.on = target.on;
        d.value = target.value;
        if (typeof target.temp === 'number') d.temp = target.temp;
      }
    });
    this.save();
    this._emit('sweep');
    if (pt) this._emit('pulse', pt);
    this._emit('scene', sceneId);
    this._emit('change');
  }

  toggleDevice(deviceId, pt) {
    const dev = this.getDevice(deviceId);
    if (!dev) return;
    this.state.selectedDeviceId = deviceId;
    dev.on = !dev.on;
    if (dev.on && dev.value === 0) {
      dev.value = this.getDeviceSpec(dev).defaultOnValue;
    }
    this.save();
    if (pt) this._emit('pulse', pt);
    this._emit('change');
  }

  setDeviceProperty(deviceId, prop, value, persist = false) {
    const dev = this.getDevice(deviceId);
    if (!dev) return;
    dev[prop] = value;
    if (prop === 'value') dev.on = value > 0;
    if (persist) this.save();
    this._emit('change');
  }

  applyDevicePreset(deviceId, patch, pt) {
    const dev = this.getDevice(deviceId);
    if (!dev || !patch) return;
    Object.assign(dev, patch);
    this.save();
    if (pt) this._emit('pulse', pt);
    this._emit('change');
  }

  toggleSecurity(pt) {
    this.state.securityArmed = !this.state.securityArmed;
    this.save();
    if (pt) this._emit('pulse', pt);
    this._emit('change');
  }

  setSleepTimer(minutes, pt) {
    if (this._sleepInterval) {
      clearInterval(this._sleepInterval);
      this._sleepInterval = null;
    }
    this.state.sleepMinutesSelected = minutes;
    this.state.sleepRemainingSec = minutes * 60;
    if (pt) this._emit('pulse', pt);
    this._emit('change');

    if (minutes <= 0) return;

    this._sleepInterval = setInterval(() => {
      this.state.sleepRemainingSec -= 1;
      if (this.state.sleepRemainingSec <= 0) {
        clearInterval(this._sleepInterval);
        this._sleepInterval = null;
        this.state.sleepMinutesSelected = 0;
        this.applyScene('night');
      } else {
        this._emit('change');
      }
    }, 1000);
  }

  runMacro(action, pt) {
    if (action === 'allLightsOn') {
      this.state.devices.forEach((d) => {
        if (d.kind === 'light') {
          d.on = true;
          d.value = 100;
        }
      });
      this.save();
      if (pt) this._emit('pulse', pt);
      this._emit('change');
    } else if (action === 'toggleCurtains') {
      const c = this.getDevice('curtain');
      if (!c) return;
      const closeIt = c.on && c.value > 0;
      c.on = !closeIt;
      c.value = closeIt ? 0 : 100;
      this.save();
      if (pt) this._emit('pulse', pt);
      this._emit('change');
    } else if (action === 'awayMode') {
      this.state.securityArmed = true;
      this.applyScene('night', pt);
    }
  }

  notifyAbnormal(message) {
    this._emit('toast', message);
  }

  /* ---- 持久化 ---- */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.activeScene && SCENES_CONFIG.some((s) => s.id === saved.activeScene)) {
        this.state.activeScene = saved.activeScene;
      }
      if (typeof saved.securityArmed === 'boolean') {
        this.state.securityArmed = saved.securityArmed;
      }
      if (Array.isArray(saved.devices)) {
        this.state.devices.forEach((d) => {
          const hit = saved.devices.find((x) => x.id === d.id);
          if (hit) {
            d.on = Boolean(hit.on);
            if (typeof hit.value === 'number') d.value = hit.value;
            if (typeof hit.temp === 'number') d.temp = hit.temp;
          }
        });
      }
    } catch (_) {
      // 忽略异常存储数据
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeScene: this.state.activeScene,
        securityArmed: this.state.securityArmed,
        devices: this.state.devices.map(({ id, on, value, temp }) => ({ id, on, value, temp }))
      }));
    } catch (_) {
      // 忽略隐私模式限制
    }
  }
}
