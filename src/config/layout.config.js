/**
 * AETHER · 声明式几何与布局配置文件
 * 将舞台比例、斜线锚点、七巧板拓扑关系、嵌套子按钮偏移与二级视图尺寸全部从代码中抽离
 */

/** 舞台弹性自适应参数（以 iPad 横屏为基准） */
export const STAGE_CONFIG = {
  baseHeight: 960,
  minRatio: 1.28,
  maxRatio: 1.66,
  outerPadding: 56,
  tangramGap: 22,
  slashSlope: -0.18,
  maxDpr: 2
};

/** 各视图切换时的背景镜头平移偏移量 */
export const VIEW_CAM_SHIFTS = {
  hub: [0, 0],
  inspector: [110, -28],
  automation: [-96, 36]
};

/** 一级七巧板斜线与微倾横线的归一化锚点比例 */
export const HUB_GUIDES = {
  x: {
    xA: 0.445,        // 左区（中枢+场景）与右区（电器）分界
    xSceneMid: 0.235, // 场景左右分割斜线
    xC: 0.745,        // 中央电器列与最右侧电器列分界
    xNav1: 0.635,     // 底部导航第 1 分割线
    xNav2: 0.825      // 底部导航第 2 分割线
  },
  y: {
    yHeroBot: 0.575,
    ySceneMid: 0.790,
    yMainBot: 0.515,
    yCurtainBot: 0.305,
    yClimateBot: 0.610,
    yBotStrip: 0.835
  },
  k: {
    none: 0,
    kL: -0.055,       // 左区微向上倾
    kR: 0.055         // 中央主灯底边微向下倾，打破十字交叉
  }
};

/**
 * 13 块七巧板声明式拓扑描述
 * 每个顶点由以下两种规则之一表达：
 * - { edgeX: 'left'|'right', edgeY: 'top'|'bottom' } 或固定边界 + 参考线交点
 * - { xLine, xGap (-1|0|1), yLine, yGap (-1|0|1), k }
 */
