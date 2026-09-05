import { useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const VERT = `#version 300 es
precision mediump float;
layout(location = 0) in vec4 a_pos;
out vec2 v_uv;
void main() {
  gl_Position = a_pos;
  v_uv = a_pos.xy * 0.5 + 0.5;
}`;

const TRAIL_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D u_prev;
uniform vec2      u_mouse;
uniform float     u_aspect;
in  vec2 v_uv;
out vec4 fragColor;
void main() {
  float prev = texture(u_prev, v_uv).r;
  vec2 mouseUV = vec2(u_mouse.x, 1.0 - u_mouse.y);
  vec2 diff    = v_uv - mouseUV;
  diff.x      *= u_aspect;
  float raw    = smoothstep(0.20, 0.0, length(diff));
  float brush  = raw * raw;
  fragColor = vec4(max(prev * 0.990, brush), 0.0, 0.0, 1.0);
}`;

// Colors are now uniforms — driven from JS per color mode
const MAIN_FRAG = `#version 300 es
precision mediump float;
uniform float     u_time;
uniform vec2      u_res;
uniform float     u_dpr;
uniform sampler2D u_trail;
uniform vec3      u_back;
uniform vec3      u_mid;
uniform vec3      u_front;
in  vec2 v_uv;
out vec4 fragColor;

vec2 rot2(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c*p.x - s*p.y, s*p.x + c*p.y);
}

float neuroNoise(vec2 p, float t) {
  vec2 acc = vec2(0.0), res = vec2(0.0);
  float sc = 8.0;
  for (int i = 0; i < 15; i++) {
    p   = rot2(p,   1.0);
    acc = rot2(acc, 1.0);
    vec2 lyr = p * sc + float(i) + acc - t;
    acc += sin(lyr);
    res += (0.5 + 0.5 * cos(lyr)) / sc;
    sc  *= 1.2;
  }
  return res.x + res.y;
}

