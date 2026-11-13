"use client";

import { Geometry, Mesh, Program, Renderer, Transform } from "ogl";
import { useEffect, useRef, type ReactNode } from "react";

export type DottedFieldProps = {
  className?: string;
  /** Base dot diameter in drawing-buffer pixels (at 800px field height). */
  pointSize?: number;
  /** Mouse repel radius in field units. */
  repelRadius?: number;
  /** Mouse repel strength in field units. */
  repelStrength?: number;
};

const D = {
  pointSize: 6,
  repelRadius: 0.4,
  repelStrength: 0.12,
};

/**
 * Dotted world map. Land mask is Natural Earth land-110m, rasterized to a
 * 240x96 grid (lon -180..180, lat 84..-60, Antarctica cropped) and packed
 * as base64 bits. Regenerate with scripts/rasterize-land-mask.js (see
 * components/illustrations/STYLE.md).
 */
const MASK_COLS = 240;
const MASK_ROWS = 96;
const MASK_LON_MIN = -180;
const MASK_LON_MAX = 180;
const MASK_LAT_MIN = -60;
const MASK_LAT_MAX = 84;
const LAND_MASK_B64 =
  "AAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//8////44AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPx/n/////AAAA/AAYAAAAfAAAAAAAAAAAAAAAAEO3v4f////+AAAPgAAAAAAAAcAAAAAAAAAAAAAADAAAfgP////+AAAHAAAAAAAAAMAAAAAAAAAAAAAAA9jjCAAP///+AAAAAAAAHgAAP/8AAPAAAAAAAAAAcAAAAAAD///8AAAAAAAAYAAD//gAAAAAAAAAAAAAe6zs/AAB///4AAAAAAABgDA/////wGAAAAwAEAAAI/wM//AAf//////////xwHf/////z/+AAAAB//wPI/+sEP4A///wAAAAf8AACHf////////8B8P////////////////////8AAOcgEQAAAAAAAAAAAE////////////////////4AAHAAAgAAAAAAAAAAA5////////////////////wOB4AAAAAAAAAAAAAAAAAf///////Ng+AP4ADAAA/n////////////////+AD///////8COMAHwAAAAD/P///////////////v8AD/7/////4APwABgAAAAH/P//////////////wfAAA+AH////4APzAAAAAAAD/D/////////////JhgAAAFAAf///8AH/gAAAAAIAOD////////////4AHAAAAQAAP////wH/gAAAAAMBuP////////////wAPgAACAAAH////+f/8AAAAAWAhf////////////AAPAAAAAAAT////+f/+AAAAA3H//////////////+AOAAAAAAAB/////f/8AAAAAHn//////////////+AIAAAAAAAB//////8wAAAAAMf//////////////9AAAAAAAAAA//////2HAAAAAF///////////////4AAAAAAAAAAf/////+AgAAAAD///////////////4AAAAAAAAAAf//////wAAAAAB///yf//////////wAAAAAAAAAAf/////yAAAAAAB/z/gP//////////jAAAAAAAAAAf/////gAAAAAA/wY/gD/////////8HAAAAAAAAAAf/////AAAAAAA/gGfnn/////////wAAAAAAAAAAAf////+AAAAAAA/ACY//////////1gGAAAAAAAAAAP////8AAAAAAA/ACM//////////hwEAAAAAAAAAAH////4AAAAAAAOLgA//////////4wcAAAAAAAAAAH////4AAAAAAAN/gDC/////////wz8AAAAAAAAAAB////wAAAAAAAf/gAA/////////wDgAAAAAAAAAAA////AAAAAAAA//8YB/////////4EAAAAAAAAAAAAX///AAAAAAAA///f//////////4AAAAAAAAAAAAAX/5BAAAAAAAB//////z///////4AAAAAAAAAAAAAb/gBAAAAAAAH////8/5///////4AAAAAAAAAAAAAF/gBoAAAAAAP////+/4f//////wAAAAAAAAAAAAAE/gAAAAAAAAP////+f8wH/////gAAAAAAAAAAAAAAfgAAAAAAAAf/////P/4D/////IAAAAAAAAAAAAAAPgAQAAAAAAf/////v/8D/+f/4AAAAAAAAAAAAAAAPgwOAAAAAAf/////n/4Af8P+AAAAAAAAAAAAAAAAHxwAwAAAAAf/////n/wAfwH+wAAAAAAAAAAAAAAAB/gAAAAAAAf/////z/gAfgH+AMAAAAAAAAAAAAAAAT8AAAAAAAf/////z+AAfAF/AIAAAAAAAAAAAAAAAB+AAAAAAAf/////94AAOAB/gIAAAAAAAAAAAAAAAAMAAAAAAAf//////AAAOAA/gCAAAAAAAAAAAAAAAAEBQAAAAAP/////+MAAGAAHAFAAAAAAAAAAAAAAAACDfgAAAAH//////8AAGAACAAAAAAAAAAAAAAAAAABP/wAAAAH//////4AABABgADAAAAAAAAAAAAAAAAAP/4AAAAD//////4AABAAQABAAAAAAAAAAAAAAAAAP//gAAAA/H////wAAAACYBgAAAAAAAAAAAAAAAAAH//wAAAAAA////wAAAADYDAAAAAAAAAAAAAAAAAAP//wAAAAAA////gAAAABoPgAAAAAAAAAAAAAAAAAf//4AAAAAA///+AAAAAA4fuQAAAAAAAAAAAAAAAA///+AAAAAA///8AAAAAAYfASAAAAAAAAAAAAAAAA////AAAAAA///4AAAAAAcfYBYAAAAAAAAAAAAAAA////8AAAAAf//4AAAAAAOCEh/AAAAAAAAAAAAAAA/////AAAAAP//wAAAAAAGAAAPgAAAAAAAAAAAAAA/////gAAAAP//wAAAAAADIABPwIAAAAAAAAAAAAAf////gAAAAH//wAAAAAAAOAAPYCAAAAAAAAAAAAAP////AAAAAH//4AAAAAAAACAAMAAAAAAAAAAAAAAP///+AAAAAH//4AAAAAAAAAAAAAAAAAAAAAAAAAAH///+AAAAAH//4AAAAAAAAAHhAAAAAAAAAAAAAAAH///8AAAAAP//4IAAAAAAAAvjAAAAAAAAAAAAAAAD///8AAAAAP//4cAAAAAAAB/jgAAAAAAAAAAAAAAA///8AAAAAP//h4AAAAAAAD/7gAAAAAAAAAAAAAAAf//8AAAAAP//B4AAAAAAAH//wAAAAAAAAAAAAAAAf//4AAAAAH/+AwAAAAAAAf//4AQAAAAAAAAAAAAAf//4AAAAAH//BwAAAAAAB///8AIAAAAAAAAAAAAAf//gAAAAAD//BwAAAAAAD///+AAAAAAAAAAAAAAAf/8AAAAAAD/+BgAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAA//4AAAAAAB/4AAAAAAAAB////AAAAAAAAAAAAAAA//wAAAAAAA/wAAAAAAAAB////AAAAAAAAAAAAAAA//gAAAAAAA/gAAAAAAAAB/h//AAAAAAAAAAAAAAA//AAAAAAAA+AAAAAAAAAB+Av+AAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAP8AAQAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAH8AAIAAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAAADQAAOAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAIAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAwAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** City pins, [lon, lat]. */
