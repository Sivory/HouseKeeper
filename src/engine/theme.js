/**
 * AETHER WebGL 2.0 · 场景主题调色板与零 GC 缓动插值模块
 * 所有颜色均采用归一化 RGBA [0..1] 浮点数组，供顶点着色器直接使用
 */

/** 将十六进制颜色与透明度转为 RGBA 浮点数组 */
function hex(str, a = 1) {
  const n = parseInt(str.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}

/** 4 套空间场景调色板（明亮 / 温馨 / 酷炫 2077 / 熄灯） */
export const THEMES = {
  bright: {
    bgA: hex('#e6ebf2'),
    bgB: hex('#f4f7fb'),
    bgBlockA: hex('#d9e0ea', 0.65),
    bgBlockB: hex('#cdd6e3', 0.54),
    bgBlockC: hex('#ffffff', 0.48),
    bgLine: hex('#263040', 0.08),
    // 明亮模式反转：关闭=沉稳岩灰，开启=纯净高亮白陶瓷
    idleA: hex('#dce2ec', 0.92),
    idleB: hex('#cfd7e4', 0.90),
    heroA: hex('#ffffff', 0.98),
    heroB: hex('#f0f4fa', 0.95),
    activeA: hex('#ffffff', 0.99),
    activeB: hex('#f4f8ff', 0.98),
    extrudeIdle: hex('#b5bfce', 1.0),
    extrudeActive: hex('#9aa8be', 1.0),
    strokeIdle: hex('#1a2029', 0.11),
    strokeActive: hex('#436485', 0.34),
    textPrimary: hex('#4a5465', 1.0),
    textSecondary: hex('#6c778a', 1.0),
    textInverse: hex('#18202c', 1.0),
    heroSceneText: hex('#18202c', 1.0),
    accentCore: hex('#436485', 1.0),
    accentSolid: hex('#242c38', 1.0),
    coreRing1: hex('#1a2029', 0.22),
    coreRing3: hex('#1a2029', 0.45),
    breathGlow: hex('#6e94bc', 0.24),
    activeBreathGlow: hex('#7aa7d6', 0.30),
    tuneBgIdle: hex('#1a2029', 0.08),
    tuneBgActive: hex('#436485', 0.12),
    trackBg: hex('#5b677a', 0.22),
    toastBg: hex('#1e242e', 0.96),
    toastText: hex('#f4f7fb', 1.0),
    bgSpeed: 0.24,
    breathSpeed: 1.3
  },
  warm: {
    bgA: hex('#ebe5dc'),
    bgB: hex('#f7f3ec'),
    bgBlockA: hex('#dfd7cb', 0.65),
    bgBlockB: hex('#d4cabd', 0.54),
    bgBlockC: hex('#fffdf9', 0.48),
    bgLine: hex('#544638', 0.08),
    // 温馨模式反转：关闭=柔和暖灰石膏，开启=温润高亮暖白
    idleA: hex('#e2dbd0', 0.92),
    idleB: hex('#d6cec1', 0.90),
    heroA: hex('#fffefb', 0.98),
    heroB: hex('#f5efe6', 0.95),
    activeA: hex('#fffdf9', 0.99),
    activeB: hex('#faf4ea', 0.98),
    extrudeIdle: hex('#bfb6a8', 1.0),
    extrudeActive: hex('#afa18d', 1.0),
    strokeIdle: hex('#27221d', 0.11),
    strokeActive: hex('#8e7458', 0.36),
    textPrimary: hex('#5a5147', 1.0),
    textSecondary: hex('#7a7064', 1.0),
    textInverse: hex('#251f19', 1.0),
    heroSceneText: hex('#251f19', 1.0),
    accentCore: hex('#8e7458', 1.0),
    accentSolid: hex('#3b332b', 1.0),
    coreRing1: hex('#27221d', 0.22),
    coreRing3: hex('#27221d', 0.45),
    breathGlow: hex('#b69876', 0.26),
    activeBreathGlow: hex('#d4ad7d', 0.32),
    tuneBgIdle: hex('#27221d', 0.08),
    tuneBgActive: hex('#8e7458', 0.14),
    trackBg: hex('#75695c', 0.22),
    toastBg: hex('#332d27', 0.96),
    toastText: hex('#faf6f0', 1.0),
    bgSpeed: 0.18,
    breathSpeed: 1.1
  },
  cool: {
    // 赛博朋克 2077 夜之城高对比配色（保持暗底关闭 / 赛博黄开启）
    bgA: hex('#0b0d14'),
    bgB: hex('#141724'),
    bgBlockA: hex('#320a1d', 0.72),
    bgBlockB: hex('#062836', 0.64),
    bgBlockC: hex('#3d3409', 0.42),
    bgLine: hex('#00f0ff', 0.16),
    idleA: hex('#141826', 0.95),
    idleB: hex('#0c0f1a', 0.97),
    heroA: hex('#121420', 0.97),
    heroB: hex('#0a0c16', 0.98),
    activeA: hex('#fcee0a', 0.98),
    activeB: hex('#e2c800', 0.98),
    extrudeIdle: hex('#2a0d1c', 1.0),
    extrudeActive: hex('#ff2a6d', 1.0),
    strokeIdle: hex('#ff2a6d', 0.50),
    strokeActive: hex('#00f0ff', 0.85),
    textPrimary: hex('#eef9ff', 1.0),
    textSecondary: hex('#58e6f5', 1.0),
    textInverse: hex('#090b10', 1.0),
    heroSceneText: hex('#fcee0a', 1.0),
    accentCore: hex('#00f0ff', 1.0),
    accentSolid: hex('#fcee0a', 1.0),
    coreRing1: hex('#ff2a6d', 0.52),
    coreRing3: hex('#fcee0a', 0.68),
    breathGlow: hex('#00f0ff', 0.30),
    activeBreathGlow: hex('#ff2a6d', 0.26),
    tuneBgIdle: hex('#00f0ff', 0.14),
    tuneBgActive: hex('#090b10', 0.16),
    trackBg: hex('#58e6f5', 0.22),
    toastBg: hex('#fcee0a', 0.98),
    toastText: hex('#090b10', 1.0),
    bgSpeed: 0.34,
    breathSpeed: 2.0
  },
  night: {
    bgA: hex('#171b21'),
    bgB: hex('#20252e'),
    bgBlockA: hex('#20252e', 0.68),
    bgBlockB: hex('#282e39', 0.58),
    bgBlockC: hex('#333b49', 0.42),
    bgLine: hex('#d2def0', 0.08),
    idleA: hex('#262c36', 0.92),
    idleB: hex('#1d222a', 0.94),
    heroA: hex('#2a303b', 0.94),
    heroB: hex('#1f242d', 0.94),
    activeA: hex('#dfe5ee', 0.96),
    activeB: hex('#c4cedb', 0.96),
    extrudeIdle: hex('#0e1116', 1.0),
    extrudeActive: hex('#96a2b3', 1.0),
    strokeIdle: hex('#e6ebf3', 0.13),
    strokeActive: hex('#161a21', 0.28),
    textPrimary: hex('#e6ebf3', 1.0),
    textSecondary: hex('#8f99aa', 1.0),
    textInverse: hex('#161a21', 1.0),
    heroSceneText: hex('#e6ebf3', 1.0),
    accentCore: hex('#b5c7dc', 1.0),
    accentSolid: hex('#dfe5ee', 1.0),
    coreRing1: hex('#e6ebf3', 0.20),
    coreRing3: hex('#e6ebf3', 0.42),
    breathGlow: hex('#b8cae4', 0.22),
    activeBreathGlow: hex('#161a21', 0.14),
    tuneBgIdle: hex('#8f99aa', 0.18),
    tuneBgActive: hex('#141820', 0.16),
    trackBg: hex('#8f99aa', 0.24),
    toastBg: hex('#dfe5ee', 0.96),
    toastText: hex('#161a21', 1.0),
    bgSpeed: 0.14,
    breathSpeed: 0.95
  }
};

const COLOR_KEYS = Object.keys(THEMES.bright).filter((k) => Array.isArray(THEMES.bright[k]));

/** 创建可原地插值的运行时主题状态对象 */
export function createThemeState(initialId = 'bright') {
  const src = THEMES[initialId] || THEMES.bright;
  const cur = { bgSpeed: src.bgSpeed, breathSpeed: src.breathSpeed };
  for (const k of COLOR_KEYS) {
    cur[k] = [src[k][0], src[k][1], src[k][2], src[k][3]];
  }
  return cur;
}

/**
 * 每帧平滑插值主题颜色，返回是否仍在变化（用于动态限帧判定）
 */
export function stepTheme(cur, targetId, dt) {
  const dst = THEMES[targetId] || THEMES.bright;
  const f = 1 - Math.exp(-dt * 5.2);
  let moving = false;

  for (let i = 0; i < COLOR_KEYS.length; i++) {
    const k = COLOR_KEYS[i];
    const c = cur[k];
    const d = dst[k];
    for (let j = 0; j < 4; j++) {
      const diff = d[j] - c[j];
      if (Math.abs(diff) > 0.0015) {
        c[j] += diff * f;
        moving = true;
      } else {
        c[j] = d[j];
      }
    }
  }
  cur.bgSpeed += (dst.bgSpeed - cur.bgSpeed) * f;
  cur.breathSpeed += (dst.breathSpeed - cur.breathSpeed) * f;
  return moving;
}

/** 线性混合两个 RGBA 颜色写入输出数组（零分配） */
export function mixColorInto(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  out[3] = a[3] + (b[3] - a[3]) * t;
  return out;
}
