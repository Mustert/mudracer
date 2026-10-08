import { G } from './g.js';
import { SFX, ambience, engineSound } from './audio.js';
import { HALF, VH, VW, WW, clamp, pick } from './core.js';
import { DIFFS } from './diff.js';
import { coarse, held, honkBtn, touchBox } from './input.js';
import { honk, setState } from './menus.js';
import { Music } from './music.js';
import { CONF, RAINBOW, WATC, addP, drop, mudBurst, splash } from './particles.js';
import { aiTarget, physics, score, updateProgress } from './physics.js';
import { eventCollisions, updateEvents } from './events.js';
import { moveCamera } from './race.js';
import { updateJumps } from './run.js';
import { cam } from './state.js';
import { GHOST_DT, ttSample } from './timetrial.js';
import { tctx } from './tracks.js';
import { updateTrain } from './train.js';

// ---------- update ----------

// a car that falls into deep water: splash, washed clean, gone for a moment, then back on the road where it left it (and see-through for a while)
function sinkCar(c) {
  c.fall = 1.4; c.wet = 0; c.dirt = 0; c.vx = c.vy = 0; c.boost = 0; c.stun = 0;
  splash(c.x, c.y, 26); SFX.splash(c.ai ? .4 : 1);
}


function respawn(c) {
  const N = G.T.N, i = ((c.safe || c.idx) - 5 + N) % N, p = G.T.path[i], tg = G.T.tan[i];
  c.x = p.x; c.y = p.y; c.ang = Math.atan2(tg.y, tg.x); c.vx = c.vy = 0; c.idx = i; c.surf = 1; c.ghost = 2.4;
  splash(c.x, c.y, 8);
}


