/**
 * AETHER · 极简触屏版 WebGL 斜切色块与建筑线条背景引擎
 * 设计约束：
 * 1. 彻底移除鼠标跟随交互，专注触屏中控的静谧建筑氛围
 * 2. WebGL 渲染大面积缓慢漂移的白灰斜切多边形色块
 * 3. Canvas 2D 绘制与前景七巧板同斜率（-0.32）的极细建筑斜线、触点波纹与转场扫光
 */
(function () {
  'use strict';

  const SCENE_PALETTES = {
    bright: {
      base: [0.945, 0.955, 0.968],
      blockA: [0.892, 0.908, 0.932],
      blockB: [0.848, 0.868, 0.898],
      accent: [0.992, 0.996, 1.000],
      lineColor: [38, 48, 64],
      lineAlpha: 0.08,
      speed: 0.22
    },
    cool: {
      base: [0.043, 0.051, 0.082],
      blockA: [0.195, 0.038, 0.115],
      blockB: [0.025, 0.155, 0.210],
      accent: [0.240, 0.205, 0.035],
      lineColor: [0, 240, 255],
      lineAlpha: 0.16,
      speed: 0.34
    },
    warm: {
      base: [0.948, 0.938, 0.922],
      blockA: [0.900, 0.884, 0.862],
      blockB: [0.858, 0.836, 0.808],
      accent: [0.994, 0.985, 0.970],
      lineColor: [84, 70, 56],
      lineAlpha: 0.08,
      speed: 0.18
    },
    night: {
      base: [0.092, 0.106, 0.130],
      blockA: [0.125, 0.142, 0.172],
      blockB: [0.156, 0.176, 0.210],
      accent: [0.200, 0.224, 0.264],
      lineColor: [210, 222, 240],
      lineAlpha: 0.07,
      speed: 0.14
    }
  };

  const VERTEX_SHADER = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    precision mediump float;
    varying vec2 v_uv;

    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_cam;
    uniform vec3 u_base;
    uniform vec3 u_blockA;
    uniform vec3 u_blockB;
    uniform vec3 u_accent;

    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    float sdPolygon(vec2 p, float r, float sides, float skew) {
      p.x += p.y * skew;
      float an = 6.2831853 / sides;
      float he = r * tan(0.5 * an);
      float a = atan(p.y, p.x);
      float id = floor((a + 0.5 * an) / an);
      p = rot(-id * an) * p;
      p.y = abs(p.y) - he;
      return length(max(p, vec2(0.0))) + min(max(p.x - r, p.y), 0.0);
    }

    void main() {
      vec2 aspect = vec2(u_res.x / max(u_res.y, 1.0), 1.0);
      vec2 p = (v_uv - 0.5) * aspect + u_cam;
      float t = u_time;
      float breath = 0.5 + 0.5 * sin(t * 1.1);

      vec3 col = mix(u_base, u_accent, smoothstep(-0.7, 0.8, p.y * 0.65 - p.x * 0.4) * 0.5);

      // 3 块大面积克制的斜切白灰色块，去除逐像素噪声计算降低移动 GPU 功耗
      vec2 p1 = p - vec2(-0.52 + sin(t * 0.24) * 0.04, 0.22 + cos(t * 0.19) * 0.04);
      p1 = rot(0.32 + t * 0.025) * p1;
      float d1 = sdPolygon(p1, 0.48 + breath * 0.015, 3.0, 0.14);
      col = mix(col, u_blockA, (1.0 - smoothstep(-0.004, 0.008, d1)) * 0.62);

      vec2 p2 = p - vec2(0.56 + cos(t * 0.20) * 0.05, -0.26 + sin(t * 0.22) * 0.04);
      p2 = rot(-0.32 - t * 0.02) * p2;
      float d2 = sdPolygon(p2, 0.52 - breath * 0.014, 4.0, -0.22);
      col = mix(col, u_blockB, (1.0 - smoothstep(-0.005, 0.01, d2)) * 0.52);

      vec2 p3 = p - vec2(0.10 + sin(t * 0.28) * 0.06, 0.42);
      p3 = rot(0.95 + t * 0.03) * p3;
      float d3 = sdPolygon(p3, 0.30, 3.0, -0.12);
      col = mix(col, u_accent, (1.0 - smoothstep(-0.01, 0.025, d3)) * 0.45);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpVec3(cur, target, t) {
    cur[0] = lerp(cur[0], target[0], t);
    cur[1] = lerp(cur[1], target[1], t);
    cur[2] = lerp(cur[2], target[2], t);
  }

  function createEngine() {
    const glCanvas = document.getElementById('webgl-bg');
    const lineCanvas = document.getElementById('lines-bg');
    if (!glCanvas || !lineCanvas) return null;

    const ctx = lineCanvas.getContext('2d');
    const gl = glCanvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'low-power' })
      || glCanvas.getContext('experimental-webgl');

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const camTarget = { x: 0, y: 0 };
    const camCurrent = { x: 0, y: 0 };

    let targetPalette = SCENE_PALETTES.bright;
    const cur = {
      base: [...SCENE_PALETTES.bright.base],
      blockA: [...SCENE_PALETTES.bright.blockA],
      blockB: [...SCENE_PALETTES.bright.blockB],
      accent: [...SCENE_PALETTES.bright.accent],
      lineColor: [...SCENE_PALETTES.bright.lineColor],
      lineAlpha: SCENE_PALETTES.bright.lineAlpha,
      speed: SCENE_PALETTES.bright.speed
    };

    let program = null;
    let uniforms = null;
    if (gl) {
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          gl.deleteShader(s);
          return null;
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (vs && fs) {
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.useProgram(program);
          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
          const loc = gl.getAttribLocation(program, 'a_pos');
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

          uniforms = {
            res: gl.getUniformLocation(program, 'u_res'),
            time: gl.getUniformLocation(program, 'u_time'),
            cam: gl.getUniformLocation(program, 'u_cam'),
            base: gl.getUniformLocation(program, 'u_base'),
            blockA: gl.getUniformLocation(program, 'u_blockA'),
            blockB: gl.getUniformLocation(program, 'u_blockB'),
            accent: gl.getUniformLocation(program, 'u_accent')
          };
        } else {
          program = null;
        }
      }
    }

    const pulses = [];
    const sweeps = [];

    function triggerPulse(x, y) {
      pulses.push({
        x: typeof x === 'number' ? x : width * 0.5,
        y: typeof y === 'number' ? y : height * 0.5,
        r: 18,
        maxR: Math.max(width, height) * 0.34,
        alpha: 0.28,
        rot: -Math.PI * 0.5
      });
    }

    function triggerSweep() {
      sweeps.push({ p: 0 });
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      // 移动端低温降采样：柔和背景色块用 0.7x 渲染、线条层用 1x 渲染，像素填充量下降 80%+
      const glScale = 0.7;
      glCanvas.width = Math.max(1, Math.floor(width * glScale));
      glCanvas.height = Math.max(1, Math.floor(height * glScale));
      lineCanvas.width = Math.max(1, Math.floor(width));
      lineCanvas.height = Math.max(1, Math.floor(height));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (gl && program) gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
    }
    resize();

    let simTime = 0;
    let lastTs = performance.now();
    let lastRenderTs = 0;
    let rafId = null;

    /** 页面切到后台或锁屏时自动停止渲染，回到前台无缝恢复 */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else if (!rafId) {
        lastTs = performance.now();
        lastRenderTs = 0;
        rafId = requestAnimationFrame(tick);
      }
    });

    function renderLines(dt) {
      ctx.clearRect(0, 0, width, height);

      const r = Math.round(cur.lineColor[0]);
      const g = Math.round(cur.lineColor[1]);
      const b = Math.round(cur.lineColor[2]);
      const alpha = cur.lineAlpha;

      // 极简平行斜线（与前景七巧板保持同一 -0.32 斜率，缓慢漂移）
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1;
      const gap = 210;
      const offset = (simTime * 16 - camCurrent.x * 320) % gap;
      ctx.beginPath();
      for (let x = -height * 0.4 + offset; x < width + height * 0.5; x += gap) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x - height * 0.32, height);
      }
      ctx.stroke();

      // 触控反馈波纹（极简空心六边形）
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.r += (p.maxR - p.r) * Math.min(1, dt * 3.8);
        p.alpha *= Math.pow(0.06, dt);
        if (p.alpha < 0.008) {
          pulses.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const ang = p.rot + (k * Math.PI * 2) / 6;
          const px = p.x + Math.cos(ang) * p.r;
          const py = p.y + Math.sin(ang) * p.r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // 转场斜线扫光
      for (let i = sweeps.length - 1; i >= 0; i--) {
        const s = sweeps[i];
        s.p += dt * 1.9;
        if (s.p >= 1) {
          sweeps.splice(i, 1);
          continue;
        }
        const sa = Math.sin(s.p * Math.PI) * 0.22;
        const xPos = -width * 0.15 + s.p * width * 1.45;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${sa})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos - height * 0.32, height);
        ctx.stroke();
      }
    }

    function tick(now) {
      rafId = requestAnimationFrame(tick);

      // 智能动态限帧：静态巡航锁定 26fps 低温省电，有触控波纹或转场扫光时自动升至 60fps
      const hasBurst = pulses.length > 0 || sweeps.length > 0;
      const minInterval = hasBurst ? 16 : 38;
      if (now - lastRenderTs < minInterval) return;
      lastRenderTs = now;

      const dt = Math.min((now - lastTs) / 1000, 0.08);
      lastTs = now;

      const camK = 1 - Math.exp(-dt * 3.6);
      camCurrent.x = lerp(camCurrent.x, camTarget.x, camK);
      camCurrent.y = lerp(camCurrent.y, camTarget.y, camK);

      const colK = 1 - Math.exp(-dt * 2.4);
      lerpVec3(cur.base, targetPalette.base, colK);
      lerpVec3(cur.blockA, targetPalette.blockA, colK);
      lerpVec3(cur.blockB, targetPalette.blockB, colK);
      lerpVec3(cur.accent, targetPalette.accent, colK);
      lerpVec3(cur.lineColor, targetPalette.lineColor, colK);
      cur.lineAlpha = lerp(cur.lineAlpha, targetPalette.lineAlpha, colK);
      cur.speed = lerp(cur.speed, targetPalette.speed, colK);

      simTime += dt * cur.speed * 2.4;

      if (gl && program && uniforms) {
        gl.uniform2f(uniforms.res, glCanvas.width, glCanvas.height);
        gl.uniform1f(uniforms.time, simTime);
        gl.uniform2f(uniforms.cam, camCurrent.x, camCurrent.y);
        gl.uniform3fv(uniforms.base, cur.base);
        gl.uniform3fv(uniforms.blockA, cur.blockA);
        gl.uniform3fv(uniforms.blockB, cur.blockB);
        gl.uniform3fv(uniforms.accent, cur.accent);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      renderLines(dt);
    }

    rafId = requestAnimationFrame(tick);

    return {
      setScene(id) {
        if (SCENE_PALETTES[id]) targetPalette = SCENE_PALETTES[id];
      },
      setCameraShift(x, y) {
        camTarget.x = x || 0;
        camTarget.y = y || 0;
      },
      triggerPulse,
      triggerSweep
    };
  }

  window.AetherBG = createEngine();
})();
