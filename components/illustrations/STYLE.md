# Illustration style guide

One consistent visual language for every illustration on this site,
inspired by illos.dev's Shader style: dotted forms, custom code, no
stock imagery.

## The language

- **Dotted forms.** Shapes are built from a field of dots, never solid
  fills. Dots are round and soft, sized by the piece, never square.
- **Coordinate pins.** A few crosshair pins (+ inside a thin ring) sit on
  anchor points of the form and drift with it. They are the signature
  detail — every WebGL piece gets 3–5 of them, every SVG piece gets at
  least one.
- **One accent, restrained.** Color comes from the theme CSS variables
  (`--foreground`, `--ring`) so light and dark both work. No hardcoded
  brand colors. Dots sit around 0.5 alpha; pins are brighter (~0.9).
- **Motion is gentle.** Slow flutter (sine waves, ~1s period), pointer
  repel with a soft lag, subtle twinkle. Nothing spins, nothing flashes.
- **Reduced motion is a still frame.** Every animated piece renders one
  static frame when `prefers-reduced-motion` is set — never a frozen
  mid-animation state, never a blank canvas.

## Placement

- **Hero: one signature WebGL piece.** `components/shaders/dotted-field.tsx`
  is the first one — a dotted field behind the hero content. Only one
  WebGL canvas per page.
- **Everything else: SVG.** About, projects, contact and empty states get
  animated SVG illustrations in the same dotted style (see
  `components/illustrations/` when they exist). SVG is cheaper, sharper
  on mobile, and easier to keep consistent.

## Performance rules

- DPR capped at 2. Pause the loop when the piece is offscreen
  (`IntersectionObserver`) or the tab is hidden (`visibilitychange`).
- Canvas containers are `aria-hidden` and `pointer-events: none` — they
  never block clicks or screen readers.
- Read colors from CSS variables at runtime and watch for theme changes
  (see `readForegroundColor` in `dotted-field.tsx`), so the piece follows
  light/dark without a reload.

## Reference

- Naved's butterfly post (Nov 9, 2026):
  https://x.com/Navedux/status/2119808000768741439
  — "mostly webgl and custom code, with a little illos.dev shader
  style mixed in". Dotted butterfly/moth form, coordinate pins tracking
  the wing flutter in real time.
- illos.dev — Shader, HUD, Isometric, Interface styles. This site uses
  the Shader style only.