function updateRace(dt) {
  const racing = G.state === 'race' || G.state === 'finish';
  updateTrain(dt);
  updateEvents(dt);
  for (const c of G.cars) {
    let thr = 0, tgt = null;
    c.brake = false;
    c.ghost = Math.max(0, c.ghost - dt);
    if (c.fall > 0) { c.fall -= dt; c.vx = c.vy = 0; if (c.fall <= 0) respawn(c); continue; } // sunk in the water, comes back on the track in a moment
    if (c.stun > 0) {
      c.stun -= dt; c.ang += c.spin * dt; c.spin *= Math.exp(-2 * dt); if (c.stun <= 0) c.stun = 0;
    } else if (racing && !(G.T.run && c.finished)) {
      if (!c.ai && !c.finished) {
        if (G.state === 'race') {
          if (G.CTRL === 'alt') {
            const ix = (held('right') ? 1 : 0) - (held('left') ? 1 : 0), iy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
            if (ix || iy) { tgt = Math.atan2(iy, ix); thr = 1; }
          } else {
            // car's point of view: up = gas, down = brake and then reverse, left/right = steer
            const st = (held('right') ? 1 : 0) - (held('left') ? 1 : 0), fwd = c.vx * Math.cos(c.ang) + c.vy * Math.sin(c.ang);
            if (held('up')) thr = 1;
            else if (held('down')) { if (fwd > 8) c.brake = true; else thr = -1; }
            if (st && (thr > 0 || Math.hypot(c.vx, c.vy) > 10)) tgt = c.ang + st;
          }
        }
      } else {
        tgt = aiTarget(c);
        thr = c.finished ? .45 : c.skill;
        // opponents far ahead lift off a little, ones far behind push harder; never above full throttle (on SCHWER less of both)
        if (c.ai && !c.finished && !G.player.finished) {
          const D = DIFFS[G.raceDiff || 0], diff = score(c) - score(G.player);
          if (diff > G.T.N * D.ahead) thr *= D.slow; else if (diff < -G.T.N * D.behind) thr = Math.min(1, c.skill * D.catchUp, thr * 1.15);
        }
        // stuck (against a tree or the edge, e.g. after a cow threw it there): back up for a moment, turning towards the track
        if (G.state === 'race' && !c.finished) {
          if (c.rev > 0) { c.rev -= dt; thr = -1; }
          else if (Math.hypot(c.vx, c.vy) < 12) { c.stuckT = (c.stuckT || 0) + dt; if (c.stuckT > 1.2) { c.rev = .9; c.stuckT = 0; } }
          else c.stuckT = 0;
        }
      }
    }
    physics(c, dt, thr, tgt);
    if (G.T.run) updateJumps(c, dt);
    c.honk = Math.max(0, c.honk - dt);
    c.boost = Math.max(0, c.boost - dt);
    if (c.ai && racing && Math.random() < dt * .03) honk(c);
  }
  // collisions: trees, world border, other cars
  for (const c of G.cars) {
    if (c.fall > 0) continue;
    for (const o of G.T.trees) {
      const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy), mn = o.r + 9;
      if (d < mn && d > 0) {
        const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
        c.x = o.x + nx * mn; c.y = o.y + ny * mn;
        if (vn < 0) { c.vx -= 1.6 * vn * nx; c.vy -= 1.6 * vn * ny; if (!c.ai && -vn > 35) SFX.bump(); }
      }
    }
    if (c.x < 10) { c.x = 10; c.vx = Math.abs(c.vx) * .4; } if (c.x > G.T.W - 10) { c.x = G.T.W - 10; c.vx = -Math.abs(c.vx) * .4; }
    if (c.y < 10) { c.y = 10; c.vy = Math.abs(c.vy) * .4; } if (c.y > G.T.H - 10) { c.y = G.T.H - 10; c.vy = -Math.abs(c.vy) * .4; }
  }
  eventCollisions();
  for (let i = 0; i < G.cars.length; i++) for (let j = i + 1; j < G.cars.length; j++) {
    const a = G.cars[i], b = G.cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (a.ghost > 0 || b.ghost > 0 || a.fall > 0 || b.fall > 0) continue; // a car that just came back out of the water is see-through for a moment
    if (d < 18 && d > 0) {
      const nx = dx / d, ny = dy / d, ov = (18 - d) / 2;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) { const jmp = -rv * .65; a.vx -= jmp * nx; a.vy -= jmp * ny; b.vx += jmp * nx; b.vy += jmp * ny; }
    }
  }
  // ground, dirt, effects, tyre tracks
  const th = G.T.th;
  for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0) continue;
    const j = clamp(c.y | 0, 0, G.T.H - 1) * G.T.W + clamp(c.x | 0, 0, G.T.W - 1);
    const prev = c.surf; c.surf = G.T.ter[j]; c.washing = !!G.T.washMask[j];
    // deep water: a car that is over it for a moment falls in (stepping stones and bridges are road)
    c.wet = c.surf === 5 ? c.wet + dt : 0;
    if (c.wet > .22) { sinkCar(c); continue; }
    const sp = Math.hypot(c.vx, c.vy), v = c.ai ? .35 : 1;
    if (c.surf === 2 || c.surf === 6) {
      c.cem = c.surf === 6; // the colour of the dirt on the car is the last thing it drove through
      c.dirt = Math.min(1, c.dirt + .55 * dt * (sp > 8 ? 1 : .3)); c.mudTrail = 1.6;
      if (prev !== c.surf && sp > 25) { mudBurst(c, 14); SFX.mud(v); if (G.T.run && !c.ai) G.run.muds++; }
      if (sp > 20 && Math.random() < dt * 35) mudBurst(c, 1);
      if (!c.ai && sp > 8 && Math.random() < dt * 2.5) SFX.blubb();
    } else if (c.surf === 3) {
      // driving through water rinses the mud off
      c.dirt = Math.max(0, c.dirt - .7 * dt); c.wetTrail = 1;
      if (prev !== 3 && sp > 20) { c.dirt = Math.max(0, c.dirt - .15); splash(c.x, c.y, 22); SFX.splash(v); if (G.T.run && !c.ai) G.run.splashes++; }
      if (sp > 25 && Math.random() < dt * 30) drop(c.x, c.y, c.ang + Math.PI + (Math.random() - .5) * 2, 30 + Math.random() * 40, 60 + Math.random() * 50, pick(WATC), 1, false);
      if (sp > 12 && Math.random() < dt * 5) addP({ t: 'ring', x: c.x, y: c.y, life: .7, ml: .7 });
    } else if (c.surf === 4 && prev !== 4) {
      c.boost = 1.3; SFX.boost(v);
    }
    if (c.boost > 0 && Math.random() < dt * 40) drop(c.x - Math.cos(c.ang) * 14, c.y - Math.sin(c.ang) * 14, c.ang + Math.PI + (Math.random() - .5) * .8, 20 + Math.random() * 30, 20 + Math.random() * 30, pick(RAINBOW), .8, false);
    if (c.washing) {
      c.dirt = Math.max(0, c.dirt - .9 * dt);
      if (Math.random() < dt * 30) addP({ t: 'bub', x: c.x + (Math.random() - .5) * 26, y: c.y + (Math.random() - .5) * 18, vx: (Math.random() - .5) * 12, vy: -12 - Math.random() * 14, life: 1, ml: 1 });
    }
    if (c.dirt > .8 && sp > 15 && Math.random() < dt * 3) mudBurst(c, 1);
    if (c.surf === 1 && !th.space && sp > 80 && Math.random() < dt * 10) addP({ t: 'dust', x: c.x - Math.cos(c.ang) * 14, y: c.y - Math.sin(c.ang) * 14, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, life: .55, ml: .55 });
    c.bump = (c.surf === 0 || c.surf === 2 || c.surf === 6) && sp > 25 && ((G.time * 14 + c.seed) | 0) % 2 ? 1 : 0;
    if (sp > 6) {
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
      for (const side of [-8, 8]) {
        const wx = c.x - fx * 11 - fy * side, wy = c.y - fy * 11 + fx * side;
        let col = null, a = 0;
        if (c.surf === 2) { col = th.mudTrail[0]; a = .5; }
        else if (c.surf === 6) { col = '#7d8188'; a = .55; }
        else if (c.surf === 3 || c.surf === 5) col = null;
        else if (c.mudTrail > 0) { col = th.mudTrail[1]; a = .45 * c.mudTrail / 1.6; }
        else if (c.wetTrail > 0 && c.surf === 1) { col = '#7a5a3a'; a = .3 * c.wetTrail; }
        else if (c.surf === 0) { col = th.trail; a = .1; }
        else if (!th.rainbow) { col = '#8a6440'; a = .09; }
        if (col) { tctx.globalAlpha = a; tctx.fillStyle = col; tctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2); }
      }
      tctx.globalAlpha = 1;
    }
    c.mudTrail = Math.max(0, c.mudTrail - dt); c.wetTrail = Math.max(0, c.wetTrail - dt * .7);
    if (G.state !== 'countdown') {
      if (!G.T.run) { updateProgress(c); if (c.surf !== 5 && c.off <= HALF + 1) c.safe = c.idx; }
      else if (!c.finished && c.y < G.T.finishY) { c.finished = true; c.place = 1; setState('finish'); SFX.fanfare(); }
    }
  }
  moveCamera(dt, false);
}

