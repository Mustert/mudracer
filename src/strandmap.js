import { hash, hex, vnoise } from './core.js';
import { stampLine } from './volcanomap.js';

// ---------- Strand: the beach volleyball court in the infield (Rev 3, instead of the little lagoon) ----------
// A narrow sand lane leaves the S bend, runs right through the middle of the court (under the net) and joins the left bend again: a short cut
// that skips the bottom stretch (and the flooded pier). The court sand beside it is slow, the net brakes, the ball of the players hits you
// (strand.js). Terrain codes (physics.js surfOf, block 50-59, used up to 52): 50 the packed sand lane, 51 the net across the lane, 52 the court beside the lane.

const K = Object.fromEntries(Object.entries({
  court: '#f3dc9e', court1: '#ead18e', court2: '#f8e6b4', line: '#ffffff', lineD: '#d8cdb4',
  lane: '#d6b274', lane1: '#cba768', lane2: '#e0be82', laneE: '#b38d55', rut: '#c09a5e',
  post: '#e9edf2', postD: '#7b8794', net: '#2b2f38', tape: '#ffffff',
}).map(([k, v]) => [k, hex(v)]));

// def.volley = { pts: the lane (poly points, rounded corners), half: half width, court: [cx, cy, half width, half height] }
export function* beachTerrain(S) {
  const { MW, MH, def, ter } = S, V = def.volley, A = MW * MH, alt = new Uint8Array(A), [cx, cy, hw, hh] = V.court;
  yield;
  for (let y = cy - hh; y <= cy + hh; y++) for (let x = cx - hw; x <= cx + hw; x++) { const j = y * MW + x; if (ter[j] === 0) ter[j] = 52; }
  const pts = stampLine(V.pts, V.half, j => { if (ter[j] === 0 || ter[j] === 52) ter[j] = 50; if (ter[j] === 50) alt[j] = 1; }, MW, MH);
  for (let y = cy - V.half - 1; y <= cy + V.half + 1; y++) for (let x = cx - 2; x <= cx + 1; x++) { const j = y * MW + x; if (ter[j] === 50) ter[j] = 51; }
  return { alt, pts };
}

// the picture: the court with its lines, the lane with ruts, the two net posts (solid). S as in tracks.js buildTrack, RT = beachTerrain
export function* paintBeach(S) {
  const { MW, MH, def, set, setT, ter, walls, wallMask, RT } = S, V = def.volley, [cx, cy, hw, hh] = V.court;
  yield;
  const dd = new Float32Array(MW * MH).fill(99);
  stampLine(V.pts, V.half, (j, d) => { dd[j] = d; }, MW, MH);
  for (let y = cy - hh - 1; y <= cy + hh + 1; y++) for (let x = cx - hw - 1; x <= cx + hw + 1; x++) {
    const j = y * MW + x, t = ter[j]; if (t !== 52 && t !== 50 && t !== 51) continue;
    const nv = vnoise(x / 6, y / 6, 71), h = hash(x, y, 72);
    set(j, h < .04 ? K.court2 : nv > .62 ? K.court1 : nv < .3 ? K.court2 : K.court);
  }
  // the lane: packed, darker sand with two ruts; its rim is darker where it meets the soft sand
  for (let j = 0; j < MW * MH; j++) {
    const t = ter[j]; if (t !== 50 && t !== 51) continue;
    const x = j % MW, y = (j / MW) | 0, d = dd[j], nv = vnoise(x / 7, y / 7, 73);
    set(j, d > V.half - 1.6 ? K.laneE : Math.abs(d - 5) < .9 && hash(x, y, 74) < .8 ? K.rut : nv > .6 ? K.lane1 : nv < .3 ? K.lane2 : K.lane);
  }
  // the court lines: the outer rectangle and the middle line under the net (white tape, a shadow under it)
  const line = (x, y) => { if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, K.line); if (y + 1 < MH) set((y + 1) * MW + x, K.lineD); };
  for (let x = cx - hw; x <= cx + hw; x++) { line(x, cy - hh); line(x, cy + hh); }
  for (let y = cy - hh; y <= cy + hh; y++) { line(cx - hw, y); line(cx + hw, y); }
  // the net on the top layer: a white tape over a dark mesh, the two posts beside the court (solid)
  for (let y = cy - hh - 3; y <= cy + hh + 3; y++) { setT(cx - 1, y, K.tape); setT(cx, y, y % 2 ? K.net : K.tape); if (y % 3 === 0) setT(cx + 1, y, K.net); }
  for (const py of [cy - hh - 5, cy + hh + 5]) {
    walls.push({ x: cx, y: py, r: 3 });
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 5) continue;
      setT(cx + dx, py + dy, dx + dy < 0 ? K.post : K.postD);
      const X = cx + dx, Y = py + dy; if (X >= 0 && Y >= 0 && X < MW && Y < MH) wallMask[Y * MW + X] = 1;
    }
  }
  // way: the points of the lane, a computer car that takes the short cut follows them (strand.js)
  return { alt: RT.alt, way: RT.pts, court: V.court, half: V.half };
}
