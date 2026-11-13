// Rasterize Natural Earth land-110m (world-atlas TopoJSON) into a compact
// land mask for the dotted world map. Run once; the output bitmask is
// embedded in components/shaders/dotted-field.tsx.
// Usage: node rasterize.js /tmp/land-110m.json
const fs = require("fs");

const topo = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { scale, translate } = topo.transform;

// Decode delta-encoded arcs to absolute [lon, lat] points.
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

function resolveArc(index) {
  if (index >= 0) return arcs[index];
  return [...arcs[~index]].reverse();
}

// Collect every polygon ring from the land GeometryCollection.
const rings = [];
for (const geom of topo.objects.land.geometries) {
  if (geom.type === "Polygon") {
    for (const ringArcs of geom.arcs) {
      const ring = [];
      for (const a of ringArcs) ring.push(...resolveArc(a));
      rings.push(ring);
    }
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.arcs) {
      for (const ringArcs of poly) {
        const ring = [];
        for (const a of ringArcs) ring.push(...resolveArc(a));
        rings.push(ring);
      }
    }
  }
}
console.error(`decoded ${rings.length} rings`);

// Bounding boxes per ring for a fast pre-check.
const boxes = rings.map((ring) => {
  let minX = 180;
  let maxX = -180;
  let minY = 90;
  let maxY = -90;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
});

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isLand(lon, lat) {
  for (let r = 0; r < rings.length; r++) {
    const [minX, minY, maxX, maxY] = boxes[r];
    if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue;
    if (pointInRing(lon, lat, rings[r])) return true;
  }
  return false;
}

// Grid: lon -180..180, lat 84..-60 (Antarctica cropped out).
const COLS = 240;
const ROWS = 96;
const LON_MIN = -180;
const LON_MAX = 180;
const LAT_MAX = 84;
const LAT_MIN = -60;

const bits = [];
let landCount = 0;
const preview = [];
for (let row = 0; row < ROWS; row++) {
  const lat = LAT_MAX - ((row + 0.5) / ROWS) * (LAT_MAX - LAT_MIN);
  let line = "";
  for (let col = 0; col < COLS; col++) {
    const lon = LON_MIN + ((col + 0.5) / COLS) * (LON_MAX - LON_MIN);
    const land = isLand(lon, lat);
    bits.push(land ? 1 : 0);
    if (land) landCount++;
    line += land ? "#" : ".";
  }
  preview.push(line);
}

// ASCII preview, downsampled 2x horizontally for readability.
console.error(`land cells: ${landCount} / ${COLS * ROWS}`);
for (let i = 0; i < preview.length; i += 2) {
  let line = "";
  for (let j = 0; j < preview[i].length; j += 2) line += preview[i][j];
  console.error(line);
}

// Pack bits into base64 (8 bits per byte, MSB first).
const bytes = Buffer.alloc(Math.ceil(bits.length / 8));
bits.forEach((b, i) => {
  if (b) bytes[i >> 3] |= 0x80 >> (i & 7);
});
console.log(
  JSON.stringify({
    cols: COLS,
    rows: ROWS,
    lonMin: LON_MIN,
    lonMax: LON_MAX,
    latMin: LAT_MIN,
    latMax: LAT_MAX,
    landCells: landCount,
    maskB64: bytes.toString("base64"),
  })
);