const CITY_PINS: Array<[number, number]> = [
  [-74, 40.7], // New York
  [-0.1, 51.5], // London
  [139.7, 35.7], // Tokyo
  [151.2, -33.9], // Sydney
  [-46.6, -23.5], // Sao Paulo
];

let landBits: Uint8Array | null = null;

function getLandBits(): Uint8Array {
  if (landBits) return landBits;
  const raw = atob(LAND_MASK_B64);
  const bits = new Uint8Array(MASK_COLS * MASK_ROWS);
  for (let i = 0; i < raw.length; i++) {
    const byte = raw.charCodeAt(i);
    for (let b = 0; b < 8; b++) {
      const idx = i * 8 + b;
      if (idx < bits.length) bits[idx] = (byte >> (7 - b)) & 1;
    }
  }
  landBits = bits;
  return bits;
}

/** Deterministic 0..1 hash so dot jitter is stable across rebuilds. */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

const VERTEX_SHADER = `
attribute vec2 position;
attribute float aSeed;
attribute float aPin;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uAspect;
uniform float uPointSize;
uniform float uRepelRadius;
uniform float uRepelStrength;
uniform vec2 uRippleOrigin;
uniform float uRippleAge;

varying float vAlpha;
varying float vPin;
varying float vPop;

void main() {
  vec2 pos = position;

  // Gentle flutter, keeps the map alive without breaking its shape.
  pos.x += sin(pos.y * 2.5 + uTime * 0.9 + aSeed * 6.2831) * 0.008;
  pos.y += cos(pos.x * 2.0 + uTime * 0.7 + aSeed * 3.14159) * 0.010;

  // Mouse repel: dots near the cursor push away.
  vec2 toMouse = pos - uMouse;
  float dist = length(toMouse);
  float influence = smoothstep(uRepelRadius, 0.0, dist) * uMouseActive;
  pos += normalize(toMouse + vec2(0.0001)) * influence * uRepelStrength;

  // Expanding ripple ring from fast cursor movement.
  float ring = 0.0;
  if (uRippleAge >= 0.0 && uRippleAge < 1.2) {
    float ringDist = distance(pos, uRippleOrigin);
    float front = uRippleAge * 0.9;
    ring = exp(-pow((ringDist - front) * 6.0, 2.0)) * (1.0 - uRippleAge / 1.2);
    pos += normalize(pos - uRippleOrigin + vec2(0.0001)) * ring * 0.05;
  }

  float pop = max(influence, ring);
  vPop = pop;
  float twinkle = 0.85 + 0.15 * sin(uTime * 1.1 + aSeed * 6.2831);
  float baseAlpha = aPin > 0.5 ? 0.95 : 0.75 * twinkle;
  vAlpha = baseAlpha * (1.0 + pop * 0.5);
  vPin = aPin;

  float size = uPointSize * (aPin > 0.5 ? 2.0 : 1.0);
  size *= 1.0 + pop * 1.5;
  gl_PointSize = size * (uResolution.y / 800.0);
  gl_Position = vec4(pos.x / uAspect, pos.y, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uColor;
uniform vec3 uAccent;

varying float vAlpha;
varying float vPin;
varying float vPop;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a;

  if (vPin > 0.5) {
    // Coordinate pin: a plus sign inside a thin ring.
    float bar = max(
      step(abs(c.x), 0.06) * step(abs(c.y), 0.32),
      step(abs(c.y), 0.06) * step(abs(c.x), 0.32)
    );
    float ring = smoothstep(0.48, 0.44, d) * (1.0 - smoothstep(0.38, 0.34, d));
    a = max(bar, ring) * vAlpha;
  } else {
    // Soft round dot.
    a = smoothstep(0.5, 0.12, d) * vAlpha;
  }

  if (a < 0.01) discard;
  vec3 col = mix(uColor, uAccent, vPop);
  gl_FragColor = vec4(col, min(a, 1.0));
}
`;

