/**
 * AETHER WebGL 2.0 · 纯白共享文字纹理图集（Glyph Atlas）
 * 原理：
 * 1. 在 1024x1024 离屏 Canvas 中以纯白色 (#FFFFFF) 烘焙所有字形（支持 light / regular 双字重）
 * 2. 上传为单张 WebGL 2.0 共享纹理；所有文字渲染合并进同一个文字 VBO，颜色与透明度全交由片元着色器处理
 * 3. 若运行期出现未预烘焙的字符，自动增量绘制到剩余空位并用 texSubImage2D 局部上传
 */

const ATLAS_SIZE = 1024;
const BAKE_FONT_SIZE = 52;
const CELL_PAD = 6;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Microsoft YaHei UI", sans-serif';

/** 启动时预烘焙的界面全量字符集（避免首帧闪烁与运行期卡顿） */
const PRELOAD_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  ' .:%°·▸◁-/' +
  '明亮温馨酷炫熄灯客厅主卧室氛围带全屋窗帘中央空调精细调参安防与定时休眠一键' +
  '实时功耗居家警戒中布防已开启关闭闭合点击返还回目标温度开合比例色温柔光舒适' +
  '强冷睡眠待机全微启半分钟取消未设定执行照明离家节能门窗传感待命切换锁定网络' +
  '连接断开当前仅作本地状态记录';

export class FontAtlas {
  constructor(gl) {
    this.gl = gl;
    this.size = ATLAS_SIZE;

    // 离屏烘焙画布
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.fillStyle = '#ffffff';

    // 货架式矩形打包游标
    this.cursorX = CELL_PAD;
    this.cursorY = CELL_PAD;
    this.rowHeight = 0;

    // 字形查找表：key = `${weight}:${char}`
    this.glyphs = new Map();

    // 创建 WebGL 共享纹理
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 预烘焙常用字形并一次性上传整张纹理
    this._bakeBatch(PRELOAD_CHARS, 'regular');
    this._bakeBatch('0123456789.:°%OFF明亮温馨酷炫熄灯客厅主卧全屋窗帘中央空调居家警戒布防中 ', 'light');
    this.uploadFull();
  }

  _fontString(weight) {
    const w = weight === 'light' ? '300' : '500';
    return `${w} ${BAKE_FONT_SIZE}px ${FONT_FAMILY}`;
  }

  _bakeBatch(chars, weight) {
    for (let i = 0; i < chars.length; i++) {
      this._bakeGlyph(chars[i], weight, false);
    }
  }

  /**
   * 烘焙单个纯白字形，返回字形 UV 与度量信息
   */
  _bakeGlyph(ch, weight = 'regular', incrementalUpload = true) {
    const key = `${weight}:${ch}`;
    const cached = this.glyphs.get(key);
    if (cached) return cached;

    const ctx = this.ctx;
    ctx.font = this._fontString(weight);
    const metrics = ctx.measureText(ch);
    const advance = Math.max(metrics.width, BAKE_FONT_SIZE * 0.28);

    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || BAKE_FONT_SIZE * 0.82);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || BAKE_FONT_SIZE * 0.22);
    const leftPad = Math.ceil(Math.max(0, metrics.actualBoundingBoxLeft || 0)) + 3;
    const rightPad = Math.ceil(Math.max(advance, metrics.actualBoundingBoxRight || advance)) + 3;

    const gw = Math.max(4, leftPad + rightPad);
    const gh = Math.max(8, ascent + descent + 6);

    if (this.cursorX + gw + CELL_PAD > ATLAS_SIZE) {
      this.cursorX = CELL_PAD;
      this.cursorY += this.rowHeight + CELL_PAD;
      this.rowHeight = 0;
    }

    // 图集空间耗尽保护：退回空格度量，避免越界报错
    if (this.cursorY + gh + CELL_PAD > ATLAS_SIZE) {
      return this.glyphs.get('regular: ') || null;
    }

    const x = this.cursorX;
    const y = this.cursorY;
    const baselineY = y + ascent + 3;

    ctx.clearRect(x, y, gw, gh);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, x + leftPad, baselineY);

    const glyph = {
      u0: x / ATLAS_SIZE,
      v0: y / ATLAS_SIZE,
      u1: (x + gw) / ATLAS_SIZE,
      v1: (y + gh) / ATLAS_SIZE,
      w: gw,
      h: gh,
      xOffset: -leftPad,
      yOffset: -(ascent + 3),
      advance
    };

    this.glyphs.set(key, glyph);
    this.cursorX += gw + CELL_PAD;
    if (gh > this.rowHeight) this.rowHeight = gh;

    if (incrementalUpload) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    }

    return glyph;
  }

  /** 将整张共享图集一次性上传到 GPU */
  uploadFull() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
  }

  /** 获取字形（按需自动回退烘焙） */
  getGlyph(ch, weight = 'regular') {
    const key = `${weight}:${ch}`;
    return this.glyphs.get(key) || this._bakeGlyph(ch, weight, true);
  }

  /** 测量文本在目标字号下的逻辑宽度 */
  measureText(text, fontSize, weight = 'regular', letterSpacing = 0) {
    const scale = fontSize / BAKE_FONT_SIZE;
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const g = this.getGlyph(text[i], weight);
      if (g) width += g.advance * scale;
      if (i < text.length - 1) width += letterSpacing;
    }
    return width;
  }

  /**
   * 将文本拆解为四边形顶点压入渲染器的文字批处理缓冲
   * @param {object} renderer WebGL 批处理渲染器
   * @param {string} text 待绘制文本
   * @param {number} x 逻辑 X 坐标
   * @param {number} y 逻辑垂直中心或基线 Y 坐标（默认按视觉中线对齐）
   * @param {number} fontSize 逻辑字号
   * @param {'left'|'center'|'right'} align 水平对齐方式
   * @param {number[]} color RGBA 颜色数组
   * @param {number} alpha 额外透明度倍率
   * @param {'regular'|'light'} weight 字重
   * @param {number} letterSpacing 字间距
   */
  drawText(renderer, text, x, y, fontSize, align, color, alpha = 1, weight = 'regular', letterSpacing = 0) {
    if (!text || alpha <= 0.003) return;
    const scale = fontSize / BAKE_FONT_SIZE;
    let penX = x;
    if (align === 'center' || align === 'right') {
      const totalW = this.measureText(text, fontSize, weight, letterSpacing);
      penX = align === 'center' ? x - totalW * 0.5 : x - totalW;
    }

    // 将 y 视为视觉中心线，换算到文字基线
    const baselineY = y + fontSize * 0.34;
    const r = color[0];
    const g = color[1];
    const b = color[2];
    const a = color[3] * alpha;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const glyph = this.getGlyph(ch, weight);
      if (!glyph) continue;
      if (ch !== ' ') {
        const x0 = penX + glyph.xOffset * scale;
        const y0 = baselineY + glyph.yOffset * scale;
        const x1 = x0 + glyph.w * scale;
        const y1 = y0 + glyph.h * scale;
        renderer.pushTextQuad(x0, y0, x1, y1, glyph.u0, glyph.v0, glyph.u1, glyph.v1, r, g, b, a);
      }
      penX += glyph.advance * scale + letterSpacing;
    }
  }
}