// theme ambience: gulls on the beach, butterflies on the meadow, fireflies and falling leaves in the forest

function spawnAmbient(dt) {
  const a = G.T.th.ambient, n = G.parts.reduce((s, p) => s + (p.t === 'bfly' || p.t === 'ffly' ? 1 : 0), 0);
  if (a === 'sakura') {
    // blossom petals blow across the garden, now and then a paper lantern floats over the track
    const np = G.parts.reduce((s, p) => s + (p.t === 'petal' ? 1 : 0), 0), nl = G.parts.reduce((s, p) => s + (p.t === 'lantern' ? 1 : 0), 0);
    if (np < 70 && Math.random() < dt * 14) addP({ t: 'petal', x: cam.x - 40 + Math.random() * (VW + 80), y: cam.y - 6, vx: 20, vy: 14 + Math.random() * 12, life: 10, ml: 10, ph: Math.random() * 10, col: pick(['#ffc2d6', '#ffd9e6', '#ff9fbf', '#ffffff', '#ffb3cc']) });
    if (nl < 3 && Math.random() < dt * .3) addP({ t: 'lantern', x: cam.x + 20 + Math.random() * (VW - 40), y: cam.y + VH + 14, vx: 8, vy: -(9 + Math.random() * 6), life: 40, ml: 40, ph: Math.random() * 10, col: pick(['#e8452c', '#ff8a2c', '#ffcf3f']) });
  }
  const rx = () => cam.x + Math.random() * VW, ry = () => cam.y + Math.random() * VH;
  if (a === 'gull' && Math.random() < dt * .3) { addP({ t: 'gull', x: cam.x - 20, y: cam.y + 20 + Math.random() * (VH - 70), vx: 55 + Math.random() * 30, vy: (Math.random() - .5) * 14, life: 12, ml: 12, ph: Math.random() * 10 }); if (Math.random() < .6) SFX.gull(); }
  if (a === 'butterfly' && n < 10 && Math.random() < dt * 2) addP({ t: 'bfly', x: rx(), y: ry(), vx: 0, vy: 0, life: 9, ml: 9, ph: Math.random() * 10, col: pick(['#ff5a7a', '#ffd93d', '#5ab4ff', '#ffffff', '#b36bff', '#ff9f43']) });
  if (a === 'firefly') {
    if (n < 22 && Math.random() < dt * 4) addP({ t: 'ffly', x: rx(), y: ry(), vx: 0, vy: 0, life: 7, ml: 7, ph: Math.random() * 10 });
    if (Math.random() < dt * 1.5) addP({ t: 'leaf', x: cam.x - 10 + Math.random() * VW, y: cam.y - 5, vx: 20, vy: 18 + Math.random() * 10, life: 12, ml: 12, ph: Math.random() * 10, col: pick(['#e08a2c', '#d9b43a', '#b5562a']) });
  }
}