function parseColor(input: string): [number, number, number] | null {
  const s = input.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length !== 6) return null;
    const n = parseInt(hex, 16);
    if (Number.isNaN(n)) return null;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = s.match(/(\d+(?:\.\d+)?)/g);
  if (!m || m.length < 3) return null;
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

function readCssColor(
  el: HTMLElement,
  varName: string
): [number, number, number] {
  const styles = getComputedStyle(el);
  const varVal = styles.getPropertyValue(varName).trim();
  const parsed = varVal ? parseColor(varVal) : null;
  if (parsed) return parsed;
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;width:0;height:0;background:var(${varName});`;
  el.appendChild(probe);
  const raw = getComputedStyle(probe).backgroundColor;
  el.removeChild(probe);
  return parseColor(raw) ?? [0, 0, 0];
}

type GridPoint = { x: number; y: number; seed: number; pin: number };

function lonLatToField(
  lon: number,
  lat: number,
  aspect: number
): [number, number] {
  const scale = Math.min(
    (2 * aspect * 0.96) / (MASK_LON_MAX - MASK_LON_MIN),
    (2 * 0.96) / (MASK_LAT_MAX - MASK_LAT_MIN)
  );
  const lonCenter = (MASK_LON_MIN + MASK_LON_MAX) / 2;
  const latCenter = (MASK_LAT_MIN + MASK_LAT_MAX) / 2;
  return [(lon - lonCenter) * scale, (lat - latCenter) * scale];
}

function buildGrid(aspect: number): GridPoint[] {
  const bits = getLandBits();
  const scale = Math.min(
    (2 * aspect * 0.96) / (MASK_LON_MAX - MASK_LON_MIN),
    (2 * 0.96) / (MASK_LAT_MAX - MASK_LAT_MIN)
  );
  const cellW = ((MASK_LON_MAX - MASK_LON_MIN) / MASK_COLS) * scale;
  const points: Array<GridPoint> = [];
  for (let row = 0; row < MASK_ROWS; row++) {
    const lat =
      MASK_LAT_MAX - ((row + 0.5) / MASK_ROWS) * (MASK_LAT_MAX - MASK_LAT_MIN);
    for (let col = 0; col < MASK_COLS; col++) {
      if (!bits[row * MASK_COLS + col]) continue;
      const lon =
        MASK_LON_MIN +
        ((col + 0.5) / MASK_COLS) * (MASK_LON_MAX - MASK_LON_MIN);
      const [x, y] = lonLatToField(lon, lat, aspect);
      const idx = row * MASK_COLS + col;
      points.push({
        x: x + (hash(idx) - 0.5) * cellW * 0.6,
        y: y + (hash(idx + 7919) - 0.5) * cellW * 0.6,
        seed: hash(idx + 104729),
        pin: 0,
      });
    }
  }
  // Mark the dot nearest each city as a crosshair pin.
  for (const [lon, lat] of CITY_PINS) {
    const [px, py] = lonLatToField(lon, lat, aspect);
    let best: GridPoint | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const p of points) {
      const d = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best) best.pin = 1;
  }
  return points;
}

export function DottedField(props: DottedFieldProps): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);
  const pr = useRef(props);

  useEffect(() => {
    pr.current = props;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    const gl = renderer.gl;
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    el.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [1, 1] },
        uMouse: { value: [0, 0] },
        uMouseActive: { value: 0 },
        uAspect: { value: 1 },
        uPointSize: { value: D.pointSize },
        uRepelRadius: { value: D.repelRadius },
        uRepelStrength: { value: D.repelStrength },
        uRippleOrigin: { value: [0, 0] },
        uRippleAge: { value: -1 },
        uColor: {
          value: readCssColor(document.documentElement, "--foreground"),
        },
        uAccent: { value: readCssColor(document.documentElement, "--ring") },
      },
      transparent: true,
    });

    if (!program.uniformLocations) {
      console.error("Shader link failed", {
        v: gl.getShaderInfoLog(program.vertexShader),
        f: gl.getShaderInfoLog(program.fragmentShader),
      });
      return;
    }

    const scene = new Transform();
    let mesh: Mesh | null = null;
    let aspect = 1;

    const buildMesh = (): void => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      const nextAspect = w / h;
      if (mesh && Math.abs(nextAspect - aspect) < 0.1) return;
      aspect = nextAspect;
      const points = buildGrid(aspect);
      const count = points.length;
      const position = new Float32Array(count * 2);
      const seed = new Float32Array(count);
      const pin = new Float32Array(count);
      points.forEach((p, i) => {
        position[i * 2] = p.x;
        position[i * 2 + 1] = p.y;
        seed[i] = p.seed;
        pin[i] = p.pin;
      });
      const geometry = new Geometry(gl, {
        position: { size: 2, data: position },
        aSeed: { size: 1, data: seed },
        aPin: { size: 1, data: pin },
      });
      const next = new Mesh(gl, {
        geometry,
        program,
        mode: gl.POINTS,
      });
      next.setParent(scene);
      if (mesh) mesh.setParent(null);
      mesh = next;
    };

    const onResize = (): void => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      ];
      program.uniforms.uAspect.value = w / h;
      buildMesh();
    };

    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    // Mouse: lerped toward the pointer so dots trail with a soft lag.
    const mouseTarget: [number, number] = [0, 0];
    const mouseCurrent: [number, number] = [0, 0];
    let activeTarget = 0;
    let activeCurrent = 0;

    // Ripple: a fast cursor swipe fires an expanding ring.
    const rippleOrigin: [number, number] = [0, 0];
    let rippleStart = -1;
    let lastRippleAt = 0;

    const onPointerMove = (e: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      if (nx < -0.05 || nx > 1.05 || ny < -0.05 || ny > 1.05) {
        activeTarget = 0;
        return;
      }
      mouseTarget[0] = (nx * 2 - 1) * aspect;
      mouseTarget[1] = (1 - ny) * 2 - 1;
      activeTarget = 1;
    };
    const onPointerLeave = (): void => {
      activeTarget = 0;
    };
    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    const syncColors = (): void => {
      program.uniforms.uColor.value = readCssColor(
        document.documentElement,
        "--foreground"
      );
      program.uniforms.uAccent.value = readCssColor(
        document.documentElement,
        "--ring"
      );
    };
    const themeObserver = new MutationObserver(syncColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    syncColors();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf = 0;
    let visible = true;
    let onScreen = true;
    const t0 = performance.now();
    let last = t0;
    let prevMouse: [number, number] = [0, 0];
    let prevTime = t0;

    const onVisibility = (): void => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) onScreen = e.isIntersecting;
      },
      { rootMargin: "100px" }
    );
    io.observe(el);

    const render = (time: number): void => {
      program.uniforms.uTime.value = time;
      program.uniforms.uMouse.value = [...mouseCurrent];
      program.uniforms.uMouseActive.value = activeCurrent;
      program.uniforms.uRippleOrigin.value = [...rippleOrigin];
      program.uniforms.uRippleAge.value =
        rippleStart < 0 ? -1 : (performance.now() - rippleStart) / 1000;
      program.uniforms.uPointSize.value = pr.current.pointSize ?? D.pointSize;
      program.uniforms.uRepelRadius.value =
        pr.current.repelRadius ?? D.repelRadius;
      program.uniforms.uRepelStrength.value =
        pr.current.repelStrength ?? D.repelStrength;
      renderer.render({ scene });
    };

    if (reducedMotion) {
      // One static frame, no animation loop.
      render(0);
    } else {
      const tick = (): void => {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const k = 1 - Math.exp(-6 * dt);
        mouseCurrent[0] += (mouseTarget[0] - mouseCurrent[0]) * k;
        mouseCurrent[1] += (mouseTarget[1] - mouseCurrent[1]) * k;
        activeCurrent += (activeTarget - activeCurrent) * k;

        // Fast swipe -> ripple.
        const frameDt = Math.max((now - prevTime) / 1000, 0.001);
        const speed =
          Math.hypot(
            mouseCurrent[0] - prevMouse[0],
            mouseCurrent[1] - prevMouse[1]
          ) / frameDt;
        if (speed > 1.0 && activeCurrent > 0.5 && now - lastRippleAt > 400) {
          rippleOrigin[0] = mouseCurrent[0];
          rippleOrigin[1] = mouseCurrent[1];
          rippleStart = now;
          lastRippleAt = now;
        }
        prevMouse = [...mouseCurrent];
        prevTime = now;

        if (visible && onScreen) render((now - t0) / 1000);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave
      );
      if (gl.canvas.parentElement === el) el.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={props.className ?? "absolute inset-0 h-full w-full"}
      style={{ pointerEvents: "none" }}
    />
  );
}
