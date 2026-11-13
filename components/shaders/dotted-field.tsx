"use client";

import { Geometry, Mesh, Program, Renderer, Transform } from "ogl";
import { useEffect, useRef, type ReactNode } from "react";

export type DottedFieldProps = {
  className?: string;
  /** Grid spacing in field units. Smaller = denser field. */
  spacing?: number;
  /** Base dot diameter in drawing-buffer pixels (at 800px field height). */
  pointSize?: number;
  /** Mouse repel radius in field units. */
  repelRadius?: number;
  /** Mouse repel strength in field units. */
  repelStrength?: number;
};

const D = {
  spacing: 0.055,
  pointSize: 4.5,
  repelRadius: 0.35,
  repelStrength: 0.09,
};

/** Pins (crosshairs) placed as fractions of the field, [x, y] in [-1, 1]. */
const PIN_ANCHORS: Array<[number, number]> = [
  [0.62, 0.42],
  [-0.55, -0.38],
  [0.15, -0.6],
  [-0.78, 0.48],
];

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

varying float vAlpha;
varying float vPin;

void main() {
  vec2 pos = position;

  // Gentle flutter, each dot offset by its own seed phase.
  pos.x += sin(pos.y * 2.5 + uTime * 0.9 + aSeed * 6.2831) * 0.012;
  pos.y += cos(pos.x * 2.0 + uTime * 0.7 + aSeed * 3.14159) * 0.014;

  // Mouse repel: dots near the cursor push away and grow.
  vec2 toMouse = pos - uMouse;
  float dist = length(toMouse);
  float influence = smoothstep(uRepelRadius, 0.0, dist) * uMouseActive;
  pos += normalize(toMouse + vec2(0.0001)) * influence * uRepelStrength;

  // Soft radial mask so the field fades out toward the edges.
  vec2 n = vec2(pos.x / uAspect, pos.y);
  float edge = smoothstep(1.0, 0.45, length(n * vec2(0.75, 1.0)));
  float twinkle = 0.8 + 0.2 * sin(uTime * 1.1 + aSeed * 6.2831);
  float baseAlpha = aPin > 0.5 ? 0.9 : 0.5 * twinkle;
  vAlpha = edge * baseAlpha;
  vPin = aPin;

  float size = uPointSize * (aPin > 0.5 ? 2.0 : 1.0);
  size *= 1.0 + influence * 1.2;
  gl_PointSize = size * (uResolution.y / 800.0);
  gl_Position = vec4(pos.x / uAspect, pos.y, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uColor;

varying float vAlpha;
varying float vPin;

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
  gl_FragColor = vec4(uColor, a);
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

function readForegroundColor(el: HTMLElement): [number, number, number] {
  const styles = getComputedStyle(el);
  const varVal = styles.getPropertyValue("--foreground").trim();
  const parsed = varVal ? parseColor(varVal) : null;
  if (parsed) return parsed;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;width:0;height:0;background:var(--foreground);";
  el.appendChild(probe);
  const raw = getComputedStyle(probe).backgroundColor;
  el.removeChild(probe);
  return parseColor(raw) ?? [0, 0, 0];
}

type GridPoint = { x: number; y: number; seed: number; pin: number };

function buildGrid(aspect: number, spacing: number): GridPoint[] {
  const cols = Math.max(8, Math.ceil((2 * aspect) / spacing));
  const rows = Math.max(8, Math.ceil(2 / spacing));
  const points: Array<GridPoint> = [];
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = -aspect + (ix + 0.5) * spacing;
      const y = -1 + (iy + 0.5) * spacing;
      points.push({ x, y, seed: Math.random(), pin: 0 });
    }
  }
  // Mark the grid point nearest each pin anchor as a crosshair pin.
  for (const [ax, ay] of PIN_ANCHORS) {
    const px = ax * aspect;
    const py = ay;
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
        uColor: { value: readForegroundColor(document.documentElement) },
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
      const points = buildGrid(aspect, pr.current.spacing ?? D.spacing);
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

    const syncColor = (): void => {
      program.uniforms.uColor.value = readForegroundColor(
        document.documentElement
      );
    };
    const themeObserver = new MutationObserver(syncColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    syncColor();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf = 0;
    let visible = true;
    let onScreen = true;
    const t0 = performance.now();
    let last = t0;

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