void main() {
  float fog = texture(u_trail, v_uv).r;
  vec2 shape = (v_uv - 0.5) * u_res / u_dpr * 0.0013;
  shape *= 1.0 + fog * 0.09;
  float n = neuroNoise(shape, u_time);
  float bright   = 0.14 + fog * 0.045;
  float contrast = 0.26 - fog * 0.12;
  n = (1.0 + bright) * n * n;
  n = pow(n, 0.7 + 6.0 * contrast);
  n = min(1.4, n);
  float blend = smoothstep(0.7, 1.4, n);
  float sn    = max(n, 0.0);
  vec3  col   = mix(u_mid, u_front, blend) * sn
              + u_back * (1.0 - clamp(sn, 0.0, 1.0));
  col += (1.0/256.0) * (fract(
    sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453
  ) - 0.5);
  fragColor = vec4(col, 1.0);
}`;

function buildProg(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('[GlassBG]', gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER,   vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    console.error('[GlassBG]', gl.getProgramInfoLog(p));
  return p;
}

function makeFBO(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

// ── Per-mode config ────────────────────────────────────────────────────────────

const THEME_CONFIGS = {
  dark: {
    back:     [0.020, 0.051, 0.110],   // #050d1c
    mid:      [0.051, 0.122, 0.235],   // #0d1f3c
    front:    [0.086, 0.176, 0.322],   // #162d52
    fallback: '#050d1c',
    glows: [
      'radial-gradient(ellipse 70% 55% at 15% 25%, rgba(40,80,210,.10) 0%,transparent 100%)',
      'radial-gradient(ellipse 55% 65% at 85% 75%, rgba(60,50,210,.08) 0%,transparent 100%)',
    ].join(','),
    vignettes: [
      'radial-gradient(ellipse 100% 28% at 50% 0%,   rgba(3,8,20,.88) 0%,transparent 100%)',
      'radial-gradient(ellipse 100% 32% at 50% 100%, rgba(3,8,20,.90) 0%,transparent 100%)',
      'radial-gradient(ellipse 20% 100% at 0%   50%, rgba(3,8,20,.35) 0%,transparent 100%)',
      'radial-gradient(ellipse 20% 100% at 100% 50%, rgba(3,8,20,.35) 0%,transparent 100%)',
    ].join(','),
  },
  light: {
    back:     [0.941, 0.957, 0.973],   // #f0f4f8 — lightest (valleys)
    mid:      [0.702, 0.780, 0.867],   // #b3c7dd — mid ridge, more saturated
    front:    [0.510, 0.635, 0.765],   // #82a2c3 — deepest ridge, real contrast to refract through glass
    fallback: '#f0f4f8',
    glows: [
      'radial-gradient(ellipse 70% 55% at 15% 25%, rgba(37,99,235,.16) 0%,transparent 100%)',
      'radial-gradient(ellipse 55% 65% at 85% 75%, rgba(99,102,241,.13) 0%,transparent 100%)',
    ].join(','),
    vignettes: [
      'radial-gradient(ellipse 100% 28% at 50% 0%,   rgba(224,231,240,.80) 0%,transparent 100%)',
      'radial-gradient(ellipse 100% 32% at 50% 100%, rgba(224,231,240,.85) 0%,transparent 100%)',
      'radial-gradient(ellipse 20% 100% at 0%   50%, rgba(224,231,240,.30) 0%,transparent 100%)',
      'radial-gradient(ellipse 20% 100% at 100% 50%, rgba(224,231,240,.30) 0%,transparent 100%)',
    ].join(','),
  },
  custom: {
    back:     [0.992, 0.973, 0.945],   // #fdf8f1 — warm cream (valleys)
    mid:      [0.925, 0.792, 0.604],   // #ecca9a — warm tan ridge, more saturated
    front:    [0.812, 0.596, 0.337],   // #cf9856 — deep amber ridge, real contrast to refract through glass
    fallback: '#fdf8f1',
    glows: [
      'radial-gradient(ellipse 70% 55% at 20% 30%, rgba(249,115,22,.20) 0%,transparent 100%)',
      'radial-gradient(ellipse 55% 65% at 80% 70%, rgba(234,88,12,.15) 0%,transparent 100%)',
      'radial-gradient(ellipse 40% 40% at 50% 50%, rgba(251,191,36,.12) 0%,transparent 100%)',
    ].join(','),
    vignettes: [
      'radial-gradient(ellipse 100% 28% at 50% 0%,   rgba(253,248,241,.85) 0%,transparent 100%)',
      'radial-gradient(ellipse 100% 32% at 50% 100%, rgba(253,248,241,.88) 0%,transparent 100%)',
      'radial-gradient(ellipse 20% 100% at 0%   50%, rgba(253,248,241,.30) 0%,transparent 100%)',
      'radial-gradient(ellipse 20% 100% at 100% 50%, rgba(253,248,241,.30) 0%,transparent 100%)',
    ].join(','),
  },
};

// ── Animated background — mounts once per colorMode (key prop forces remount) ─

const TRAIL_SIZE = 512;
const QUAD       = new Float32Array([-1,-1, 1,-1, 1,1, -1,1]);

const AnimatedBackground = ({ config }) => {
  const canvasRef      = useRef(null);
  const mouseRef       = useRef(new Float32Array([0.5, 0.5]));
  const smoothMouseRef = useRef(new Float32Array([0.5, 0.5]));

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    const gl     = canvas.getContext('webgl2', {
      alpha: false, antialias: false, powerPreference: 'low-power',
    });
    if (!gl) return;

    const trailProg = buildProg(gl, VERT, TRAIL_FRAG);
    const mainProg  = buildProg(gl, VERT, MAIN_FRAG);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const fboA = makeFBO(gl, TRAIL_SIZE, TRAIL_SIZE);
    const fboB = makeFBO(gl, TRAIL_SIZE, TRAIL_SIZE);

    gl.clearColor(0, 0, 0, 1);
    [fboA, fboB].forEach(({ fbo }) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(trailProg);
    const tPrev   = gl.getUniformLocation(trailProg, 'u_prev');
    const tMouse  = gl.getUniformLocation(trailProg, 'u_mouse');
    const tAspect = gl.getUniformLocation(trailProg, 'u_aspect');
    gl.uniform1i(tPrev, 0);

    gl.useProgram(mainProg);
    const mTime  = gl.getUniformLocation(mainProg, 'u_time');
    const mRes   = gl.getUniformLocation(mainProg, 'u_res');
    const mDpr   = gl.getUniformLocation(mainProg, 'u_dpr');
    const mTrail = gl.getUniformLocation(mainProg, 'u_trail');
    const mBack  = gl.getUniformLocation(mainProg, 'u_back');
    const mMid   = gl.getUniformLocation(mainProg, 'u_mid');
    const mFront = gl.getUniformLocation(mainProg, 'u_front');
    gl.uniform1i(mTrail, 0);
    gl.uniform3fv(mBack,  config.back);
    gl.uniform3fv(mMid,   config.mid);
    gl.uniform3fv(mFront, config.front);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.useProgram(mainProg);
      gl.uniform2f(mRes, canvas.width, canvas.height);
      gl.uniform1f(mDpr, dpr);
    };
    resize();

    const onMove = (e) => {
      mouseRef.current[0] = e.clientX / window.innerWidth;
      mouseRef.current[1] = e.clientY / window.innerHeight;
    };

    let pingPong = [fboA, fboB];
    let rafId;
    let lastFrameTime = 0;
    const FRAME_BUDGET = 1000 / 30;
    const t0 = performance.now();

    const render = (now) => {
      rafId = requestAnimationFrame(render);
      if (now - lastFrameTime < FRAME_BUDGET) return;
      lastFrameTime = now;

      const [read, write] = pingPong;

      const sm = smoothMouseRef.current;
      const rm = mouseRef.current;
      sm[0] += (rm[0] - sm[0]) * 0.10;
      sm[1] += (rm[1] - sm[1]) * 0.10;

      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
      gl.viewport(0, 0, TRAIL_SIZE, TRAIL_SIZE);
      gl.useProgram(trailProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      gl.uniform2fv(tMouse, sm);
      gl.uniform1f(tAspect, window.innerWidth / window.innerHeight);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(mainProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, write.tex);
      gl.uniform1f(mTime, (now - t0) * 0.000125);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

      pingPong = [write, read];
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      } else {
        lastFrameTime = 0;
        rafId = requestAnimationFrame(render);
      }
    };

    window.addEventListener('resize',    resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize',    resize);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(trailProg);
      gl.deleteProgram(mainProg);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      [fboA, fboB].forEach(({ fbo, tex }) => {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(tex);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* Solid base — visible before WebGL initialises or when reduced motion */}
      <div style={{ position: 'absolute', inset: 0, background: config.fallback }} />

      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Ambient glows — mode-specific */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: config.glows }} />

      {/* Edge vignettes — mode-specific */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: config.vignettes }} />
    </div>
  );
};

// ── Public export — key={colorMode} forces WebGL remount on mode switch ────────

export const GlassBackground = () => {
  const { colorMode } = useTheme();
  const config = THEME_CONFIGS[colorMode] ?? THEME_CONFIGS.dark;
  return <AnimatedBackground key={colorMode} config={config} />;
};
