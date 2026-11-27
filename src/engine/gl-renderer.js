/**
 * AETHER WebGL 2.0 · 极简批处理渲染引擎（整帧仅 2 次 DrawCall）
 * Pass 1：全量几何体（背景色块、斜线、3D 挤出底座、陶瓷渐变表面、呼吸微光、发丝描边、同心三角、触控波纹）
 * Pass 2：全量文字（绑定单张纯白共享纹理图集，着色器实时染色与淡入淡出）
 */

const MAX_GEO_VERTS = 18000;
const GEO_STRIDE = 6; // x, y, r, g, b, a

const MAX_TEXT_VERTS = 14000;
const TEXT_STRIDE = 8; // x, y, u, v, r, g, b, a

const GEO_VS = `#version 300 es
precision mediump float;
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec4 a_color;
uniform vec2 u_res;
out vec4 v_color;
void main() {
  vec2 ndc = (a_pos / u_res) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_color = a_color;
}
`;

const GEO_FS = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`;

const TEXT_VS = `#version 300 es
precision mediump float;
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_color;
uniform vec2 u_res;
out vec2 v_uv;
out vec4 v_color;
void main() {
  vec2 ndc = (a_pos / u_res) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_uv = a_uv;
  v_color = a_color;
}
`;

const TEXT_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_atlas;
in vec2 v_uv;
in vec4 v_color;
out vec4 outColor;
void main() {
  // 共享图集为纯白预乘纹理，直接取 alpha 通道交由着色器着色，避免边缘黑边
  float mask = texture(u_atlas, v_uv).a;
  float a = mask * v_color.a;
  outColor = vec4(v_color.rgb * a, a);
}
`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`WebGL 着色器编译失败: ${err}`);
  }
  return s;
}

