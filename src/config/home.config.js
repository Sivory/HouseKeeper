/**
 * AETHER · 业务领域声明式配置文件
 * 集中管理空间场景、核心设备清单、设备控件规格、预设档位、定时与全屋宏指令
 */

export const STORAGE_KEY = 'aether_tangram_v3';

/** 4 套空间场景预设 */
export const SCENES_CONFIG = [
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
    en: 'COOL 2077',
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

/** 5 组核心电器默认元数据 */
export const DEVICES_CONFIG = [
  { id: 'living_light', name: '客厅主灯', zone: '客厅', kind: 'light', on: true, value: 92, temp: 5200, wattMax: 44 },
  { id: 'bedroom_light', name: '卧室灯', zone: '卧室', kind: 'light', on: true, value: 85, temp: 5000, wattMax: 32 },
  { id: 'ambient_strip', name: '氛围灯带', zone: '客厅', kind: 'light', on: true, value: 45, temp: 4800, wattMax: 24 },
  { id: 'curtain', name: '全屋窗帘', zone: '遮阳', kind: 'curtain', on: true, value: 100, wattMax: 14 },
  { id: 'climate', name: '中央空调', zone: '环境', kind: 'climate', on: true, value: 23.5, wattMax: 680 }
];

/** 按设备类型声明滑块参数与 4 档快速预设 */
export const DEVICE_KIND_SPECS = {
  light: {
    offLabel: '已关闭',
    defaultOnValue: 65,
    sliders: [
      { id: 'sl_primary', label: '亮度', min: 5, max: 100, step: 1, unit: '%', prop: 'value' },
      { id: 'sl_temp', label: '色温', min: 2400, max: 6500, step: 100, unit: 'K', prop: 'temp' }
    ],
    presets: [
      { label: '25% 柔光', patch: { on: true, value: 25, temp: 2800 } },
      { label: '60% 舒适', patch: { on: true, value: 60, temp: 3800 } },
      { label: '100% 明亮', patch: { on: true, value: 100, temp: 5400 } },
      { label: '关闭', patch: { on: false, value: 0 } }
    ]
  },
  curtain: {
    offLabel: '已闭合',
    defaultOnValue: 80,
    sliders: [
      { id: 'sl_primary', label: '开合比例', min: 0, max: 100, step: 1, unit: '%', prop: 'value' }
    ],
    presets: [
      { label: '全闭 0%', patch: { on: false, value: 0 } },
      { label: '微启 35%', patch: { on: true, value: 35 } },
      { label: '半开 70%', patch: { on: true, value: 70 } },
      { label: '全开 100%', patch: { on: true, value: 100 } }
    ]
  },
  climate: {
    offLabel: '已关闭',
    defaultOnValue: 23.5,
    sliders: [
      { id: 'sl_primary', label: '目标温度', min: 16, max: 30, step: 0.5, unit: '°C', prop: 'value' }
    ],
    presets: [
      { label: '20.5° 强冷', patch: { on: true, value: 20.5 } },
      { label: '23.5° 舒适', patch: { on: true, value: 23.5 } },
      { label: '25.5° 睡眠', patch: { on: true, value: 25.5 } },
      { label: '待机关闭', patch: { on: false } }
    ]
  }
};

/** 睡眠倒计时档位配置 */
export const SLEEP_TIMER_OPTIONS = [
  { id: 'timer_15', minutes: 15, label: '15 分钟' },
  { id: 'timer_30', minutes: 30, label: '30 分钟' },
  { id: 'timer_60', minutes: 60, label: '60 分钟' },
  { id: 'timer_0', minutes: 0, label: '取消' }
];

/** 全屋快捷宏指令清单 */
export const MACROS_CONFIG = [
  { id: 'macro_lights', action: 'allLightsOn', label: '全屋照明全开' },
  { id: 'macro_curtains', action: 'toggleCurtains', labelOpen: '窗帘一键闭合', labelClosed: '窗帘一键全开' },
  { id: 'macro_away', action: 'awayMode', label: '离家节能布防' }
];