function updateParticles(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i]; p.life -= dt;
    if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (p.t === 'd') {
      p.vz -= 300 * dt; p.z += p.vz * dt; p.vx *= .98; p.vy *= .98;
      if (p.z <= 0) { if (p.mud) { tctx.globalAlpha = .6; tctx.fillStyle = p.col; tctx.fillRect(p.x | 0, p.y | 0, p.s, p.s); tctx.globalAlpha = 1; } p.life = 0; }
    } else if (p.t === 'conf') p.x += Math.sin(G.time * 5 + p.ph) * 14 * dt;
    else if (p.t === 'bfly' || p.t === 'ffly') { const k = p.t === 'bfly' ? 90 : 30, m = p.t === 'bfly' ? 28 : 12; p.vx = clamp(p.vx + (Math.random() - .5) * k * dt, -m, m); p.vy = clamp(p.vy + (Math.random() - .5) * k * dt, -m, m); }
    else if (p.t === 'leaf') p.vx = 14 + Math.sin(G.time * 2 + p.ph) * 22;
    else if (p.t === 'petal') { p.vx = 18 + Math.sin(G.time * 2.2 + p.ph) * 22; if (p.y > cam.y + VH + 20) p.life = 0; }
    else if (p.t === 'lantern') { p.vx = 9 + Math.sin(G.time * 1.1 + p.ph) * 7; if (p.y < cam.y - 40 || p.x > cam.x + VW + 40) p.life = 0; }
    if (p.life <= 0) G.parts.splice(i, 1);
  }
}


export function update(dt) {
  touchBox.hidden = !coarse || G.state === 'title';
  if (G.state === 'pause') { engineSound(dt); Music.level(); honkBtn.textContent = 'OK'; return; } // the race stands still
  if (G.state === 'countdown') {
    const n = Math.floor(G.stateTime);
    if (n !== G.lastCount && n < 3) { G.lastCount = n; SFX.count(); }
    if (G.stateTime >= 3) { setState('race'); SFX.go(); }
  }
  if (G.state === 'countdown' || G.state === 'race' || G.state === 'finish') {
    if (G.tt && G.state === 'race') {
      G.tt.t += dt; G.tt.recT += dt; G.tt.deltaT = Math.max(0, G.tt.deltaT - dt);
      while (G.tt.recT >= GHOST_DT) { G.tt.recT -= GHOST_DT; ttSample(G.player); }
    }
    updateRace(dt);
    if (G.T.mudPix.length && Math.random() < dt * 10) { const j = pick(G.T.mudPix); addP({ t: 'mb', x: j % G.T.W, y: (j / G.T.W) | 0, life: .8, ml: .8 }); }
    const w = G.T.washC;
    if (w) for (let k = 0; k < 3; k++) {
      const ac = (Math.random() - .5) * 2 * HALF, al = (Math.random() - .5) * 6;
      addP({ t: 'd', x: w.x + w.nm.x * ac + w.tg.x * al, y: w.y + w.nm.y * ac + w.tg.y * al, z: 12, vx: 0, vy: 0, vz: -15, col: pick(WATC), s: 1, life: 1, ml: 1 });
    }
    if (G.T.shoreY) {
      G.T.boat.x += 9 * dt; if (G.T.boat.x > WW + 30) G.T.boat.x = -30;
    }
    spawnAmbient(dt);
    if (G.T.th.space && Math.random() < dt * .5) addP({ t: 'shoot', x: cam.x + Math.random() * VW, y: cam.y - 5, vx: 160 + Math.random() * 80, vy: 90 + Math.random() * 40, life: 1.4, ml: 1.4 });
    if (G.state === 'finish' && G.stateTime < 3.5) for (let k = 0; k < 4; k++) addP({ t: 'conf', x: Math.random() * VW, y: -4, vx: (Math.random() - .5) * 24, vy: 35 + Math.random() * 45, col: pick(CONF), ph: Math.random() * 10, life: 8, ml: 8 });
  }
  if (G.state === 'ceremony' && Math.random() < dt * 40) addP({ t: 'conf', x: Math.random() * VW, y: -4, vx: (Math.random() - .5) * 24, vy: 35 + Math.random() * 45, col: pick(CONF), ph: Math.random() * 10, life: 8, ml: 8 });
  updateParticles(dt);
  engineSound(dt);
  ambience(dt);
  Music.level();
  const label = G.state === 'race' || G.state === 'countdown' ? 'HUPE' : 'OK';
  if (honkBtn.textContent !== label) honkBtn.textContent = label;
}
