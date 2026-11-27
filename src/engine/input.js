/**
 * AETHER WebGL 2.0 · 纯触控事件分发与精确多边形碰撞系统
 * 特性：
 * 1. 基于射线法（Ray Casting）对任意凸/凹多边形做像素级命中判定
 * 2. 支持嵌套按钮（例如电器板块内嵌套「精调 ▸」子按钮）：严格按 zIndex 从高到低检测，子按钮优先拦截
 * 3. 支持滑块连续拖动捕获（手指移出轨道仍可平滑拖动，抬起释放）
 * 4. 零鼠标悬停追踪，专为 iPad / iPhone 触控体验设计
 */

/**
 * 射线法精确判断点 (px, py) 是否落在多边形 poly 内部
 * @param {number} px
 * @param {number} py
 * @param {number[][]} poly 顶点数组 [[x0,y0], [x1,y1], ...]
 */
export function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export class TouchInputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => { originX: number, originY: number, scale: number }} getTransform
   * @param {() => Array<object>} getHitRegions 返回当前激活视图的所有可交互多边形区域
   * @param {(clientX: number, clientY: number) => void} onActivity 任意触控发生时唤醒高帧率
   */
  constructor(canvas, getTransform, getHitRegions, onActivity) {
    this.canvas = canvas;
    this.getTransform = getTransform;
    this.getHitRegions = getHitRegions;
    this.onActivity = onActivity;

    this.activePointerId = null;
    this.pressedRegion = null;
    this.pressedId = null;

    this._onDown = this._handleDown.bind(this);
    this._onMove = this._handleMove.bind(this);
    this._onUp = this._handleUp.bind(this);

    canvas.addEventListener('pointerdown', this._onDown, { passive: false });
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp, { passive: false });
    window.addEventListener('pointercancel', this._onUp, { passive: false });
  }

  _toStage(clientX, clientY) {
    const { originX, originY, scale } = this.getTransform();
    return {
      x: (clientX - originX) / Math.max(scale, 0.001),
      y: (clientY - originY) / Math.max(scale, 0.001)
    };
  }

  /** 按 zIndex 降序查找最顶层命中的多边形（确保嵌套子按钮优先于父板块） */
  _hitTest(sx, sy) {
    const regions = this.getHitRegions();
    let best = null;
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (!r.poly) continue;
      if (best && r.zIndex < best.zIndex) continue;
      if (pointInPolygon(sx, sy, r.poly)) {
        best = r;
      }
    }
    return best;
  }

  _handleDown(e) {
    // 仅追踪单指主触点，忽略多指误触干扰
    if (this.activePointerId !== null) return;
    e.preventDefault();

    this.activePointerId = e.pointerId;
    const pt = this._toStage(e.clientX, e.clientY);
    const hit = this._hitTest(pt.x, pt.y);

    if (this.onActivity) this.onActivity();

    if (!hit) return;
    this.pressedRegion = hit;
    this.pressedId = hit.id;

    // 滑块按下即刻响应并进入拖动捕获态
    if (hit.kind === 'slider' && hit.onDrag) {
      hit.onDrag(pt.x, pt.y, e.clientX, e.clientY);
    }
  }

  _handleMove(e) {
    if (this.activePointerId !== e.pointerId || !this.pressedRegion) return;
    e.preventDefault();

    const pt = this._toStage(e.clientX, e.clientY);
    if (this.onActivity) this.onActivity();

    if (this.pressedRegion.kind === 'slider' && this.pressedRegion.onDrag) {
      this.pressedRegion.onDrag(pt.x, pt.y, e.clientX, e.clientY);
      return;
    }

    // 普通按钮：若手指滑出多边形则取消按压高亮
    const stillInside = pointInPolygon(pt.x, pt.y, this.pressedRegion.poly);
    this.pressedId = stillInside ? this.pressedRegion.id : null;
  }

  _handleUp(e) {
    if (this.activePointerId !== e.pointerId) return;
    e.preventDefault();

    const region = this.pressedRegion;
    const pt = this._toStage(e.clientX, e.clientY);

    this.activePointerId = null;
    this.pressedRegion = null;
    this.pressedId = null;

    if (!region) return;
    if (this.onActivity) this.onActivity();

    if (region.kind === 'slider') {
      if (region.onRelease) region.onRelease();
      return;
    }

    // 抬起时仍在原多边形内才触发点击（防止误触）
    if (pointInPolygon(pt.x, pt.y, region.poly) && region.onTap) {
      region.onTap(e.clientX, e.clientY);
    }
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
  }
}
