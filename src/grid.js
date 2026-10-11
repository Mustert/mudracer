// ---------- spatial hash for the solid obstacles of a map (trees, walls, posts, rocks) ----------
// The world is cut into square cells. Every obstacle is put into each cell that a circle of its radius plus REACH touches,
// so anything up to REACH px wide (a car has 9, a loose tyre 7) only has to check the obstacles of the one cell it is in.
// The order of the original list is kept inside every cell, so collisions resolve exactly as with the full list.

export const CELL = 32, REACH = 10;

export function obstacleGrid(list, w, h) {
  if (!(w > 0 && h > 0)) throw new Error('obstacleGrid: world size missing');
  const cols = Math.max(1, Math.ceil(w / CELL)), rows = Math.max(1, Math.ceil(h / CELL)), cells = Array.from({ length: cols * rows }, () => []);
  for (const o of list) {
    const r = o.r + REACH;
    const x0 = Math.max(0, Math.floor((o.x - r) / CELL)), x1 = Math.min(cols - 1, Math.floor((o.x + r) / CELL));
    const y0 = Math.max(0, Math.floor((o.y - r) / CELL)), y1 = Math.min(rows - 1, Math.floor((o.y + r) / CELL));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) cells[cy * cols + cx].push(o);
  }
  return { cols, rows, cells };
}

const NONE = [];

// the obstacles that something at (x, y) can touch
export function nearObstacles(g, x, y) {
  if (!g) return NONE;
  if (!(x === x && y === y)) return NONE; // NaN
  // a little outside the world counts as the edge cell (the cells at the edge hold everything that reaches over it)
  const cx = Math.min(g.cols - 1, Math.max(0, Math.floor(x / CELL))), cy = Math.min(g.rows - 1, Math.max(0, Math.floor(y / CELL)));
  return g.cells[cy * g.cols + cx];
}