export const HUB_SLOTS_CONFIG = [
  {
    id: 'hero',
    role: 'hero',
    out: [-42, -26],
    verts: [
      { edgeX: 'left', edgeY: 'top' },
      { xLine: 'xA', xGap: -1, edgeY: 'top' },
      { xLine: 'xA', xGap: -1, yLine: 'yHeroBot', yGap: -1, k: 'kL' },
      { edgeX: 'left', yLine: 'yHeroBot', yGap: -1 }
    ]
  },
  {
    id: 'scene_bright',
    role: 'scene',
    sceneId: 'bright',
    out: [-44, 14],
    verts: [
      { edgeX: 'left', yLine: 'yHeroBot', yGap: 1 },
      { xLine: 'xSceneMid', xGap: -1, yLine: 'yHeroBot', yGap: 1, k: 'kL' },
      { xLine: 'xSceneMid', xGap: -1, yLine: 'ySceneMid', yGap: -1, k: 'kL' },
      { edgeX: 'left', yLine: 'ySceneMid', yGap: -1 }
    ]
  },
  {
    id: 'scene_warm',
    role: 'scene',
    sceneId: 'warm',
    out: [-26, 22],
    verts: [
      { xLine: 'xSceneMid', xGap: 1, yLine: 'yHeroBot', yGap: 1, k: 'kL' },
      { xLine: 'xA', xGap: -1, yLine: 'yHeroBot', yGap: 1, k: 'kL' },
      { xLine: 'xA', xGap: -1, yLine: 'ySceneMid', yGap: -1, k: 'kL' },
      { xLine: 'xSceneMid', xGap: 1, yLine: 'ySceneMid', yGap: -1, k: 'kL' }
    ]
  },
  {
    id: 'scene_cool',
    role: 'scene',
    sceneId: 'cool',
    compact: true,
    out: [-48, 36],
    verts: [
      { edgeX: 'left', yLine: 'ySceneMid', yGap: 1 },
      { xLine: 'xSceneMid', xGap: -1, yLine: 'ySceneMid', yGap: 1, k: 'kL' },
      { xLine: 'xSceneMid', xGap: -1, edgeY: 'bottom' },
      { edgeX: 'left', edgeY: 'bottom' }
    ]
  },
  {
    id: 'scene_night',
    role: 'scene',
    sceneId: 'night',
    compact: true,
    out: [-30, 40],
    verts: [
      { xLine: 'xSceneMid', xGap: 1, yLine: 'ySceneMid', yGap: 1, k: 'kL' },
      { xLine: 'xA', xGap: -1, yLine: 'ySceneMid', yGap: 1, k: 'kL' },
      { xLine: 'xA', xGap: -1, edgeY: 'bottom' },
      { xLine: 'xSceneMid', xGap: 1, edgeY: 'bottom' }
    ]
  },
  {
    id: 'dev_living_light',
    role: 'device',
    deviceId: 'living_light',
    size: 'large',
    out: [16, -40],
    verts: [
      { xLine: 'xA', xGap: 1, edgeY: 'top' },
      { xLine: 'xC', xGap: -1, edgeY: 'top' },
      { xLine: 'xC', xGap: -1, yLine: 'yMainBot', yGap: -1, k: 'kR' },
      { xLine: 'xA', xGap: 1, yLine: 'yMainBot', yGap: -1, k: 'kR' }
    ]
  },
  {
    id: 'dev_bedroom_light',
    role: 'device',
    deviceId: 'bedroom_light',
    size: 'medium',
    out: [-12, 18],
    verts: [
      { xLine: 'xA', xGap: 1, yLine: 'yMainBot', yGap: 1, k: 'kR' },
      { xLine: 'xC', xGap: -1, yLine: 'yMainBot', yGap: 1, k: 'kR' },
      { xLine: 'xC', xGap: -1, yLine: 'yBotStrip', yGap: -1 },
      { xLine: 'xA', xGap: 1, yLine: 'yBotStrip', yGap: -1 }
    ]
  },
  {
    id: 'dev_curtain',
    role: 'device',
    deviceId: 'curtain',
    size: 'medium',
    out: [46, -28],
    verts: [
      { xLine: 'xC', xGap: 1, edgeY: 'top' },
      { edgeX: 'right', edgeY: 'top' },
      { edgeX: 'right', yLine: 'yCurtainBot', yGap: -1 },
      { xLine: 'xC', xGap: 1, yLine: 'yCurtainBot', yGap: -1 }
    ]
  },
  {
    id: 'dev_climate',
    role: 'device',
    deviceId: 'climate',
    size: 'medium',
    out: [48, 0],
    verts: [
      { xLine: 'xC', xGap: 1, yLine: 'yCurtainBot', yGap: 1 },
      { edgeX: 'right', yLine: 'yCurtainBot', yGap: 1 },
      { edgeX: 'right', yLine: 'yClimateBot', yGap: -1 },
      { xLine: 'xC', xGap: 1, yLine: 'yClimateBot', yGap: -1 }
    ]
  },
  {
    id: 'dev_ambient_strip',
    role: 'device',
    deviceId: 'ambient_strip',
    size: 'tall',
    out: [42, 22],
    verts: [
      { xLine: 'xC', xGap: 1, yLine: 'yClimateBot', yGap: 1 },
      { edgeX: 'right', yLine: 'yClimateBot', yGap: 1 },
      { edgeX: 'right', yLine: 'yBotStrip', yGap: -1 },
      { xLine: 'xC', xGap: 1, yLine: 'yBotStrip', yGap: -1 }
    ]
  },
  {
    id: 'nav_inspector',
    role: 'nav',
    targetView: 'inspector',
    title: '精细调参',
    sub: '亮度 · 色温',
    out: [-8, 42],
    verts: [
      { xLine: 'xA', xGap: 1, yLine: 'yBotStrip', yGap: 1 },
      { xLine: 'xNav1', xGap: -1, yLine: 'yBotStrip', yGap: 1 },
      { xLine: 'xNav1', xGap: -1, edgeY: 'bottom' },
      { xLine: 'xA', xGap: 1, edgeY: 'bottom' }
    ]
  },
  {
    id: 'nav_automation',
    role: 'nav',
    targetView: 'automation',
    title: '安防与定时',
    sub: '警戒 · 熄灯',
    out: [20, 42],
    verts: [
      { xLine: 'xNav1', xGap: 1, yLine: 'yBotStrip', yGap: 1 },
      { xLine: 'xNav2', xGap: -1, yLine: 'yBotStrip', yGap: 1 },
      { xLine: 'xNav2', xGap: -1, edgeY: 'bottom' },
      { xLine: 'xNav1', xGap: 1, edgeY: 'bottom' }
    ]
  },
  {
    id: 'nav_sleep',
    role: 'sleep',
    title: '全屋休眠',
    sub: '一键熄灯',
    out: [46, 42],
    verts: [
      { xLine: 'xNav2', xGap: 1, yLine: 'yBotStrip', yGap: 1 },
      { edgeX: 'right', yLine: 'yBotStrip', yGap: 1 },
      { edgeX: 'right', edgeY: 'bottom' },
      { xLine: 'xNav2', xGap: 1, edgeY: 'bottom' }
    ]
  }
];

/** 嵌套子按钮（精调 ▸）与二级视图通用比例参数 */
export const SUB_LAYOUT_CONFIG = {
  tuneButton: { width: 84, height: 34, rightInset: 28, topInset: 22, slant: 8 },
  headerHeight: 58,
  headerGap: 22,
  columnGap: 24,
  leftColumnRatio: 0.40,
  panelChamferTR: 42,
  panelChamferBL: 34,
  backButton: { width: 138, height: 52, slant: 14 },
  switcher: { width: 114, height: 46, gap: 10, slant: 11 },
  actionButtonHeight: 68,
  actionButtonInsetX: 42,
  actionButtonBottomMargin: 42
};