function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`WebGL 着色器链接失败: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

export class GLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power'
    });
    if (!gl) {
      throw new Error('当前设备不支持 WebGL 2.0');
    }
    this.gl = gl;
    this.width = 1;
    this.height = 1;

    // 编译两套极简着色器
    this.geoProg = createProgram(gl, GEO_VS, GEO_FS);
    this.geoResLoc = gl.getUniformLocation(this.geoProg, 'u_res');

    this.textProg = createProgram(gl, TEXT_VS, TEXT_FS);
    this.textResLoc = gl.getUniformLocation(this.textProg, 'u_res');
    this.textAtlasLoc = gl.getUniformLocation(this.textProg, 'u_atlas');

    // 预分配静态浮点顶点缓冲（运行期零 GC）
    this.geoData = new Float32Array(MAX_GEO_VERTS * GEO_STRIDE);
    this.geoCount = 0;
    this.geoVao = gl.createVertexArray();
    this.geoVbo = gl.createBuffer();
    gl.bindVertexArray(this.geoVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.geoVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.geoData.byteLength, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, GEO_STRIDE * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, GEO_STRIDE * 4, 8);

    this.textData = new Float32Array(MAX_TEXT_VERTS * TEXT_STRIDE);
    this.textCount = 0;
    this.textVao = gl.createVertexArray();
    this.textVbo = gl.createBuffer();
    gl.bindVertexArray(this.textVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.textData.byteLength, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, TEXT_STRIDE * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, TEXT_STRIDE * 4, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, TEXT_STRIDE * 4, 16);

    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 舞台坐标变换（用于一键将舞台逻辑坐标映射到视口 CSS 像素）
    this.tx = 0;
    this.ty = 0;
    this.ts = 1;
    this.drawCallsLastFrame = 0;
  }

  /** 调整画布物理分辨率（限制 dpr 上限兼顾 iPad mini 4 清晰度与带宽） */
  resize(cssWidth, cssHeight, maxDpr = 2) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.width = cssWidth;
    this.height = cssHeight;
    const pw = Math.max(1, Math.round(cssWidth * dpr));
    const ph = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.gl.viewport(0, 0, pw, ph);
  }

  /** 设置当前坐标系变换（全屏背景用 identity，舞台 UI 用弹性等比变换） */
  setTransform(offsetX, offsetY, scale) {
    this.tx = offsetX;
    this.ty = offsetY;
    this.ts = scale;
  }

  /** 开始新帧并重置批处理计数 */
  beginFrame(clearColor) {
    const gl = this.gl;
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.geoCount = 0;
    this.textCount = 0;
    this.tx = 0;
    this.ty = 0;
    this.ts = 1;
  }

  _pushGeoVert(x, y, r, g, b, a) {
    const idx = this.geoCount * GEO_STRIDE;
    this.geoData[idx] = this.tx + x * this.ts;
    this.geoData[idx + 1] = this.ty + y * this.ts;
    this.geoData[idx + 2] = r;
    this.geoData[idx + 3] = g;
    this.geoData[idx + 4] = b;
    this.geoData[idx + 5] = a;
    this.geoCount++;
  }

  /** 填充纯色凸多边形（扇形三角剖分） */
  fillPolySolid(points, color, alpha = 1, dx = 0, dy = 0) {
    const n = points.length;
    if (n < 3 || alpha <= 0.002) return;
    if (this.geoCount + (n - 2) * 3 > MAX_GEO_VERTS) return;

    const r = color[0], g = color[1], b = color[2], a = color[3] * alpha;
    const x0 = points[0][0] + dx;
    const y0 = points[0][1] + dy;
    for (let i = 1; i < n - 1; i++) {
      this._pushGeoVert(x0, y0, r, g, b, a);
      this._pushGeoVert(points[i][0] + dx, points[i][1] + dy, r, g, b, a);
      this._pushGeoVert(points[i + 1][0] + dx, points[i + 1][1] + dy, r, g, b, a);
    }
  }

  /** 填充 145° 对角陶瓷渐变凸多边形（纯顶点色插值，零纹理采样） */
  fillPolyGradient(points, colA, colB, alpha = 1, dx = 0, dy = 0) {
    const n = points.length;
    if (n < 3 || alpha <= 0.002) return;
    if (this.geoCount + (n - 2) * 3 > MAX_GEO_VERTS) return;

    // 计算沿 145° 对角方向的投影区间
    let minP = Infinity, maxP = -Infinity;
    for (let i = 0; i < n; i++) {
      const proj = points[i][0] * 0.65 + points[i][1] * 0.76;
      if (proj < minP) minP = proj;
      if (proj > maxP) maxP = proj;
    }
    const span = Math.max(maxP - minP, 1);

    const calcColor = (px, py) => {
      const t = (px * 0.65 + py * 0.76 - minP) / span;
      return [
        colA[0] + (colB[0] - colA[0]) * t,
        colA[1] + (colB[1] - colA[1]) * t,
        colA[2] + (colB[2] - colA[2]) * t,
        (colA[3] + (colB[3] - colA[3]) * t) * alpha
      ];
    };

    const c0 = calcColor(points[0][0], points[0][1]);
    const x0 = points[0][0] + dx;
    const y0 = points[0][1] + dy;

    for (let i = 1; i < n - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const c1 = calcColor(p1[0], p1[1]);
      const c2 = calcColor(p2[0], p2[1]);

      this._pushGeoVert(x0, y0, c0[0], c0[1], c0[2], c0[3]);
      this._pushGeoVert(p1[0] + dx, p1[1] + dy, c1[0], c1[1], c1[2], c1[3]);
      this._pushGeoVert(p2[0] + dx, p2[1] + dy, c2[0], c2[1], c2[2], c2[3]);
    }
  }

  /** 填充纯色矩形 */
  fillRect(x, y, w, h, color, alpha = 1) {
    if (w <= 0 || h <= 0 || alpha <= 0.002) return;
    if (this.geoCount + 6 > MAX_GEO_VERTS) return;
    const r = color[0], g = color[1], b = color[2], a = color[3] * alpha;
    this._pushGeoVert(x, y, r, g, b, a);
    this._pushGeoVert(x + w, y, r, g, b, a);
    this._pushGeoVert(x + w, y + h, r, g, b, a);
    this._pushGeoVert(x, y, r, g, b, a);
    this._pushGeoVert(x + w, y + h, r, g, b, a);
    this._pushGeoVert(x, y + h, r, g, b, a);
  }

  /**
   * 绘制严格裁切在多边形内部的角点呼吸辉光（零溢出、零多边形折边、仅需 n-2 个三角形）
   * 以多边形右上角（最大 x - y 方向）为光晕峰值，平滑衰减至对角 0 透明度
   */
  fillPolyCornerGlow(points, color, alpha = 1, dx = 0, dy = 0) {
    const n = points.length;
    if (n < 3 || alpha <= 0.002) return;
    if (this.geoCount + (n - 2) * 3 > MAX_GEO_VERTS) return;

    let minP = Infinity, maxP = -Infinity;
    for (let i = 0; i < n; i++) {
      const proj = points[i][0] * 0.72 - points[i][1] * 0.69;
      if (proj < minP) minP = proj;
      if (proj > maxP) maxP = proj;
    }
    const span = Math.max(maxP - minP, 1);
    const r = color[0], g = color[1], b = color[2], baseA = color[3] * alpha;

    const vertAlpha = (px, py) => {
      const t = Math.max(0, Math.min(1, (px * 0.72 - py * 0.69 - minP) / span));
      // 二次平滑衰减，让辉光柔和聚焦在右上象限
      return baseA * t * t;
    };

    const a0 = vertAlpha(points[0][0], points[0][1]);
    const x0 = points[0][0] + dx;
    const y0 = points[0][1] + dy;

    for (let i = 1; i < n - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      this._pushGeoVert(x0, y0, r, g, b, a0);
      this._pushGeoVert(p1[0] + dx, p1[1] + dy, r, g, b, vertAlpha(p1[0], p1[1]));
      this._pushGeoVert(p2[0] + dx, p2[1] + dy, r, g, b, vertAlpha(p2[0], p2[1]));
    }
  }

  /** 绘制实心正多边形/圆点 */
  fillRegularPoly(cx, cy, radius, sides, rotation, color, alpha = 1) {
    if (alpha <= 0.002 || this.geoCount + sides * 3 > MAX_GEO_VERTS) return;
    const r = color[0], g = color[1], b = color[2], a = color[3] * alpha;
    for (let i = 0; i < sides; i++) {
      const a0 = rotation + (i / sides) * Math.PI * 2;
      const a1 = rotation + ((i + 1) / sides) * Math.PI * 2;
      this._pushGeoVert(cx, cy, r, g, b, a);
      this._pushGeoVert(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, r, g, b, a);
      this._pushGeoVert(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, r, g, b, a);
    }
  }

  /**
   * 用细长带状三角面（Ribbon）绘制任意宽度折线或闭合多边形描边
   * 绕过 iOS WebGL gl.lineWidth 恒为 1px 的限制，并与填充面共享同一次 DrawCall
   */
  strokePolyline(points, closed, lineWidth, color, alpha = 1, dx = 0, dy = 0) {
    const n = points.length;
    if (n < 2 || alpha <= 0.002) return;
    const segCount = closed ? n : n - 1;
    if (this.geoCount + segCount * 6 > MAX_GEO_VERTS) return;

    const hw = lineWidth * 0.5;
    const r = color[0], g = color[1], b = color[2], a = color[3] * alpha;

    for (let i = 0; i < segCount; i++) {
      const p0 = points[i];
      const p1 = points[(i + 1) % n];
      const x0 = p0[0] + dx, y0 = p0[1] + dy;
      const x1 = p1[0] + dx, y1 = p1[1] + dy;
      const vx = x1 - x0, vy = y1 - y0;
      const len = Math.hypot(vx, vy);
      if (len < 0.001) continue;
      const nx = (-vy / len) * hw;
      const ny = (vx / len) * hw;

      this._pushGeoVert(x0 + nx, y0 + ny, r, g, b, a);
      this._pushGeoVert(x1 + nx, y1 + ny, r, g, b, a);
      this._pushGeoVert(x1 - nx, y1 - ny, r, g, b, a);
      this._pushGeoVert(x0 + nx, y0 + ny, r, g, b, a);
      this._pushGeoVert(x1 - nx, y1 - ny, r, g, b, a);
      this._pushGeoVert(x0 - nx, y0 - ny, r, g, b, a);
    }
  }

  /** 压入单个文字字形四边形（由 FontAtlas 调用） */
  pushTextQuad(x0, y0, x1, y1, u0, v0, u1, v1, r, g, b, a) {
    if (this.textCount + 6 > MAX_TEXT_VERTS) return;
    const sx0 = this.tx + x0 * this.ts;
    const sy0 = this.ty + y0 * this.ts;
    const sx1 = this.tx + x1 * this.ts;
    const sy1 = this.ty + y1 * this.ts;

    const d = this.textData;
    let o = this.textCount * TEXT_STRIDE;

    // 三角形 1
    d[o++] = sx0; d[o++] = sy0; d[o++] = u0; d[o++] = v0; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = sx1; d[o++] = sy0; d[o++] = u1; d[o++] = v0; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = sx1; d[o++] = sy1; d[o++] = u1; d[o++] = v1; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;

    // 三角形 2
    d[o++] = sx0; d[o++] = sy0; d[o++] = u0; d[o++] = v0; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = sx1; d[o++] = sy1; d[o++] = u1; d[o++] = v1; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;
    d[o++] = sx0; d[o++] = sy1; d[o++] = u0; d[o++] = v1; d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a;

    this.textCount += 6;
  }

  /** 提交整帧渲染（恒定 <= 2 次 DrawCall） */
  flush(fontAtlas) {
    const gl = this.gl;
    let calls = 0;

    // Pass 1：全量几何体（1 次 DrawCall）
    if (this.geoCount > 0) {
      gl.useProgram(this.geoProg);
      gl.uniform2f(this.geoResLoc, this.width, this.height);
      gl.bindVertexArray(this.geoVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.geoVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.geoData.subarray(0, this.geoCount * GEO_STRIDE));
      gl.drawArrays(gl.TRIANGLES, 0, this.geoCount);
      calls++;
    }

    // Pass 2：全量共享白色图集文字（1 次 DrawCall）
    if (this.textCount > 0 && fontAtlas) {
      gl.useProgram(this.textProg);
      gl.uniform2f(this.textResLoc, this.width, this.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fontAtlas.texture);
      gl.uniform1i(this.textAtlasLoc, 0);
      gl.bindVertexArray(this.textVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.textVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.textData.subarray(0, this.textCount * TEXT_STRIDE));
      gl.drawArrays(gl.TRIANGLES, 0, this.textCount);
      calls++;
    }

    gl.bindVertexArray(null);
    this.drawCallsLastFrame = calls;
  }
}
