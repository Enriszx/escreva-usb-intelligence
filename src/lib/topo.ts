/**
 * Linhas topográficas procedurais: ruído de valor suave + marching squares.
 * Gera segmentos; quem desenha decide se é SVG (layout) ou canvas (textura 3D).
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed: number) {
  const rnd = mulberry32(seed);
  const N = 64;
  const grid = new Float32Array(N * N).map(() => rnd());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const at = (x: number, y: number) => grid[((y % N) + N) % N * N + (((x % N) + N) % N)];
  const value = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = smooth(x - xi), ty = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return (x: number, y: number) => value(x, y) * 0.6 + value(x * 2.1 + 7, y * 2.1 + 3) * 0.28 + value(x * 4.3, y * 4.3) * 0.12;
}

export type Segment = [number, number, number, number];

export function topoSegments(opts: { w: number; h: number; cols?: number; levels?: number; seed?: number; scale?: number }): Segment[] {
  const { w, h, cols = 72, levels = 11, seed = 7, scale = 3.2 } = opts;
  const rows = Math.max(2, Math.round((cols * h) / w));
  const noise = makeNoise(seed);
  const cw = w / cols, ch = h / rows;
  const v = new Float32Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) v[j * (cols + 1) + i] = noise((i / cols) * scale * (w / h), (j / rows) * scale);
  const segs: Segment[] = [];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  for (let l = 1; l <= levels; l++) {
    const iso = 0.12 + (l / (levels + 1)) * 0.76;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = v[j * (cols + 1) + i], b = v[j * (cols + 1) + i + 1];
        const c = v[(j + 1) * (cols + 1) + i + 1], d = v[(j + 1) * (cols + 1) + i];
        const idx = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * cw, y = j * ch;
        const top: [number, number] = [lerp(x, x + cw, (iso - a) / (b - a)), y];
        const right: [number, number] = [x + cw, lerp(y, y + ch, (iso - b) / (c - b))];
        const bottom: [number, number] = [lerp(x, x + cw, (iso - d) / (c - d)), y + ch];
        const left: [number, number] = [x, lerp(y, y + ch, (iso - a) / (d - a))];
        const add = (p: [number, number], q: [number, number]) => segs.push([p[0], p[1], q[0], q[1]]);
        switch (idx) {
          case 1: case 14: add(left, bottom); break;
          case 2: case 13: add(bottom, right); break;
          case 3: case 12: add(left, right); break;
          case 4: case 11: add(top, right); break;
          case 6: case 9: add(top, bottom); break;
          case 7: case 8: add(left, top); break;
          case 5: add(left, top); add(bottom, right); break;
          case 10: add(top, right); add(left, bottom); break;
        }
      }
    }
  }
  return segs;
}

export function segmentsToPath(segs: Segment[]): string {
  let d = '';
  for (const s of segs) d += `M${s[0].toFixed(1)} ${s[1].toFixed(1)}L${s[2].toFixed(1)} ${s[3].toFixed(1)}`;
  return d;
}
