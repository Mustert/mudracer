import { G } from './g.js';
import { HALF, TAU, VH, VW, WH, WW, angDiff, clamp, hash, hex, inRange, mk, outlineImg, rng, toCanvas, vnoise } from './core.js';
import { obstacleGrid } from './grid.js';
import { TiledLayer } from './layer.js';
import { nearestIdx, paintSite, siteRing, siteYards } from './bau.js';
import { paintRing, ringTerrain } from './ringmap.js';
import { desertTerrain, paintDesert } from './desertmap.js';
import { iceTerrain, paintIce } from './icemap.js';
import { paintVolcano, volcanoTerrain } from './volcanomap.js';
import { jungleTerrain, paintJungle } from './junglemap.js';
import { paintSpace, spaceTerrain } from './spacemap.js';
import { paintSuess, suessTerrain } from './suessmap.js';
import { paintToys, toyTerrain } from './toymap.js';
import { paintRainbow, rainbowTerrain } from './rainbowmap.js';
import { beachTerrain, paintBeach } from './strandmap.js';
import { paintVillage } from './bahnmap.js';

// ---------- tracks (800x450 world) ----------

const MUDDY = { mud: ['#5a3a1f', '#4b301a', '#664327'], mudEdge: '#3b2512', mudHi: '#8a6440', water: ['#2f69ad', '#3f86d0', '#4b97df', '#5aa8ec'],
  shore: ['#6b4a2b', '#5c3f24'], mudP: ['#4a2f18', '#5a3a1f', '#6b4626', '#7d5a36'], mudTrail: ['#3a2410', '#5a3a1c'], goo: false };


export const THEMES = {
  wiese:  { ...MUDDY, grass: ['#63c24a', '#55b03e', '#74d05a'], grassEdge: '#4a9a36', tuft: '#3e8e2e', track: ['#c99e69', '#bb905b', '#d5ad79'], trackEdge: '#9b7349', trail: '#2f6d24', decor: 'wiese', tree: 'round', treeCol: ['#2d7a34', '#3f9a3f', '#66c25a', '#17401c'], trees: 26, fence: 'picket', ambient: 'butterfly' },
  gelaende: { ...MUDDY, grass: ['#6cbf4a', '#5eae3f', '#7ccc58'], grassEdge: '#4f9a36', tuft: '#468a30', track: ['#b98b58', '#aa7e4d', '#c79a66'], trackEdge: '#8a6440', trail: '#2f6d24', treeCol: ['#2d7a34', '#3f9a3f', '#66c25a', '#17401c'], ambient: 'butterfly' },
  wald:   { ...MUDDY, water: ['#1f4a5e', '#2a6078', '#35708a', '#4f8ea6'], leafWater: true, dark: true, mudEdge: '#d9b886', mudHi: '#b99468', fence: 'log', ambient: 'firefly', grass: ['#3f8d3c', '#367c33', '#4a9c47'], grassEdge: '#2f6e2c', tuft: '#27612a', track: ['#a9815a', '#9b744f', '#b68e65'], trackEdge: '#7b583a', trail: '#1f4a1f', decor: 'wald', tree: 'pine', treeCol: ['#1b573a', '#277048', '#3d9160', '#0d2e1e'], trees: 170, treeGap: 17, treeEdge: true },
  strand: { ...MUDDY, mud: ['#7d6038', '#6e522f', '#8b6c40'], mudEdge: '#5a4226', mudHi: '#b39566', mudP: ['#7d6038', '#8b6c40', '#6e522f', '#a58552'], water: ['#1d8fb3', '#2bb3cc', '#48cfd9', '#8aeee6'], shore: ['#c9a060', '#bf9655'],
    grass: ['#f3d995', '#ebcc81', '#f8e6b0'], grassEdge: '#dcb96c', tuft: '#e2c275', track: ['#bb8c5a', '#ae8050', '#c69864'], trackEdge: '#8f6a42', trail: '#b89656',
    decor: 'strand', tree: 'palm', treeCol: ['#2a8a3c', '#3cac4e', '#74d66c', '#18521f'], trees: 18, sea: true, fence: 'rope', ambient: 'gull' },
  garten: { ...MUDDY, water: ['#2a7184', '#34899b', '#43a0ae', '#7ccfd2'], shore: ['#8d8f86', '#777970'], grass: ['#6fb85a', '#62a84e', '#7ec766'], grassEdge: '#54944a', tuft: '#4d8a42',
    track: ['#c4ad86', '#b59d76', '#d0ba94'], trackEdge: '#948063', trail: '#3f7a35', decor: 'garten', tree: 'cherry', treeCol: ['#c4547f', '#e98cb0', '#f9cfdf', '#4a2438'], trees: 0, fence: 'bamboo', ambient: 'sakura' },
  baustelle: { ...MUDDY, water: ['#5d7f86', '#6b909a', '#7da3ac', '#a9cdd3'], shore: ['#5a4630', '#4d3a26'], grass: ['#9b9684', '#8f8a79', '#a8a392'], grassEdge: '#6f6a5a', tuft: '#7c7766',
    track: ['#b78a57', '#a97d4c', '#c39662'], trackEdge: '#845e38', trail: '#6a5a44', decor: 'bau', tree: 'none', treeCol: ['#000000', '#000000', '#000000', '#1b120c'], trees: 0, fence: 'mesh' },
  // race circuit: asphalt (faster than earth roads), oil instead of mud (it makes the cars black: goo 'oil'), start lights instead of 3-2-1
  ring: { ...MUDDY, mud: ['#1a1a1f', '#141418', '#24242b'], mudEdge: '#0a0a0c', mudHi: '#5a4f86', mudP: ['#101014', '#1c1c22', '#2a2a32', '#0a0a0c'], mudTrail: ['#0e0e10', '#18181c'], goo: 'oil',
    grass: ['#5fb04a', '#55a242', '#6bbd55'], grassEdge: '#4a9038', tuft: '#478a35', track: ['#55565b', '#4d4e53', '#5d5e63'], trackEdge: '#ecece6', trail: '#2f6d24', roadTrail: '#232327',
    decor: 'ring', tree: 'round', treeCol: ['#2d7a34', '#3f9a3f', '#66c25a', '#17401c'], trees: 12, asphalt: 1.03, lights: true,
    // on asphalt the cars are closer together: only this share of the difference in top speed counts (so the fast cars do not run away)
    flat: .5 },
  // desert: a sand road, the dunes beside it make the cars sandy (dusty), sand drifts instead of mud (goo 'sand': beige cars), an oasis washes
  wueste: { ...MUDDY, mud: ['#d9b77a', '#cfa96a', '#e3c48c'], mudEdge: '#b8915a', mudHi: '#f6e2b4', mudP: ['#e3c48c', '#d4b074', '#c49a5c', '#f0d9a6'], mudTrail: ['#b8915a', '#c9a46c'], goo: 'sand',
    water: ['#1f8c9c', '#2fa6b2', '#46bcc2', '#8ee0dc'], shore: ['#c2a266', '#b39256'], grass: ['#ecca8a', '#e2bf7c', '#f4d69e'], grassEdge: '#d6b070', tuft: '#c9a060',
    track: ['#d9b57c', '#cfaa6e', '#e2c08a'], trackEdge: '#b8915a', trail: '#c69a5c', roadTrail: '#9c7444', trailA: .16, decor: 'wueste', tree: 'none', treeCol: ['#2a8a3c', '#3cac4e', '#74d66c', '#18521f'], trees: 0, dusty: true },
  // ice: packed snow road, deep snow instead of mud (goo 'snow': white cars), sheet ice (terrain 12), a hot spring washes
  eis: { ...MUDDY, mud: ['#f2f6fb', '#e4ecf5', '#fdfeff'], mudEdge: '#c2d2e2', mudHi: '#ffffff', mudP: ['#ffffff', '#eef4fa', '#dce8f2', '#f8fbff'], mudTrail: ['#c8d6e4', '#dde7f0'], goo: 'snow',
    water: ['#2c98a6', '#3eb2ba', '#5ac8c8', '#a4ece8'], shore: ['#9aa8b6', '#8b99a8'], grass: ['#eef4fa', '#e3ebf4', '#f9fbfe'], grassEdge: '#cfdbe8', tuft: '#d6e0ec',
    track: ['#dfe6ef', '#d3dbe6', '#e9eef5'], trackEdge: '#aebdcd', trail: '#c4d0dc', roadTrail: '#8f9eb0', trailA: .14, decor: 'eis', tree: 'pine', treeCol: ['#2b5a45', '#e6f0f6', '#ffffff', '#163428'], trees: 30, treeGap: 22,
    landCol: ['#ffffff', '#e6eef6', '#cfdcea'] },
  // volcano: cooled lava road (dark grey, glowing cracks), ash instead of mud (goo 'ash': sooty cars), lava (terrain 15) burns, a waterfall washes
  vulkan: { ...MUDDY, mud: ['#b4b0aa', '#a29e98', '#c4c0ba'], mudEdge: '#8a8680', mudHi: '#dedad4', mudP: ['#c4c0ba', '#a29e98', '#8a8680', '#dedad4'], mudTrail: ['#8a8680', '#a29e98'], goo: 'ash',
    water: ['#2a7fa8', '#3a98c2', '#58b4d8', '#9edcf0'], shore: ['#3a3634', '#2e2a28'], grass: ['#4a4442', '#423c3a', '#544e4a'], grassEdge: '#36302e', tuft: '#5a3a2a',
    track: ['#3c3a3a', '#363434', '#444242'], trackEdge: '#262424', trail: '#2a2624', roadTrail: '#8a8682', trailA: .12, decor: 'vulkan', tree: 'none', treeCol: ['#000000', '#000000', '#000000', '#140c0a'], trees: 0 },
  // jungle: a wet earth road, swamp instead of mud (goo 'swamp': green cars), a river (deep: you fall in), dense trees everywhere
  dschungel: { ...MUDDY, mud: ['#4e5a2a', '#424e22', '#5a6a32'], mudEdge: '#33401a', mudHi: '#8aa83a', mudP: ['#4e5a2a', '#5a6a32', '#6a8a3a', '#3a4a1e'], mudTrail: ['#33401a', '#465626'], goo: 'swamp',
    water: ['#2a6a6a', '#2f8080', '#3c9490', '#7cc4b4'], shore: ['#4a3a22', '#3e301c'], grass: ['#2f6a2a', '#286024', '#367a30'], grassEdge: '#22501e', tuft: '#1e4a1a',
    track: ['#7a5a36', '#6e5030', '#86643e'], trackEdge: '#4e3a22', trail: '#1e4a1a', roadTrail: '#4a3420', decor: 'dschungel', tree: 'round', treeCol: ['#1e5a24', '#2f7a2e', '#5aa83e', '#0e2e12'], trees: 46, treeGap: 22, ambient: 'butterfly', beams: true },
  // space: metal platforms in zero gravity (terrain 17, little grip), the station and the glass tube with gravity (terrain 1), the moon (its road 1,
  // its ground 13), moon dust instead of mud (goo 'dust': silver cars), next to the platforms is nothing (terrain 0: you drift off, a tractor beam
  // brings you back). flat: the top speeds are closer together, here the acceleration counts
  weltall: { ...MUDDY, mud: ['#b9bcc4', '#a9acb5', '#c9ccd3'], mudEdge: '#8c8f99', mudHi: '#eceef3', mudP: ['#c9ccd3', '#b0b3bb', '#9a9da6', '#e2e4ea'], mudTrail: ['#8c8f99', '#a4a7b0'], goo: 'dust',
    grass: ['#05061a', '#0a0b26', '#14103c'], grassEdge: '#1c1e40', tuft: '#05061a', track: ['#3c465a', '#363f52', '#434e63'], trackEdge: '#5fe8ff', trail: '#2a2c48', roadTrail: '#4a4e5c', trailA: .07,
    decor: 'weltall', tree: 'none', treeCol: ['#000000', '#000000', '#000000', '#0a0a16'], trees: 0, space: true, glowTrail: true, flat: .6 },
  // Süßigkeitenland: a liquorice road, icing with sprinkles beside it, chocolate instead of mud (goo 'choco': brown cars), caramel that sticks
  // (goo2 'caramel': golden cars, see suess.js), the lake and the river are deep chocolate (water: its colours), a lemonade fountain washes
  suess: { ...MUDDY, mud: ['#5a3020', '#4a2618', '#6a3a26'], mudEdge: '#3a1a0e', mudHi: '#9a5a3a', mudP: ['#5a3020', '#6a3a26', '#4a2618', '#9a5a3a'], mudTrail: ['#3a1a0e', '#5a3020'], goo: 'choco', goo2: 'caramel',
    water: ['#40200f', '#4a2615', '#56301c', '#70422a'], shore: ['#fff8ec', '#f6e6cc'], grass: ['#f7b6d0', '#f2a8c6', '#fbc6dc'], grassEdge: '#e48cb2', tuft: '#ffffff',
    track: ['#2a2028', '#241b22', '#30262e'], trackEdge: '#0e080c', trail: '#e48cb2', roadTrail: '#4a3a44', trailA: .1, decor: 'suess', tree: 'none', treeCol: ['#000000', '#000000', '#000000', '#3a1a24'], trees: 0,
    ambient: 'butterfly', landCol: ['#ff4d6d', '#ffd93d', '#6bcb77', '#4d96ff', '#ffffff'] },
  // kids' room: the printed road of the play mat, parquet (terrain 30, slippery), the bed and the desk up high, plasticine instead of mud in four
  // colours (goo 'knete': colourful cars), the robot vacuum spits cars out grey (the cement set, see toys.js)
  spielzimmer: { ...MUDDY, mud: ['#e04848', '#3c6ee0', '#f2cc30'], mudEdge: '#7a2a2a', mudHi: '#ffffff', mudP: ['#e04848', '#3c6ee0', '#f2cc30', '#40b850'], mudTrail: ['#c84a6a', '#8a6ab0'], goo: 'knete',
    grass: ['#c8915a', '#bd8650', '#d29c64'], grassEdge: '#7e5230', tuft: '#ad7844', track: ['#6e747c', '#666c74', '#787e86'], trackEdge: '#f4f4ee', trail: '#4a7a3e', roadTrail: '#5a4a3a', trailA: .06,
    decor: 'spielzimmer', tree: 'none', treeCol: ['#000000', '#000000', '#000000', '#2a1a10'], trees: 0 },
  // the rainbow (the finale): a rainbow road of six colour lanes over a sea of clouds (terrain 41..46, see rainbowmap.js), soft clouds beside it (slow, the
  // car stays clean), cloud holes further out (48: you fall through), storm clouds instead of mud (goo 'storm': grey cars; the brown mud puddle of the
  // bronze coin uses the second set of sprites, def.goo2). rainbow: no tyre tracks on the rainbow road
  regenbogen: { ...MUDDY, mud: ['#6c7280', '#5d6270', '#7e8492'], mudEdge: '#454a56', mudHi: '#c8ccd6', mudP: ['#6c7280', '#7e8492', '#9aa0ad', '#545a66'], mudTrail: ['#4a4f5c', '#5d6270'], goo: 'storm',
    water: ['#5a9ac0', '#7fc4e8', '#95d2f0', '#e8f6ff'], grass: ['#e3e6f7', '#f2f3fc', '#ffffff'], grassEdge: '#cfd4ef', tuft: '#e3e6f7', track: ['#ff4d6d', '#ffd93d', '#4d96ff'], trackEdge: '#ffffff',
    trail: '#cfd4ef', roadTrail: '#8a7a6a', trailA: .07, decor: 'regenbogen', tree: 'none', treeCol: ['#000000', '#000000', '#000000', '#1b120c'], trees: 0, rainbow: true,
    landCol: ['#ffffff', '#e6eef6', '#cfdcea'] },
  bahn:   { ...MUDDY, grass: ['#8fbf4a', '#7fae3f', '#9fcc5a'], grassEdge: '#6f9a33', tuft: '#5f8a2a', track: ['#c99e69', '#bb905b', '#d5ad79'], trackEdge: '#9b7349', trail: '#4f7a22', decor: 'farm', tree: 'round', treeCol: ['#2d7a34', '#3f9a3f', '#66c25a', '#17401c'], trees: 18 },
};


// the wooden pier along the lower part of the beach track: it is there from the start, the flood rises around it later.
// It runs from where the track first dips below the line y (a wavy line, the same as the later shoreline, at the mud) to where it
// comes back up shortly before the finish, and bridges the dry stretch in between. 2 x half wide.
// Rev 3: half 12 instead of 8 (wider, easier to drive), flood = how high the sea rises (events.js FLOOD), lower than the line y
export const PIER = { half: 12, y: 284, flood: 310 };
export const PILE = [[138, 100, 64], [59, 37, 18]]; // a pile beside the pier: its lit top, the dark wood
export const PIER_WAVE = x => Math.sin(x / 40) * 5 + Math.sin(x / 13) * 2;
export function pierColor(d, nr, x, y) {
  if (hash(x, y, 53) < .03) return [118, 82, 40];
  return d > PIER.half - 1.6 ? [74, 47, 24] : ((nr >> 1) & 1) ? [184, 134, 76] : [163, 114, 56];
}


const S2 = a => a.map(p => [p[0] * 2, p[1] * 2]);


const B2 = a => a.map(m => [m[0], m[1] * 2, m[2] * 2, m[3] * 2]);


// points on a circle (centre, radius, from and to in degrees, clockwise on the screen), as plain poly points: a big even curve
const ARC = (cx, cy, r, a0, a1, step = 5) => { const out = []; for (let a = a0; a <= a1 + .01; a += step) out.push([cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r, 0]); return out; };


const TRACK_DEFS = [
  { name: 'WIESE', rev: 2, events: ['kuehe'], theme: 'wiese', song: 'kart', wallStyle: 'fence', wall: [{ x: 420, y: 190, ang: 0 }], pts: S2([[66, 72], [76, 48], [150, 38], [215, 72], [285, 40], [352, 60], [365, 140], [322, 193], [238, 188], [182, 152], [124, 193], [68, 195], [64, 140]]),
    // rev 2: the start moved up the straight on the left (the grid stands straight); mud and puddles sit on the inside of the bends (the short line),
    // the outside stays clean (the long line): [t, offset from the centre line (+ = inside), half length, half width]
    mud: [[.097, 16, 52, 19], [.418, 16, 58, 19], [.661, 15, 48, 18]], water: [[.253, -14, 34, 19], [.525, 17, 40, 19], [.778, 14, 32, 18]], ponds: [[400, 226, 46, 26]], wash: .865 },
  // rev 3: mud on the top left and top right only on the outer side (on the inside the line stays clean), the mud on the lower left only on
  // the lower edge; mud and puddles are half full (grow: half the area) until the rain fills them up (events.js growPuddles)
  { name: 'WALD', rev: 3, grow: .5, events: ['regen'], theme: 'wald', song: 'forest', wallStyle: 'logs', wall: [{ x: 410, y: 248, ang: 0 }], pts: S2([[58.6, 80], [59.4, 66], [72, 48], [150, 42], [205, 98], [262, 42], [345, 58], [360, 150], [292, 192], [205, 150], [125, 193], [80, 214], [50, 206], [52.5, 170], [54.5, 140], [56.1, 116], [57.6, 94]]),
    mud: B2([[.104, -7, 14, 10], [.35, -8, 15, 9], [.55, 5, 12, 12], [.754, -10, 13, 8]]), water: B2([[.22, -5, 10, 9], [.64, 0, 14, 18], [.86, 4, 10, 8]]), ponds: [], wash: .94 },
  // Revision 2: the start line moved to the long straight on top (the grid stands straight; the control points are rotated, the t values moved by -.327),
  // the big mud on the right corner sits higher (the flood line cut it in half), the small mud on the flooded lower road moved to the left bend,
  // the mud looks like wet sand, the showers wash more slowly (update.js).
  // Revision 3: the lagoon in the infield is a beach volleyball court with a narrow short cut through it (volley: the lane, its half width,
  // the court [cx, cy, half width, half height]; strandmap.js, strand.js), the shower behind the finish line moved up the top straight (before the line).
  { name: 'STRAND', rev: 3, events: ['flut'], pier: true, beach: true, theme: 'strand', song: 'beach', wallStyle: 'bar', wall: [{ x: 330, y: 190, ang: 0 }], pts: S2([[250, 50], [322, 52], [358, 96], [335, 152], [262, 135], [205, 178], [120, 184], [52, 160], [60, 105], [112, 52], [180, 50]]),
    mud: B2([[.165, 0, 18, 18], [.72, 0, 14, 18], [.8, 4, 6, 7]]), water: [], ponds: [], wash: null,
    volley: { pts: [[530, 268, 0], [462, 252, 40], [300, 250, 0], [196, 251, 40], [146, 236, 26], [126, 200, 0]], half: 12, court: [300, 250, 66, 36] },
    // small beach showers that run all the time, each one leaves a mini puddle (t along the track, offset from the centre line); none on the lower part that gets flooded
    showers: [[.89, -15], [.105, -15], [.77, -15]] },
  // Rev 1 (1S4-1): a bigger map, the start on the straight left side; a ramp on the outer half of the road before the lower crossing
  // (jumps = [x, y, speed upwards, side: -1 outer half, 1 inner half]) lets you jump over the train; the train comes more often from lap to lap (train.js)
  // Rev 2 (1S4-2): the mud moved (one between the crossings on top, a new one on the outer half, the right one split into two halves, one straight
  // before the first ramp), a second ramp on the inner half before the left crossing, both ramps of grey concrete, the car wash on the left
  // straight behind the grid, no pond and no puddle in the lower left bend; a Bavarian village around the track (bahnmap.js); a train on each line.
  // Rev 3: a ramp at every crossing, in a lane of its own beside the barrier (railJump, see buildTrack): the road widens by w px on one side
  // (sides in the order of rail.cross: line 602 top, bottom, line 420 top, bottom; -1 outer, 1 inner) from `from` to `to` px along the road
  // around the crossing (Rev 3 had an island with the post of the boom between road and lane); the lip lies `lip` px before the rails, and every jump
  // leaves it with a forward speed between push and cap, so it always lands well behind the rails (the train only hits cars on the ground)
  // Rev 4 (1S4-8): no booms and no islands any more (the lane is simply wider road); one blinking warning light per crossing on the other side
  { name: 'ZUG', rev: 4, seed: 4, W: 1120, H: 630, events: ['zug'], theme: 'bahn', song: 'train', wallStyle: 'barrier', wall: [{ x: 511, y: 300, ang: 0 }], tunnels: [{ x: 511, y: 300, hw: 164, portals: [420, 602] }],
    pts: [[180, 240], [180, 160], [240, 112], [364, 112], [602, 123], [840, 112], [980, 182], [994, 420], [896, 518], [602, 507], [350, 518], [260, 548], [180, 500], [180, 400], [180, 320]],
    mud: [[.182, 12, 28, 22], [.254, -15, 24, 16], [.452, -15, 26, 16], [.487, 15, 26, 16], [.641, -16, 22, 15]], water: [[.36, -10, 20, 18], [.55, 0, 24, 36]], ponds: [], rail: { x: 602, lines: [602, 420] }, wash: 0, washAt: [180, 482],
    railJump: { w: 38, from: -100, to: 95, lip: -36, vz: 105, push: 170, cap: 200, sides: [-1, 1, -1, 1] }, village: true },
  // The building site: the road is packed earth. Everything inside the ring road is yard (solid, see bau.js), the road narrows at barriers, a crane
  // holds a concrete pipe over the road, a cement mixer leaks a grey puddle onto it, and dump trucks tip earth beside it (event kipper).
  // poly = [x, y, curve radius] (rounded corners), mudAt/waterAt/cement = [x, y, half length along the road, half width across]
  { name: 'BAUSTELLE', rev: 3, seed: 6, theme: 'baustelle', song: 'site', events: ['kipper'], wall: [], wash: 0, washAt: [215, 375],
    poly: [[75, 130, 0], [75, 75, 30], [265, 75, 45], [265, 215, 45], [405, 215, 45], [405, 75, 45], [725, 75, 45], [725, 185, 45], [565, 185, 45], [565, 280, 45], [725, 280, 45], [725, 375, 52],
      [475, 375, 45], [475, 300, 45], [335, 300, 45], [335, 375, 45], [75, 375, 30]],
    mud: [], water: [], ponds: [],
    // no puddles: whoever got dirty washes at one of the two hoses or in the car wash at the end of the lap (grey cement stays until then)
    mudAt: [[98, 98, 24, 18], [650, 280, 15, 17], [475, 340, 30, 34]],
    // cement on the inner side of the left bend (the mixer leaks onto it); the outer 28 px stay clean, a longer line around it
    cement: [[283, 150, 22, 20]],
    yards: [[96, 96, 610, 270], [296, -10, 82, 120], [366, 350, 78, 110], [690, 196, 120, 60]],
    narrows: [[175, 75, 1], [560, 375, 1], [165, 375, -1]],
    // cones: a narrow place built from traffic cones on both sides. hoses: spray spots (x, y, r) on the outer lane of a curve (top right, bottom right), hydrant at rx/ry
    cones: [[645, 185]],
    hoses: [{ x: 721, y: 79, r: 10, rx: 744, ry: 56 }, { x: 721, y: 371, r: 10, rx: 744, ry: 394 }],
    mixer: { x: 322, y: 96 }, crane: { x: 588, y: 128, pipe0: 552, pipeLen: 72, pipeD: 20, pipeY: 75 },
    // [x, y, side, seconds between two visits, first arrival]: the truck stands beside the road, outside
    kipper: [[75, 160, -1, 23, 12], [470, 75, -1, 26, 3], [725, 130, -1, 29, 8], [620, 375, -1, 25, 14]] },
  // GARTEN Rev 3: start on the straight in the middle of the left half (the left road moved west for a straight grid), a big lake between the
  // three bridges with a path of stepping stones from the right road (past a torii) to the corner after the slanted bridge: it saves all three
  // bridges. Floating lanterns, two koi leaps over the stones and a koi that spits from beside the big stone (events.js). The bridges end square.
  // Rev 4: the way into the short cut is open (two stones in the grass, the torii moved beside it, 1S6-10); the palisade at the water is one
  // solid line whose obstacles match what you see (1S6-11).
  { name: 'GARTEN', rev: 4, seed: 5, theme: 'garten', song: 'garden', events: ['kois'], wall: [], wash: null, squareBridges: true,
    pts: [[308,198], [334,195], [347,167], [338,135], [305,120], [240,120], [180,120], [148,108], [134,80],
      [148,52], [180,40], [250,40], [320,40], [392,42], [424,52], [444,80], [447,125], [458,168], [484,198], [515,211], [546,198], [572,168], [583,125],
      [585,90], [595,62], [620,43], [642,38], [665,43], [690,62], [700,90], [706,140], [700,200], [692,255], [690,282], [690,300], [688,335], [678,368],
      [654,392], [620,402], [560,403], [500,403], [440,402], [410,400], [388,393], [375,377], [372,355], [370,335], [360,322], [345,317], [300,316],
      [260,318], [232,328], [212,350], [205,376], [204,392], [192,405], [165,412], [128,409], [96,394], [72,368], [60,332], [57,290], [57,252],
      [59,226], [67,209], [84,200], [120,198], [170,198], [220,198], [262,198]],
    // mud and puddles [x, y, half length along the road, half width across]: on the inner line of a bend (or one half of a straight), the other
    // half of the road stays clean, so driving through is a choice. The puddles wash, there is no car wash.
    mud: [], water: [], ponds: [],
    mudAt: [[257, 331, 22, 17], [155, 96, 22, 17], [236, 26, 26, 17], [688, 102, 24, 17], [711, 220, 24, 17]],
    waterAt: [[150, 397, 22, 16], [515, 196, 26, 17], [671, 395, 22, 16]],
    // deep water: rivers, ponds and the lake as chains of circles [x, y, radius]. The river from the top runs into the pool inside the first U, the
    // river from the right edge runs under the right bridge into the lake, the lake drains south under the lower bridge and west through a
    // channel under the slanted bridge into the pond, which has a stream to the south. You fall into deep water, roads over it are bridges.
    rivers: [
      [[515, -14, 10], [515, 38, 11], [515, 82, 35], [515, 114, 14], [515, 140, 22]],
      [[812, 299, 13], [742, 301, 13], [664, 302, 13]],
      [[438, 278, 26], [490, 284, 38], [545, 290, 42], [594, 280, 36], [630, 292, 22], [664, 302, 13]],
      [[432, 312, 24], [470, 334, 24], [520, 336, 22], [560, 326, 24], [604, 316, 18]],
      [[510, 345, 14], [500, 386, 13], [500, 422, 13], [502, 462, 13]],
      [[446, 326, 12], [410, 352, 11], [372, 354, 10], [330, 354, 10], [300, 366, 14]],
      [[264, 378, 24], [312, 378, 24]], [[288, 378, 26], [288, 378, 26]],
      [[288, 400, 12], [288, 462, 13]]],
    // stepping stones [x, y, radius, stretch, angle]: the short cut across the pool at the top, and the path across the lake from the right road
    // (past the torii) and the big stone to the corner after the slanted bridge
    // (Rev 4, 1S6-10: two stones in the grass lead from the road edge to the water, the torii stands beside the way in, not in it;
    // 1S6-12: the big stone is larger, the stone after it moved closer, all lake stones 5 % larger, no gap wider than about 12 px)
    stones: [[493, 84, 10], [517, 74, 10], [540, 86, 10],
      [650, 252, 8.4], [632, 257, 8.4], [613, 261, 9.5], [587, 278, 9.5], [560, 296, 10.5], [524, 318, 14, 2.2, .1], [478, 319, 9.5], [454, 318, 9.5], [430, 318, 9.5]],
    // clipped hedges that keep you from cutting across the garden: [x1, y1, x2, y2]; the right one bends along the lake to the torii
    hedges: [[12, 159, 333, 159], [172, 80, 396, 80], [100, 258, 396, 258], [396, 78, 396, 300], [642, 98, 642, 222], [642, 222, 570, 241], [152, 260, 152, 376]],
    torii: [598, 236, 12],
    pagodas: [[764, 142, 4, 1.15], [764, 388, 4, 1.15]],
    // the decoration is laid out by hand, in lines and pairs: cherry trees, stone lanterns, bonsai in pots
    cherries: [[28, 34], [78, 34], [28, 104], [78, 104], [768, 40], [768, 236]],
    lanterns: [[53, 72], [13, 215], [13, 265], [13, 315], [13, 365], [13, 415], [486, 122], [544, 122], [628, 190], [656, 190], [764, 100], [764, 188], [764, 346], [764, 440]],
    bonsai: [[118, 292], [118, 340], [628, 104], [656, 104]],
    // floating lanterns on the lake [x, y, rx, ry] and koi swimming circles [x, y, rx, ry] (both shrink until they keep clear of stones and shore)
    floats: [[443, 274, 8, 4], [482, 280, 10, 4], [542, 266, 10, 4], [598, 318, 7, 4]],
    koi: [[515, 140, 11, 9], [515, 106, 14, 5], [288, 382, 16, 7], [470, 290, 18, 6], [560, 336, 14, 5], [440, 290, 10, 6]] },
  // The race circuit: an 8 on asphalt, the road crosses itself on a bridge (first over it, later underneath). Kerbs inside the corners, gravel
  // outside, oil instead of mud, a pit lane along the start straight whose box washes the car, barriers all around (see ringmap.js, ring.js).
  // oilAt = [x, y, half length, half width]; gravel and stacks (tyre walls) = [x, y, radius]; pit = lane points, half width, box (y from, to),
  // pit wall [x, y from, to], garages [x0, y0, x1, y1]; rollers = [x, y, seconds between two tyres, first one] (event reifen: the first tyre
  // at each place comes about when the field gets there in lap 1; only in turn 1 it waits until the field has gone)
  { name: 'RENNSTRECKE', rev: 3, seed: 7, theme: 'ring', song: 'circuit', events: ['reifen'], wall: [], wash: null, ring: true,
    poly: [[70, 130, 0], [70, 55, 55], [165, 55, 22], [195, 100, 22], [255, 100, 22], [285, 55, 22], [345, 55, 60], [540, 395, 65], [730, 395, 55], [730, 55, 48], [630, 55, 48],
      [630, 175, 50], [270, 395, 65], [70, 395, 55]],
    mud: [], water: [], ponds: [],
    // the small patch on the lower right straight lies on the upper half of the road: along the lower edge there is a clean lane
    oilAt: [[730, 150, 30, 22], [300, 64, 22, 18], [340, 362, 26, 18], [640, 386, 17, 11]],
    gravel: [[40, 30, 85], [700, 22, 95], [760, 425, 70]], stacks: [[680, 125, 40]],
    // the pit lane forks off at the start of the bottom straight, runs behind the pit wall and joins the start straight again before turn 1.
    // The pit wall stands right at the edge of the lane, the barrier in front of the garages closes the other side: no way past the box.
    pit: { pts: [[238, 381, 0], [148, 381, 32], [148, 214, 46], [93, 120, 0]], half: 15, box: [270, 306], wall: [126, 232, 350], garage: [174, 226, 212, 348] },
    rollers: [[730, 262, 12, 11], [600, 395, 13, 9], [120, 55, 11, 8], [400, 316, 12, 16], [225, 100, 14, 5]],
    // scenery: stands [x, y, w, h, facing down 1 / up -1], team trucks [x, y, team], helipad, big screen, a flag mown into the grass, camera towers
    stands: [[405, 6, 168, 32, 1], [358, 410, 136, 36, -1]], heli: [530, 118], screen: [450, 58], flag: [575, 275, 56, 40], towers: [[268, 210], [380, 388]],
    trucks: [[230, 158, 0], [248, 158, 1], [266, 158, 2], [284, 158, 3], [302, 158, 4], [230, 262, 5], [248, 262, 6], [266, 262, 7], [284, 262, 1]] },
  // The desert: a sand road with three dunes to jump over, through the big pyramid (a long dark tunnel), past two cacti, the gorge (the short way
  // is the jump from the rocky ramp, the safe long way dips down to the swinging rope bridge), quicksand beside the road, the oasis on a side
  // path at the top (see desertmap.js, desert.js).
  // oasis = pond [x, y, rx, ry], the side path through its shallow water (points, half width), a signpost at the turn-off [x, y]; dunes = x of the crests on the top straight (y);
  // pyramid = [x, y, half size]; cacti = [x, y] on the road; canyon = x, half width, from y, y of the road over it, ramp lip x and its y range,
  // rope bridge y (middle) and half width, the long way to it (points, half width); quick = quicksand [x, y, r] (its middle beside the road,
  // it reaches over the edge and pulls you off); drifts = where the sandstorm blows sand onto the road [x, y, r]; minis = small pyramids
  // [x, y, half size]; sphinx = [x, y]; ridges = rock ridges between the pyramids and the head of the gorge (the dunes in the middle are closed,
  // nobody cuts through); heat = places over the road where the air flickers [x0, y0, x1, y1]
  // Revision 1: the start line moved to the long straight on the left (the grid stands straight), the right side bends (the road follows the wadi).
  // Revision 2: 110 px higher (the oasis on its own path at the top, the bridge on its own long way), the pyramid half as big again, quicksand
  // beside the road, rock ridges instead of chains of boulders.
  { name: 'WUESTE', rev: 2, seed: 8, H: 560, theme: 'wueste', song: 'desert', events: ['sandsturm'], wall: [], wash: null, desert: true,
    poly: [[70, 190, 0], [70, 120, 50], [680, 120, 45], [680, 225, 38], [640, 312, 42], [690, 440, 55], [70, 440, 20]],
    mud: [], water: [], ponds: [],
    oasis: { pond: [262, 44, 70, 26], path: [[150, 110, 0], [178, 58, 22], [348, 58, 22], [376, 110, 0]], half: 14, sign: [128, 79] },
    dunes: [222, 302, 408], pyramid: [600, 150, 120],
    cacti: [[644, 348], [680, 388]],
    canyon: { x: 556, hw: 20, y0: 336, ym: 440, lip: 582, lane: [410, 470], bridge: 524, bh: 14,
      path: [[664, 452, 0], [632, 524, 22], [488, 524, 22], [462, 452, 0]], half: 14 },
    quick: [[396, 484, 28], [300, 396, 28], [188, 486, 30]],
    drifts: [[88, 150, 12], [300, 118, 14], [150, 440, 13]],
    ridges: [[[126, 232], [170, 252], [214, 258], [270, 270]], [[330, 274], [380, 288], [430, 300]], [[476, 306], [522, 322]], [[468, 284], [492, 266]]],
    heat: [[110, 94, 470, 146], [120, 414, 520, 466]],
    minis: [[300, 280, 30], [452, 300, 22]], sphinx: [760, 352] },
  // The ice: the ski jump (a boost pad on the run-up, about a second in the air), the bob run with springy walls and a hairpin, deep snow and the
  // penguins on the way down, the frozen lake (the road goes round it, the short cut across the thin ice cracks and breaks), a wooden bridge over
  // the glacier stream, then the icy run down to the line past the hot spring (see icemap.js, ice.js).
  // jump = lip [x, y] and the speed upwards; landing = the icy slope after it; slopes = [x0, y0, x1, y1 of the stretch, push]; bob = road from [x, y] to [x, y];
  // lake = [x, y, rx, ry]; spring = hot spring [x, y, rx, ry]; frost = the three corners that freeze from lap 2; colony = penguins [x, y] (in the bay of the glacier);
  // avalanche = from [x, y] to [x, y]; village = the ski hut [x, y]; the start line is on the straight at the left, rev 1 (the start moved up, the infield is a glacier)
  { name: 'EIS', rev: 1, seed: 9, theme: 'eis', song: 'ice', events: ['frost', 'pinguine'], wall: [], wash: null, ice: true,
    poly: [[70, 135, 0], [70, 55, 50], [745, 55, 50], [745, 165, 50], [600, 165, 40], [600, 395, 45], [520, 395, 40], [520, 262, 40], [280, 262, 40], [280, 395, 40], [70, 395, 50]],
    mud: [], water: [], ponds: [],
    boostAt: [[168, 55]], jump: [246, 55, 190], landing: [[392, 55], [540, 55]],
    slopes: [[392, 55, 540, 55, 46], [262, 395, 70, 345, 34]],
    bob: [[592, 55], [612, 165]],
    // deep snow grows in from the outside of two bends (drifts = [x, y of the bend, half length in path points, depth in px, a point on the outer side])
    drifts: [[280, 262, 38, 20, 250, 232], [520, 262, 38, 20, 548, 238]],
    lake: [400, 372, 118, 72],
    // the stream starts in the ice gate at the foot of the glacier
    rivers: [[[206, 238, 6], [210, 270, 8], [214, 320, 10], [217, 380, 11], [218, 400, 12], [220, 462, 12]]], gate: [206, 236],
    // glacier = the solid infield (rects [x0, y0, x1, y1, wobble of the lower edge]; bay = the notch for the colony); ridges = [x0, y0, x1, y1, half width];
    // slope = the steep face under the ridge on the right, outcrops = rocks in it
    glacier: { rects: [[100, 90, 740, 138], [100, 90, 575, 238, 12]], bay: [400, 214, 42, 22] },
    ridges: [[560, 198, 560, 366, 6], [642, 208, 800, 208, 7]], slope: [640, 213, 800, 330], outcrops: [[700, 236], [764, 262], [668, 292], [776, 304]],
    spring: [148, 428, 26, 15],
    frost: [[70, 55], [600, 395], [70, 395]], colony: [400, 214], avalanche: [[790, 222], [590, 248]],
    village: [150, 300] },
  // The volcano: up the flank in a serpentine, along the crater rim (the short cut over a crust that breaks through, or the long way over a stone
  // bridge), down past the steam geyser (it throws you over a lava ditch, or you take the bend), through a lava tube, over the lava ford (one of
  // two stone bridges is always flooded) and past the waterfall back to the research station (see volcanomap.js, volcano.js).
  // crater = lava lake [x, y, rx, ry]; stream = the lava stream from the crater over the rim road [x, half width]; bypass = the long way (points, half width);
  // geyser = [x, y] on the short cut (shortcut = its points, half width), ditch = lava [x0, y0, x1, y1]; tube = the lava tube from [x, y] to [x, y];
  // ford = lava river [x, half width], lanes = offsets of the two stone bridges; fall = the waterfall [x, y]; walls = rock walls [x1, y1, x2, y2];
  // station = research station [x, y]; tongue = where the lava runs over the serpentine in the eruption [x, y]; ash = ash fields [x, y, half length, half width]
  { name: 'VULKAN', seed: 10, theme: 'vulkan', song: 'volcano', events: ['ausbruch'], wall: [], wash: null, volcano: true,
    poly: [[60, 330, 0], [60, 255, 38], [250, 255, 40], [250, 170, 40], [80, 170, 37], [80, 95, 37], [720, 95, 45], [720, 150, 40], [630, 190, 40], [630, 280, 40], [720, 320, 40],
      [720, 410, 40], [660, 410, 30], [630, 378, 30], [570, 378, 30], [540, 410, 30], [60, 410, 30]],
    mud: [], water: [], ponds: [],
    crater: [470, 240, 102, 82], stream: [470, 20], bypass: { pts: [[392, 95, 0], [392, 28, 16], [548, 28, 16], [548, 95, 0]], half: 15 },
    geyser: [720, 200], shortcut: { pts: [[720, 128, 0], [720, 342, 0]], half: 20 }, ditch: [676, 226, 790, 262],
    tube: [[690, 410], [548, 400]], ford: { x: 455, hw: 24, lanes: [17, -17], half: 13 },
    fall: [300, 372], station: [170, 330],
    walls: [[24, 212, 205, 212], [112, 133, 300, 133], [30, 376, 268, 376], [665, 160, 665, 214], [665, 268, 665, 300]],
    ash: [[150, 255, 18, 18], [600, 95, 16, 18], [300, 410, 18, 16]],
    tongue: [[165, 170], [165, 255]] },
  // The jungle: from the expedition camp under a canopy of leaves (you only see round your own car; under it the road forks into a fast swampy way
  // and a dry detour), over the gorge (swing across on the liana when it is on your side, or the narrow log bridge), through the dark temple ruin
  // (a waterfall falls into its hall), across the ford (the current pushes you towards the deep water), through the swamp on a boardwalk (see
  // junglemap.js, jungle.js). canopy = [x0, y0, x1, y1]; detour = the dry way (points, half width); gorge = river x, half width, liana lane (y from, to),
  // log bridge (y, half width); river = deep water as circles; temple = road from [x, y] to [x, y], hall = waterfall [x, y, r]; ford = shallow box,
  // current, stones; boardwalk = [x from, x to, offset, half width]; quick = deep swamp [x, y, r]; trees = [x, y on the road, side, seconds, first]
  // (event baeume); crocs = [x, y] (event kroko); camp = [x, y]; heads = stone heads [x, y]
  { name: 'DSCHUNGEL', seed: 11, theme: 'dschungel', song: 'jungle', events: ['baeume', 'kroko'], wall: [], wash: null, jungle: true,
    poly: [[60, 340, 0], [60, 70, 45], [720, 70, 50], [720, 400, 50], [60, 400, 45]],
    mud: [], water: [], ponds: [],
    mudAt: [[250, 70, 36, 30], [336, 70, 28, 30], [60, 240, 16, 20], [500, 400, 24, 30], [420, 400, 22, 30], [330, 400, 26, 30], [240, 400, 22, 30]],
    canopy: [95, 0, 482, 200], detour: { pts: [[176, 70, 0], [206, 152, 24], [394, 152, 24], [424, 70, 0]], half: 17 },
    gorge: { x: 562, hw: 20, lane: [40, 76], log: 89, lh: 8 },
    river: [[[562, -12, 20], [562, 70, 20], [570, 130, 15], [582, 220, 15], [598, 300, 16], [614, 372, 20]], [[618, 436, 22], [622, 470, 24]]],
    temple: [[720, 118], [720, 336]], hall: [720, 228, 14],
    ford: { rect: [586, 366, 656, 434], push: 58, stones: [[602, 410, 5], [640, 424, 5]] },
    boardwalk: [548, 168, -10, 7], quick: [[372, 424, 12], [286, 377, 11]],
    trees: [[60, 196, -1, 17, 6], [300, 400, 1, 19, 11], [468, 400, 1, 16, 3], [720, 368, -1, 18, 14]],
    crocs: [[612, 404], [400, 426], [250, 376]], camp: [150, 320], heads: [[776, 34], [778, 440], [22, 442]] },
  // Space (a bigger map): from the station (gravity, the start) through the glass tube out onto the platforms (zero gravity: little grip), round a
  // satellite, in a wide curve round the ringed planet (its gravity pulls; the short way on the planet's ring gives a swing-by), down through the
  // asteroid belt (a hairpin round a big asteroid, or the wormhole over it), over the moon past a dusty crater and through the airlock (it washes)
  // back into the station (see spacemap.js, space.js). Next to the platforms is nothing: you drift off, a tractor beam brings you back.
  // station = the deck [x0, y0, x1, y1]; tube = the glass tube from [x, y] to [x, y]; moon = [x, y, r]; craters = [x, y, r, dusty]; planet = [x, y,
  // radius of the planet, inner and outer edge of its ring]; orbit = where the ways onto the ring and back leave the road (degrees round the planet) and
  // where they meet the ring; narrow = narrow bridges between the platforms [x, y, half length, half width]; pads = round platforms that widen a bend [x, y, r]; portals = the wormhole: its little
  // platform beside the road [x, y, radius] (the mouth in the middle) and where you come out [x, y]; fields = force fields outside the sharp bends
  // [x, y, half length in steps of the centre line]; rocks = the big asteroids (solid) [x, y, r]; hole = the black hole [x, y] (event schwarzesloch);
  // airlock = [x, y] on the road; sat = satellite [x, y]; wheel = the turning ring of the station [x, y, r]; earth = [x, y, r]
  { name: 'WELTALL', seed: 12, W: 1360, H: 765, theme: 'weltall', song: 'space', events: ['asteroiden', 'schwarzesloch'], wall: [], wash: null, space: true,
    poly: [[135, 410, 0], [135, 110, 75], [560, 110, 70], [640, 185, 70], [770, 185, 70], [850, 110, 70], ...ARC(1070, 310, 200, -90, 90),
      [920, 510, 75], [920, 680, 55], [810, 680, 45], [810, 590, 45], [650, 590, 45], [650, 680, 45], [520, 680, 50], [440, 625, 55], [330, 625, 55], [255, 680, 50], [135, 680, 60]],
    mud: [], water: [], ponds: [],
    mudAt: [[902, 604, 20, 10], [671, 652, 18, 9]],
    boostAt: [[300, 110], [560, 680]],
    station: [52, 205, 222, 592], tube: [[135, 215], [440, 110]], moon: [300, 940, 390], craters: [[385, 720, 50, 1], [205, 700, 15, 1], [480, 660, 12, 1], [90, 690, 22, 0], [300, 745, 16, 0], [560, 735, 12, 0]],
    planet: [1070, 310, 100, 118, 156], orbit: { out: [-88, 86], on: [-46, 42], lane: [120, 154], half: 20 },
    narrow: [[518, 110, 24, 18]], pads: [[966, 552, 34]],
    portals: { a: [730, 548, 22], b: [588, 680] }, fields: [[810, 680, 22], [810, 590, 22], [650, 590, 22], [650, 680, 22], [1035, 509, 34], [920, 510, 30], [920, 680, 26]],
    rocks: [[730, 700, 34], [865, 600, 18], [1005, 640, 26], [590, 540, 20], [860, 742, 18]],
    hole: [560, 400], airlock: [135, 575], sat: [705, 60], wheel: [312, 300, 46], earth: [1290, 772, 125] },
  // Süßigkeitenland (a bigger map): from the gingerbread house up through the lollipop forest (two gummy-bear trampolines throw you over
  // caramel), right through the caramel moor on a cookie road, down through the candyfloss clouds (soft walls), round the U over the waffle
  // bridge across the chocolate river (or straight on over the marshmallow stepping stones), left over the fizz field (fizz pads, bubblegum
  // bubbles) and through the lemonade fountain back to the line (see suessmap.js, suess.js). The chocolate fountain stands in the lake in the
  // middle, its river runs out at the bottom edge.
  // lake = the chocolate fountain [x, y]; rivers = the lake and the river (deep chocolate, circles); stones = marshmallows; shortcut = the liquorice
  // path to them (points, half width); tramps = trampolines [x, y]; caramel = caramel fields [x, y, half length, half width]; chocoAt = chocolate
  // puddles; moor = the caramel moor [x, y, rx, ry] (and a band along the cookie road: cookie = from [x, y] to [x, y]); forest = the lollipop forest (from [x, y] to [x, y] on the road); floss = the candyfloss walls
  // (from, to); flossLand = more candyfloss between the bends [x0, y0, x1, y1]; gum = bubblegum spots [x, y]; lemon = the lemonade fountain
  // [x, y, rx, ry]; streams = the chocolate streams of the event schoko [points, half width]; house = the gingerbread house [x0, y0, x1, y1];
  // machine = the candyfloss machine [x, y]; donuts = donut stacks [x, y]; candyBow = the candy rainbow [x, y, radius] (not `rainbow`: that flag builds the rainbow track); men = gingerbread men;
  // fizzField = fizz powder beside the road [x from, x to, y from]
  { name: 'SUESS', seed: 13, W: 1200, H: 675, theme: 'suess', song: 'candy', events: ['schoko', 'zuckerwatte'], wall: [], wash: null, suess: true,
    poly: [[150, 300, 0], [150, 90, 60], [600, 90, 45], [690, 185, 45], [810, 185, 45], [900, 90, 45], [1060, 90, 60], [1060, 225, 45], [965, 320, 45], [1060, 415, 45],
      [1060, 565, 55], [880, 565, 35], [880, 640, 35], [720, 640, 35], [720, 565, 35], [150, 565, 60]],
    mud: [], water: [], ponds: [],
    boostAt: [[625, 565], [370, 565]],
    rivers: [[[470, 375, 48], [540, 368, 64], [620, 370, 68], [700, 378, 50]], [[690, 425, 14], [745, 478, 13], [788, 522, 13], [800, 565, 18], [802, 610, 13], [802, 650, 13], [803, 700, 14]]],
    stones: [[784, 570, 7], [800, 560, 7], [816, 570, 7]], shortcut: { pts: [[852, 565], [748, 565]], half: 11 },
    tramps: [[270, 90], [450, 90]], caramel: [[318, 90, 24, 58], [498, 90, 24, 58]], chocoAt: [[770, 566, 9, 13], [831, 566, 9, 13]],
    moor: [750, 75, 215, 80], cookie: [[565, 90], [935, 90]], forest: [[150, 200], [565, 90]], floss: [[1060, 170], [1060, 480]], flossLand: [1000, 130, 1185, 500],
    gum: [[555, 553], [425, 578]], lemon: [300, 598, 48, 30], lake: [585, 368], machine: [1165, 330],
    streams: [[[[700, 330], [735, 260], [748, 190], [752, 138]], 13], [[[730, 375], [820, 360], [930, 330], [1012, 318]], 13], [[[520, 420], [500, 500], [486, 565], [480, 612]], 13]],
    house: [24, 236, 102, 334], donuts: [[52, 40], [1150, 36], [1150, 640], [52, 636]], candyBow: [290, 512, 72], men: [[205, 470], [880, 250], [40, 420]],
    fizzField: [190, 700, 600] },
  // The kids' room (a bigger map): start on the printed road of the play mat, over the parquet and the wooden toy train, up a ramp of books onto
  // the bed, round the teddy, the pillow throws you over the gap onto the desk (between crayons, past an eraser and the paint box, over the
  // ruler between the two tables), down the marble run to the floor, through the building-block quarter and the toy car wash (see toymap.js,
  // toys.js). Levels: floor, bed, desk; whoever leaves the bed or the desk falls to the floor.
  // rug, bed, pillow, desk (two tables) = [x0, y0, x1, y1]; ramp = the books from [x, y] to [x, y]; lip = the end of the pillow (the jump), land =
  // the edge of the desk, runup = where you start again after a fall from the pillow; ruler = [x, half width] over the gap between the tables;
  // tower = the marble run [x, y, r]; fork = the clean way round the paint box (points, half width); paints = watercolour [x, y, r, colour];
  // knete = the colour of each plasticine patch (mudAt); train = the loop [x, y, rx, ry] (event spielzeug), station = [x, y]; wind = the wind-up
  // car (start, box it drives in); marble = where the marbles come out and where they roll; domino = the tower [x, y], n stones, step; robot =
  // its dock and the box it cleans (event saugroboter); the rest is furniture and toys
  { name: 'SPIELZIMMER', seed: 14, W: 1280, H: 720, theme: 'spielzimmer', song: 'toys', events: ['spielzeug', 'saugroboter'], wall: [], wash: null, toys: true, cement: [],
    poly: [[110, 470, 0], [110, 95, 62], [980, 95, 70], [980, 445, 50], [1170, 445, 50], [1170, 640, 50], [600, 640, 35], [540, 570, 35], [400, 570, 35], [340, 640, 35], [110, 640, 55]],
    mud: [], water: [], ponds: [],
    mudAt: [[110, 330, 16, 18], [568, 604, 16, 15], [668, 646, 18, 13], [290, 636, 16, 14]], knete: [0, 1, 2, 3],
    tubs: [[52, 330, 0], [618, 586, 1], [700, 694, 2], [300, 694, 3]],
    rug: [40, 150, 760, 704], bed: [640, 28, 1070, 300], pillow: [930, 160, 1048, 296], pillow2: [1012, 36, 50, 92], teddy: [820, 200],
    desk: [[860, 356, 1245, 512], [860, 548, 1245, 700]], ramp: [[550, 95], [640, 95]], lip: [980, 290], land: [980, 356], runup: [980, 180],
    ruler: [1170, 15], tower: [800, 640, 50], fork: { pts: [[1130, 640, 0], [1092, 575, 22], [962, 575, 22], [922, 640, 0]], half: 15 },
    paints: [[1012, 624, 9, 1], [1040, 636, 10, 0], [1068, 627, 7, 2], [1000, 650, 6, 3]],
    crayons: [[1032, 408, 42, 0], [1078, 408, 42, 1], [1032, 482, 42, 2], [1078, 482, 42, 3]], eraser: [1062, 418, 20, 12], paintbox: [993, 592, 64, 16],
    hefte: [[880, 380, 44, 30, 1], [886, 420, 40, 28, 3]], notes: [[1060, 372, 2], [1080, 380, 0], [1140, 370, 3]], cup: [900, 482], lamp: [1200, 386],
    train: [360, 95, 120, 62], station: [360, 16], wind: { start: [200, 230], box: [40, 165, 600, 362] },
    marble: { out: [775, 702], dir: [-1, -.62] }, domino: { x: 470, y: 527, n: 12, step: 7 }, robot: { dock: [26, 520], box: [40, 395, 850, 705] },
    blockWall: [140, 860, 382], castle: [420, 612, 520, 700], dollhouse: [250, 200, 100, 66], toybox: [440, 250, 64, 46], shelf: [480, 630], window: [40, 200],
    stand: [1104, 44, 74, 96], projector: [1141, 92], nightlight: [1266, 600], ball: [700, 470, 11], duck: [180, 692],
    socks: [[1110, 330, 0], [1150, 318, 1]], puzzle: [[640, 345, 2], [760, 540, 1], [60, 610, 3], [690, 330, 0]], sheet: [170, 290],
    streets: [[150, 446, 740, 454], [556, 160, 564, 370]], houses: [[180, 400, 22, 18], [250, 470, 24, 18], [380, 410, 20, 16], [620, 470, 22, 18]],
    ptrees: [[220, 410, 7], [330, 480, 8], [450, 420, 7], [690, 420, 6]], ppond: [400, 485, 28, 14], zebra: [110, 240], washAt: [230, 640] },
  // The rainbow (the finale, a bigger map): a rainbow road over a sea of clouds between floating coins, one for every cup (see rainbowmap.js,
  // rainbow.js). From the Fantasy coin (the start, under a gate of clouds) up to the bronze coin (a meadow: earth road, a mud puddle, two cows),
  // over the rainbow arch (it climbs over a cloud gorge, the biggest jump of the game over the gap at its top), across the silver coin (a garden:
  // a red bridge over a cloud pond, koi), down the gold coin (an asphalt chicane with kerbs and gravel, an ice ramp back onto the rainbow), round
  // the platinum coin (a little volcano, a wormhole over the next bend), through the spiral (a big left and a right curve, boost arrows) and the
  // rain shower (it washes) back. In the last lap of the storm (event gewitter) a double rainbow cuts the spiral short.
  // coins = [x, y, r] of every coin; arch = where it starts and ends and its gap ([x, y] on the road); ramp = the ice ramp: ice from, lip, end of
  // the gap; puddle = the mud puddle of the bronze coin [x, y, rx, ry]; cows = [x, y, how far it walks, phase]; pines, chair (beach chair),
  // cherries, lantern, cacti = [x, y]; pond = the cloud pond [x, y, rx, ry] (the koi leap over the bridge); gravel = [x, y, r]; cone = the little volcano [x, y, r]
  // and its lava rill (points); portals = the wormhole: its little platform [x, y, r] and where you come out [x, y]; storm = storm clouds on the
  // road [t, offset, half length, half width], stormAt = the ones the storm brings (event gewitter); shower = the rain shower [x, y] on the
  // road; podium = [x, y]; emblems = the cup symbols [x, y, size]; double = the double rainbow (a curve: start, two control points, end)
  { name: 'REGENBOGEN', rev: 1, seed: 15, W: 1440, H: 810, theme: 'regenbogen', song: 'rainbow', events: ['einhorn', 'gewitter'], wall: [], wash: null, rainbow: true, goo2: 'mud',
    poly: [[180, 440, 0], [180, 110, 95], [1300, 110, 60], [1300, 190, 45], [1258, 255, 55], [1300, 320, 45], [1300, 585, 95], [1060, 585, 80], [900, 425, 120], [700, 355, 150],
      [560, 535, 150], [520, 742, 110], [180, 742, 95]],
    mud: [], water: [], ponds: [], boost: [.72, .785],
    coins: { bronze: [420, 125, 100], silver: [1010, 145, 105], gold: [1288, 262, 95], platinum: [1240, 590, 100], fantasy: [180, 430, 120] },
    arch: [[521, 110], [906, 110], [658, 110], [768, 110]], ramp: [[1300, 350], [1300, 372], [1300, 402]],
    puddle: [455, 118, 22, 13], cows: [[388, 102, 14, 0], [492, 121, 9, 2.4]], pines: [[350, 170], [492, 170], [446, 50]], chair: [382, 52],
    pond: [1010, 112, 34, 56], cherries: [[940, 60], [1082, 175]], lantern: [940, 178],
    gravel: [[1342, 200, 22], [1212, 255, 26], [1342, 322, 22]], cacti: [[1226, 190], [1224, 332], [1250, 214]],
    cone: [1305, 652, 22], rill: [[1290, 640], [1266, 632], [1240, 642]], portals: { a: [1232, 520, 15], b: [960, 485] },
    storm: [[.085, -16, 24, 12], [.39, 16, 22, 11], [.615, 15, 24, 12], [.70, -16, 26, 12], [.80, 15, 24, 12]],
    stormAt: [[.045, 14, 22, 11], [.38, -15, 22, 11], [.655, -14, 24, 12], [.745, 15, 24, 12], [.835, 14, 22, 11]],
    shower: [380, 742], podium: [105, 480],
    emblems: { bronze: [420, 182, 26], silver: [1010, 208, 22], gold: [1345, 262, 16], platinum: [1185, 655, 14], fantasy: [252, 440, 24] },
    double: [[1080, 585], [880, 585], [700, 742], [520, 742]] }
];


// every line of the railway has its own train (ZUG Rev 2: twice as many trains, now and then one on each line at the same time, train.js);
// the first one comes after 4 s, the second 2 s later from the other end, after that each runs on its own clock
export const newTrains = lines => lines.map((x, k) => ({ x, phase: 'wait', t: 4 + k * 2, dir: k ? -1 : 1, y: -9999, n: 4, len: 0, smokeT: 0, signal: false }));


// where the centre line crosses the rail lines (x): { i (index on the centre line), x, y }, line by line, in driving order
const railCross = (path, N, lines) => {
  const cross = [];
  for (const RX of lines) for (let i = 0; i < N; i++) { const a = path[i], b = path[(i + 1) % N]; if ((a.x - RX) * (b.x - RX) <= 0 && !cross.some(c => c.x === RX && Math.abs(c.i - i) < 30)) cross.push({ i, x: RX, y: (a.y + b.y) / 2 }); }
  return cross;
};


// the centre line with rounded corners: [x, y, r] (r = 0: plain point), a circle-like curve of size r at every corner, straight in between
function roundedPath(poly) {
  const raw = [], n = poly.length, k = .5523;
  const line = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(l / 2)); for (let s = 0; s < m; s++) raw.push([a[0] + (b[0] - a[0]) * s / m, a[1] + (b[1] - a[1]) * s / m]); };
  let cur = [poly[0][0], poly[0][1]];
  for (let i = 1; i <= n; i++) {
    const [x, y, r] = poly[i % n];
    if (i === n || !r) { line(cur, [x, y]); cur = [x, y]; continue; }
    const [qx, qy] = poly[i - 1], [nx, ny] = poly[(i + 1) % n], dp = Math.hypot(qx - x, qy - y), dn = Math.hypot(nx - x, ny - y), rp = Math.min(r, dp / 2), rn = Math.min(r, dn / 2);
    const A = [x + (qx - x) / dp * rp, y + (qy - y) / dp * rp], B = [x + (nx - x) / dn * rn, y + (ny - y) / dn * rn];
    line(cur, A);
    const P1 = [A[0] + (x - A[0]) * k, A[1] + (y - A[1]) * k], P2 = [B[0] + (x - B[0]) * k, B[1] + (y - B[1]) * k], m = Math.max(8, Math.ceil((rp + rn) * .6));
    for (let q = 0; q < m; q++) { const t = q / m, u = 1 - t; raw.push([0, 1].map(c => u * u * u * A[c] + 3 * u * u * t * P1[c] + 3 * u * t * t * P2[c] + t * t * t * B[c])); }
    cur = B;
  }
  return raw;
}


// the centre line of a track: closed Catmull-Rom (pts) or rounded corners (poly), resampled every 2px, with tangents and normals.
// Cheap, so the menus can show the shape of a track before it is built.
// stepping stones [x, y, r, stretch, angle]: round, or an oval stretch times longer along the angle. stoneD is the distance of a point
// from the middle measured in r (the rim lies at r), stoneR the radius of the circle around the whole stone
const stoneD = ([sx, sy, , st = 1, an = 0], x, y) => { const dx = x - sx, dy = y - sy, c = Math.cos(an), s = Math.sin(an); return Math.hypot((dx * c + dy * s) / st, -dx * s + dy * c); };
const stoneR = ([, , sr, st = 1]) => sr * Math.max(1, st);

export function centreLine(def) {
  const P = def.pts || [], n = P.length, raw = def.poly ? roundedPath(def.poly) : [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      const f = q => .5 * (2 * b[q] + (-a[q] + c[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * t2 + (-a[q] + 3 * b[q] - 3 * c[q] + d[q]) * t3);
      raw.push([f(0), f(1)]);
    }
  }
  raw.push(raw[0]);
  const path = [{ x: raw[0][0], y: raw[0][1] }]; let acc = 0;
  for (let i = 1; i < raw.length; i++) {
    let ax = raw[i - 1][0], ay = raw[i - 1][1]; const bx = raw[i][0], by = raw[i][1];
    let seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= 2) { const f = (2 - acc) / seg; ax += (bx - ax) * f; ay += (by - ay) * f; path.push({ x: ax, y: ay }); seg = Math.hypot(bx - ax, by - ay); acc = 0; }
    acc += seg;
  }
  const lp = path[path.length - 1]; if (Math.hypot(lp.x - path[0].x, lp.y - path[0].y) < 1) path.pop();
  const N = path.length, tan = [], nrm = [];
  for (let i = 0; i < N; i++) {
    const a = path[(i - 2 + N) % N], b = path[(i + 2) % N], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    tan.push({ x: dx / l, y: dy / l }); nrm.push({ x: -dy / l, y: dx / l });
  }
  return { path, tan, nrm, N };
}


// Building a track takes a few hundred milliseconds, so it is a generator: every `yield` is a point where the work can pause
// until the next frame (see idle.js). The yielded number is roughly how far the build is (0..1), for the loading bar.
// The terrain and paint functions of the big maps (ringmap.js, desertmap.js ...) are generators as well (yield*).

// The special tracks: the flag in their TRACK_DEFS entry -> their map module. terrain(S) runs before the painting (on def.<flag>), paint(S)
// paints the decor (on th.decor; it gets what terrain returned as S.RT). What paint returns becomes T.<flag>; its jumps, pushes and alt
// are the Cup 3 building blocks (trackfx.js). The runtime side of the track: hooks.js, _template.js.
const MAPS = [
  { flag: 'ring', decor: 'ring', terrain: ringTerrain, paint: paintRing },
  { flag: 'desert', decor: 'wueste', terrain: desertTerrain, paint: paintDesert },
  { flag: 'ice', decor: 'eis', terrain: iceTerrain, paint: paintIce },
  { flag: 'volcano', decor: 'vulkan', terrain: volcanoTerrain, paint: paintVolcano },
  { flag: 'jungle', decor: 'dschungel', terrain: jungleTerrain, paint: paintJungle },
  { flag: 'space', decor: 'weltall', terrain: spaceTerrain, paint: paintSpace },
  { flag: 'suess', decor: 'suess', terrain: suessTerrain, paint: paintSuess },
  { flag: 'toys', decor: 'spielzimmer', terrain: toyTerrain, paint: paintToys },
  { flag: 'rainbow', decor: 'regenbogen', terrain: rainbowTerrain, paint: paintRainbow },
  // the beach keeps its decor in buildTrack (th.decor 'strand') and paints only the volleyball court on top of it
  { flag: 'beach', decor: 'strand', terrain: beachTerrain, paint: paintBeach },
];
function* buildTrack(def, ti) {
  // the size of the map: WW x WH unless the track brings its own (W, H)
  const MW = def.W || WW, MH = def.H || WH;
  const th = THEMES[def.theme], sd = (def.seed !== undefined ? def.seed : ti) * 131 + 17, r = rng(sd);
  const { path, tan, nrm, N } = centreLine(def);
  // distance to centre line (and which centre point is nearest)
  const RJ = def.railJump, A = MW * MH, dist = new Float32Array(A).fill(1e8), near = new Int32Array(A), RR = HALF + 22 + (RJ ? RJ.w : 0);
  for (let pi = 0; pi < N; pi++) {
    const p = path[pi];
    const x0 = Math.max(0, Math.floor(p.x - RR)), x1 = Math.min(MW - 1, Math.ceil(p.x + RR));
    const y0 = Math.max(0, Math.floor(p.y - RR)), y1 = Math.min(MH - 1, Math.ceil(p.y + RR));
    for (let y = y0; y <= y1; y++) { const row = y * MW, dy = y + .5 - p.y, dy2 = dy * dy; for (let x = x0; x <= x1; x++) { const dx = x + .5 - p.x, dd = dx * dx + dy2; if (dd < dist[row + x]) { dist[row + x] = dd; near[row + x] = pi; } } }
    if (pi % 25 === 24) yield .2 * pi / N;
  }
  for (let j = 0; j < A; j++) dist[j] = Math.sqrt(dist[j]);
  // ZUG Rev 3: the jump lanes beside the crossings. The road gets w px wider on the side of the lane (dist gets smaller there, so everything that
  // asks dist sees the wider road: terrain, edge, planks over the rails, decor); it widens and narrows again over 30 px (no islands since 1S4-8)
  const jumpX = RJ ? railCross(path, N, def.rail.lines || [def.rail.x]).map((cr, k) => ({ ...cr, side: RJ.sides[k] || -1 })) : [];
  if (RJ) for (let j = 0; j < A; j++) {
    if (dist[j] > HALF + RJ.w + 30) continue;
    const i = near[j], p = path[i], x = j % MW, y = (j / MW) | 0, c = (x + .5 - p.x) * nrm[i].x + (y + .5 - p.y) * nrm[i].y;
    for (const cr of jumpX) {
      let a = (i - cr.i + N) % N; if (a > N / 2) a -= N; a *= 2;
      if (c * cr.side <= 0 || a < RJ.from - 30 || a > RJ.to + 30) continue;
      const w = RJ.w * clamp(a < RJ.from ? (a - RJ.from + 30) / 30 : (RJ.to + 30 - a) / 30, 0, 1), ac = Math.abs(c);
      if (w > 0) dist[j] = Math.min(dist[j], Math.max(HALF - 3.5, ac - w));
    }
  }
  yield .2;
  const band = (i, alongMax, fn) => {
    const p = path[i], tg = tan[i], nm = nrm[i], R = HALF + 16;
    for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(MH - 1, p.y + R); y++)
      for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(MW - 1, p.x + R); x++) {
        const dx = x + .5 - p.x, dy = y + .5 - p.y, a = dx * tg.x + dy * tg.y, c = dx * nm.x + dy * nm.y;
        if (Math.abs(a) < alongMax) fn(x, y, a, c);
      }
  };
  // terrain: 0 grass/space, 1 track, 2 mud, 3 water, 4 boost pad
  const ter = new Uint8Array(A), sea = new Uint8Array(A);
  for (let j = 0; j < A; j++) ter[j] = dist[j] < HALF ? 1 : 0;
  const shoreY = th.sea ? new Float32Array(MW) : null;
  if (th.sea) for (let x = 0; x < MW; x++) {
    shoreY[x] = 412 + Math.sin(x / 40) * 5 + Math.sin(x / 13) * 2;
    for (let y = Math.ceil(shoreY[x]); y < MH; y++) { ter[y * MW + x] = 3; sea[y * MW + x] = 1; }
  }
  // grow (def.grow, the Wald): mud and puddles are only stamped up to that share of their size (q = 0 middle .. 1 rim; .5 = half the area),
  // all their pixels are kept with q, and the rain fills the rest (events.js growPuddles)
  const growing = [];
  const stamp = (cx, cy, tg, nm, rx, ry, type, grow) => {
    const R = Math.ceil(Math.max(rx, ry) * 1.25) + 2, g = grow ? { type, px: [], q: [] } : null;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(MH - 1, cy + R); y++)
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(MW - 1, cx + R); x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy, a = dx * tg.x + dy * tg.y, c = dx * nm.x + dy * nm.y;
        const q = ((a / rx) ** 2 + (c / ry) ** 2) / (.8 + .4 * vnoise(x * .14, y * .14, sd + type));
        if (q >= 1) continue;
        if (g) { g.px.push(y * MW + x); g.q.push(q); if (q >= grow) continue; }
        ter[y * MW + x] = type;
      }
    if (g) growing.push(g);
  };
  const onPath = (t, off, rx, ry, type) => { const i = Math.floor(t * N) % N, p = path[i]; stamp(p.x + nrm[i].x * off, p.y + nrm[i].y * off, tan[i], nrm[i], rx, ry, type, def.grow); };
  // deep water (type 5): rivers, pools and lakes next to the road. A road over it stays road = a bridge. Stepping stones are road again.
  const deep = new Uint8Array(A), stoneMask = new Uint8Array(A), bridgeMask = new Uint8Array(A), isBridge = new Uint8Array(N), bridges = [];
  // where on a bridge deck is a point (x, y, nearest centre point k)? null: not on a bridge. Normally the bridge is a stretch of the centre
  // line, so its ends follow the road's bends; with def.squareBridges each bridge is cut off straight across its middle direction, 10 px from
  // the water instead of 16 (the garden, 1S6-8), and the result is the distance along that direction (its planks lie across it)
  const deckAt = (x, y, k) => {
    for (const [a, b] of bridges) {
      const len = (b - a + N) % N, m = (a + (len >> 1)) % N, u = (x - path[m].x) * tan[m].x + (y - path[m].y) * tan[m].y;
      if (inRange(k, (a - 14 + N) % N, (b + 14) % N) && Math.abs(u) <= len - 6) return u;
    }
    return null;
  };
  const onDeck = (x, y, k) => def.squareBridges ? deckAt(x, y, k) !== null : !!isBridge[k];
  const capsule = (c0, c1) => {
    const st = Math.max(1, Math.ceil(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 2));
    for (let s = 0; s <= st; s++) {
      const f = s / st, cx = c0[0] + (c1[0] - c0[0]) * f, cy = c0[1] + (c1[1] - c0[1]) * f, rad = c0[2] + (c1[2] - c0[2]) * f, R = Math.ceil(rad + 4);
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(MH - 1, Math.ceil(cy + R)); y++)
        for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(MW - 1, Math.ceil(cx + R)); x++)
          if (Math.hypot(x + .5 - cx, y + .5 - cy) < rad + (vnoise(x * .12, y * .12, sd + 9) - .5) * 4) deep[y * MW + x] = 1;
    }
  };
  (def.rivers || []).forEach(ch => { for (let k = 1; k < ch.length; k++) capsule(ch[k - 1], ch[k]); });
  if (def.rivers) yield .25;
  for (let j = 0; j < A; j++) if (deep[j] && ter[j] === 0) ter[j] = 5;
  if (def.rivers) {
    const inW = path.map(p => deep[Math.round(clamp(p.y, 0, MH - 1)) * MW + Math.round(clamp(p.x, 0, MW - 1))]), s0 = inW.indexOf(0);
    for (let k = 0, a = -1; k <= N; k++) {
      const i = (s0 + k) % N;
      if (k < N && inW[i]) { if (a < 0) a = k; }
      else if (a >= 0) { bridges.push([(s0 + a - 8 + N) % N, (s0 + k - 1 + 8) % N]); a = -1; }
    }
    for (const [a, b] of bridges) for (let i = a; ; i = (i + 1) % N) { isBridge[i] = 1; if (i === b) break; }
    for (let j = 0; j < A; j++) if (dist[j] < HALF && onDeck(j % MW + .5, (j / MW | 0) + .5, near[j])) bridgeMask[j] = 1;
  }
  for (const st of def.stones || []) {
    const [sx, sy, sr] = st, R = stoneR(st);
    for (let y = Math.floor(sy - R - 3); y <= Math.ceil(sy + R + 3); y++) for (let x = Math.floor(sx - R - 3); x <= Math.ceil(sx + R + 3); x++)
      if (x >= 0 && y >= 0 && x < MW && y < MH && stoneD(st, x + .5, y + .5) < sr + (vnoise(x * .3, y * .3, sd + 4) - .5) * 2) { ter[y * MW + x] = 1; stoneMask[y * MW + x] = 1; }
  }
  def.mud.forEach(m => onPath(m[0], m[1], m[2], m[3], 2));
  def.water.forEach(m => onPath(m[0], m[1], m[2], m[3], 3));
  def.ponds.forEach(p => stamp(p[0], p[1], { x: 1, y: 0 }, { x: 0, y: 1 }, p[2], p[3], 3));
  // puddles at fixed places: the direction of the road is taken from the nearest point of the centre line
  const stampAt = (m, type, grow) => { const i = nearestIdx(path, m[0], m[1]); stamp(m[0], m[1], tan[i], nrm[i], m[2], m[3], type, grow); };
  (def.mudAt || []).forEach(m => stampAt(m, 2, def.grow));
  (def.waterAt || []).forEach(m => stampAt(m, 3, def.grow));
  (def.cement || []).forEach(m => stampAt(m, 6));
  const showers = (def.showers || []).map(([t, off]) => {
    const i = Math.floor(t * N) % N, p = path[i], x = p.x + nrm[i].x * off, y = p.y + nrm[i].y * off, s = Math.sign(off) || 1;
    stamp(x, y, tan[i], nrm[i], 14, 12, 3);
    return { i, x, y, px: x + nrm[i].x * s * 18, py: y + nrm[i].y * s * 18 };
  });
  const boosts = (def.boost || []).concat((def.boostAt || []).map(([x, y]) => nearestIdx(path, x, y) / N));
  boosts.forEach(t => band(Math.floor(t * N) % N, 16, (x, y, a, c) => { if (Math.abs(c) < 18) ter[y * MW + x] = 4; }));
  yield .3;
  const map = MAPS.find(m => def[m.flag]), RT = map ? yield* map.terrain({ MW, MH, def, ter, dist, near, path, tan, nrm, N, deep, stampAt }) : null;
  yield .35;
  // railway: a straight vertical line through the whole world
  let rail = null;
  if (def.rail) {
    const lines = def.rail.lines || [def.rail.x];
    for (const RX of lines) for (let y = 0; y < MH; y++) for (let x = RX - 18; x <= RX + 18; x++) { const j = y * MW + x; if (ter[j] >= 2) ter[j] = dist[j] < HALF ? 1 : 0; }
    const cross = RJ ? jumpX : railCross(path, N, lines); // (side: where the jump lane is)
    // one warning light per crossing (1S4-8, instead of the booms): on the side without the jump lane, 36 px before the rails, beside the road
    for (const cr of cross) {
      const k = (cr.i - 18 + N) % N, s = -(cr.side || -1);
      cr.lx = Math.round(path[k].x + nrm[k].x * s * (HALF + 8)); cr.ly = Math.round(path[k].y + nrm[k].y * s * (HALF + 8));
    }
    rail = { x: def.rail.x, lines, cross, signal: false, bellT: 0, chuffT: 0, chuffN: 0, trains: newTrains(lines) };
  }
  const yard = siteYards(def, ter, dist, MW, MH), cemPix = [];
  const shore = new Uint8Array(A);
  for (let y = 0; y < MH; y++) {
    if (y % 30 === 29) yield .35 + .05 * y / MH;
    for (let x = 0; x < MW; x++) {
      const j = y * MW + x; if ((ter[j] !== 3 && ter[j] !== 5) || sea[j]) continue;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 10) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
        const k = yy * MW + xx; if (ter[k] !== 3 && ter[k] !== 5 && (ter[j] === 3 || ter[k] === 0)) shore[k] = 1;
      }
    }
  }
  yield .4;
  const ed = (x, y, type, mr) => {
    for (let rr = 1; rr <= mr; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
      if (ter[yy * MW + xx] !== type) return rr;
    }
    return mr + 1;
  };
  // paint ground
  const img = new ImageData(MW, MH), d = img.data;
  const set = (j, c) => { d[j * 4] = c[0]; d[j * 4 + 1] = c[1]; d[j * 4 + 2] = c[2]; d[j * 4 + 3] = 255; };
  const GRS = th.grass.map(hex), TRK = th.track.map(hex), TE = hex(th.trackEdge), GE = hex(th.grassEdge), TU = hex(th.tuft);
  const MUD = th.mud.map(hex), MUDE = hex(th.mudEdge), MUDH = hex(th.mudHi);
  const WAT = th.water.map(hex), SHORE = th.shore.map(hex);
  const SEA = ['#f4fbff', '#9df0e6', '#4fd0d8', '#2fa6d6', '#2285c4'].map(hex), WET = [hex('#c9a060'), hex('#d8b66e'), hex('#e2c47e')];
  const PEB = [hex('#e2cda6'), hex('#86653f')];
  const PLANK = [hex('#8d8373'), hex('#7a7163')], BAL = ['#8a8580', '#77726c', '#9c968f'].map(hex), SLEEPER = [hex('#6b4a2e'), hex('#56391f')], RAIL = [hex('#d5dae2'), hex('#6f757d')];
  const mudPix = [], watPix = [], starPix = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x, t = ter[j], nv = vnoise(x / 9, y / 9, sd), h = hash(x, y, sd);
    let col;
    if (bridgeMask[j]) {
      // wooden bridge: planks across the road, rails along both edges (they are solid, see below)
      const u = def.squareBridges ? deckAt(x + .5, y + .5, near[j]) : null, i = u === null ? near[j] : Math.floor((u + 1000) / 2), dd = dist[j];
      col = dd > HALF - 2.5 ? (i % 6 < 2 ? [206, 156, 92] : [124, 82, 44]) : dd > HALF - 4.5 ? (i % 6 < 2 ? [168, 118, 66] : [84, 52, 26]) : i % 3 === 0 ? [96, 64, 34] : (Math.floor(i / 3) & 1) ? [176, 128, 74] : [160, 112, 62];
      if (h < .03 && dd < HALF - 4.5) col = [128, 88, 46];
    } else if (t === 3 || t === 5) {
      if (sea[j]) {
        // tropical sea: foam, turquoise shallows, deeper blue further out
        const dp = y - shoreY[x] + (nv - .5) * 3;
        col = dp < 2 ? SEA[0] : dp < 6 ? SEA[1] : dp < 14 ? SEA[2] : dp < 24 ? SEA[3] : SEA[4];
        if (dp > 8) watPix.push(j);
      }
      else {
        watPix.push(j); const e = ed(x, y, t, 4); col = e === 1 ? WAT[0] : e <= 3 ? WAT[1] : nv > .55 ? WAT[3] : WAT[2];
        if (th.leafWater && e > 2 && hash(x, y, sd + 5) < .012) col = [[224, 138, 44], [217, 180, 58], [181, 86, 42]][(h * 3) | 0];
      }
    } else if (shore[j]) col = SHORE[h < .5 ? 0 : 1];
    else if (t === 6) {
      // cement: grey and smooth, a darker rim
      const e = ed(x, y, 6, 1);
      if (e === 1) col = [92, 96, 102]; else { cemPix.push(j); const v = nv * .6 + h * .4; col = v < .38 ? [125, 129, 136] : v > .66 ? [154, 160, 167] : [140, 144, 151]; if (h < .03) col = [196, 201, 206]; }
    }
    else if (t === 2) {
      const e = ed(x, y, 2, 1);
      if (e === 1) col = MUDE; else { mudPix.push(j); const v = nv * .6 + h * .4; col = v < .38 ? MUD[1] : v > .66 ? MUD[2] : MUD[0]; if (h < .025) col = MUDH; }
    } else if (t === 1 || t === 4) {
      const v = nv * .6 + h * .4; col = v < .35 ? TRK[1] : v > .68 ? TRK[2] : TRK[0];
      if (dist[j] > HALF - 3) col = TE; else if (h > .988) col = PEB[0]; else if (h < .01) col = PEB[1];
    } else if (th.space) {
      const neb = vnoise(x / 45, y / 45, sd + 3);
      col = neb > .62 ? GRS[2] : neb > .45 ? GRS[1] : GRS[0];
      if (h < .0015) { col = [255, 255, 255]; starPix.push(j); } else if (h < .004) col = [255, 233, 168]; else if (h < .0055) col = [159, 214, 255];
      if (dist[j] < HALF + 3) col = GE;
    } else if (th.sea && y > shoreY[x] - 14 && dist[j] >= HALF + 2.5) {
      const dd = shoreY[x] - y + (nv - .5) * 4; // wet sand darkens towards the waterline
      col = dd < 5 ? WET[0] : dd < 10 ? WET[1] : WET[2];
    } else {
      if (dist[j] < HALF + 2.5) col = GE;
      else { const v = nv * .7 + h * .3; col = v < .38 ? GRS[1] : v > .66 ? GRS[2] : GRS[0]; if (h < .025 || hash(x, y + 1, sd) < .025 || hash(x, y + 2, sd) < .012) col = TU; }
    }
    if (rail) for (const RX of rail.lines) {
      const dx = x - RX, ax = Math.abs(dx);
      if (ax <= 16) {
        if (dist[j] < HALF) col = (y >> 2) & 1 ? PLANK[0] : PLANK[1];
        else { col = BAL[(h * 3) | 0]; if (ax <= 12 && y % 7 < 3) col = SLEEPER[y % 7 === 0 ? 1 : 0]; }
        if (dx === -7 || dx === 6) col = RAIL[0]; else if (dx === -6 || dx === 7) col = RAIL[1];
      }
    }
    set(j, col);
    if (x === MW - 1 && y % 12 === 11) yield .4 + .3 * y / MH;
  }
  yield .7;
  // the pier: planks across the track and piles on both sides (still normal ground for the cars)
  let pier = null; const piles = [];
  if (def.pier) {
    let a = -1, b = -1;
    for (let i = Math.floor(.3 * N); i < N; i++) { const p = path[i]; if (p.y >= PIER.y + PIER_WAVE(p.x)) { if (a < 0) a = i; b = i; } }
    pier = [a, b];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const j = y * MW + x;
      if (dist[j] >= PIER.half || near[j] < pier[0] || near[j] > pier[1]) continue;
      ter[j] = 1; set(j, pierColor(dist[j], near[j], x, y));
    }
    // the piles are kept (piles): the rising flood paints exactly these again (events.js paintFloodRows)
    for (let i = pier[0]; i <= pier[1]; i += 7) {
      const p = path[i];
      for (const s of [-1, 1]) {
        const x = Math.round(p.x + nrm[i].x * s * (PIER.half + 2)), y = Math.round(p.y + nrm[i].y * s * (PIER.half + 2));
        piles.push([x, y]);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < MW && y + dy < MH) set((y + dy) * MW + x + dx, dy === -1 && dx === 0 ? PILE[0] : PILE[1]);
      }
    }
  }
  // stepping stones: round grey stones with a dark rim, some moss, a ripple in the water around them
  for (const st of def.stones || []) {
    const [sx, sy, sr] = st, R = stoneR(st);
    for (let y = Math.floor(sy - R - 4); y <= Math.ceil(sy + R + 4); y++) for (let x = Math.floor(sx - R - 4); x <= Math.ceil(sx + R + 4); x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x, dx = x + .5 - sx, dy = y + .5 - sy, dd = stoneD(st, x + .5, y + .5);
      if (!stoneMask[j]) { if (ter[j] === 5 && dd < sr + 3.5 && hash(x, y, sd + 6) < .5) set(j, [150, 214, 220]); continue; }
      const sh = (dx + dy) / R;
      let c = dd > sr - 1.6 ? [84, 84, 80] : sh < -.35 ? [196, 194, 184] : sh > .4 ? [128, 127, 120] : [164, 162, 153];
      if (dd <= sr - 1.6 && hash(x, y, sd + 7) < .1) c = [96, 138, 72];
      set(j, c);
    }
  }
  // boost pads: yellow chevrons pointing the way
  boosts.forEach(t => band(Math.floor(t * N) % N, 16, (x, y, a, c) => {
    const ac = Math.abs(c); if (ac >= 18) return;
    set(y * MW + x, ac > 16 || Math.abs(a) > 14.5 ? [255, 255, 255] : ((a + ac * .8 + 100) % 10) < 4 ? [255, 230, 109] : [74, 36, 140]);
  }));
  // start line (checkered), stop lines at the level crossings, car wash
  band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * MW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });
  if (rail) for (const cr of rail.cross) band(cr.i, 34, (x, y, a, c) => { if (Math.abs(c) < HALF - 2 && Math.abs(Math.abs(a) - 30) < 1.6) set(y * MW + x, [245, 245, 240]); });
  const hasWash = def.wash != null, wi = hasWash ? (def.washAt ? nearestIdx(path, def.washAt[0], def.washAt[1]) : Math.floor(def.wash * N) % N) : 0, washMask = new Uint8Array(A);
  const tp = new Uint8ClampedArray(A * 4);
  const setT = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= MW || y >= MH) return; const i = (y * MW + x) * 4; tp[i] = c[0]; tp[i + 1] = c[1]; tp[i + 2] = c[2]; tp[i + 3] = 255; };
  const FLOOR = [hex('#a9bccd'), hex('#93a8bb')], BEAM = [hex('#ffffff'), hex('#e84a5f'), hex('#b8354a')], POST = [hex('#4a5a8a'), hex('#6d7fb3')];
  if (hasWash) band(wi, 16, (x, y, a, c) => {
    const j = y * MW + x, ac = Math.abs(c), aa = Math.abs(a);
    if (ac < HALF && aa < 14) { washMask[j] = 1; set(j, ((Math.floor(a + 20) / 5 | 0) + (Math.floor(c + 100) / 5 | 0)) & 1 ? FLOOR[0] : FLOOR[1]); }
    if (aa < 5 && ac <= HALF + 5) setT(x, y, aa > 3.5 ? BEAM[2] : (Math.floor(c + 100) / 5 | 0) & 1 ? BEAM[0] : BEAM[1]);
    if (ac > HALF + 4 && ac <= HALF + 11 && aa < 7) setT(x, y, (ac < HALF + 7 || aa < 2) ? POST[1] : POST[0]);
  });
  // beach showers: a pole next to the track, an arm and the shower head hanging over the puddle
  for (const s of showers) {
    const bx = Math.round(s.px), by = Math.round(s.py), hx = Math.round(s.x), hy = Math.round(s.y) - 13;
    for (let k = 0; k <= 13; k++) { setT(bx, by - k, k % 4 === 3 ? hex('#8d97a3') : hex('#d4dbe3')); setT(bx + 1, by - k, hex('#9aa4b0')); }
    for (let k = -1; k <= 2; k++) setT(bx + k, by + 1, hex('#6b6f78'));
    const steps = Math.max(1, Math.abs(hx - bx)); for (let k = 0; k <= steps; k++) setT(bx + (hx - bx) * k / steps, by - 13 + (hy - (by - 13)) * k / steps, hex('#d4dbe3'));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = dx * dx + dy * dy; if (dd <= 9) setT(hx + dx, hy + dy, dd <= 3 ? hex('#4fb3e6') : hex('#b8c4d0')); }
  }
  yield .72;
  // central wall across the infield: nobody can cut across the middle. Its ends stop at the track edge, solid circles every 8px.
  const walls = [], wallTrees = [], wallMask = new Uint8Array(A), wsegs = [];
  const maskAt = (x, y) => { for (let dy = -20; dy <= 20; dy++) for (let dx = -20; dx <= 20; dx++) { const xx = Math.round(x + dx), yy = Math.round(y + dy); if (dx * dx + dy * dy <= 400 && xx >= 0 && yy >= 0 && xx < MW && yy < MH) wallMask[yy * MW + xx] = 1; } };
  for (const w of def.wall || []) {
    const ca = Math.cos(w.ang), sa = Math.sin(w.ang);
    const end = dir => {
      let x = w.x, y = w.y;
      for (let k = 0; k < 500; k++) {
        const nx = x + ca * dir * 2, ny = y + sa * dir * 2;
        if (nx < 10 || ny < 10 || nx > MW - 10 || ny > MH - 10 || dist[(ny | 0) * MW + (nx | 0)] < HALF + 7) break;
        x = nx; y = ny;
      }
      return [x, y];
    };
    const dirs = w.dirs || [-1, 1], a = dirs.includes(-1) ? end(-1) : [w.x, w.y], b = dirs.includes(1) ? end(1) : [w.x, w.y];
    wsegs.push({ a, b, ca, sa, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  for (const sg of wsegs) for (let t = 0; t <= sg.len; t += 2) { const x = sg.a[0] + sg.ca * t, y = sg.a[1] + sg.sa * t; if (t % 8 === 0) walls.push({ x, y, r: 4 }); maskAt(x, y); }
  if (def.gate && rail) for (let x = rail.x - 24; x <= rail.x + 24; x += 8) { walls.push({ x, y: def.gate.y, r: 4 }); maskAt(x, def.gate.y); }
  // the posts of the warning lights at the crossings are solid (no trees or decor on them either)
  if (rail) for (const cr of rail.cross) { walls.push({ x: cr.lx, y: cr.ly, r: 3 }); for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) wallMask[clamp(cr.ly + dy, 0, MH - 1) * MW + clamp(cr.lx + dx, 0, MW - 1)] = 1; }
  // decor
  const ok = (x, y) => {
    x |= 0; y |= 0; if (x < 3 || y < 3 || x >= MW - 3 || y >= MH - 3) return false;
    const j = y * MW + x; return ter[j] === 0 && dist[j] > HALF + 4 && !shore[j] && !washMask[j] && !wallMask[j] && !yard[j] && (!rail || rail.lines.every(L => Math.abs(x - L) > 20));
  };
  const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, c); };
  const scatter = (n, rad, fn) => { for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) { const x = 5 + (r() * (MW - 10) | 0), y = 5 + (r() * (MH - 10) | 0); if (ok(x, y) && ok(x - rad, y) && ok(x + rad, y) && ok(x, y + rad) && ok(x, y - rad)) { fn(x, y); k++; } } };
  const rock = (x, y) => { const L2 = hex('#c4c4bb'), M2 = hex('#9a9a92'), D2 = hex('#6e6e68'); for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) if (!((dx === 0 || dx === 3) && (dy === 0 || dy === 2))) px(x + dx, y + dy, dy === 0 ? L2 : dy === 2 ? D2 : M2); };
  const trees = [], critters = [], C = th.treeCol.map(hex);
  let windmill = null, lights = [], mixer = null, hoses = [], tight = [];
  const decorMap = MAPS.find(m => m.decor === th.decor), special = Object.fromEntries(MAPS.map(m => [m.flag, null])); // T.ring, T.desert ... (null: not this track)
  const darken = (x, y, rad, ox, oy) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { if (dx * dx + dy * dy > rad * rad) continue; const xx = x + dx + ox, yy = y + dy + oy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; const i = (yy * MW + xx) * 4; d[i] *= .78; d[i + 1] *= .76; d[i + 2] *= .76; } };
  const flowers = (n, PET) => scatter(n, 2, (x, y) => { const pc = PET[(r() * PET.length) | 0]; px(x - 1, y, pc); px(x + 1, y, pc); px(x, y - 1, pc); px(x, y + 1, pc); px(x, y, pc === PET[1] ? hex('#ff8c1a') : hex('#ffe14d')); });
  // wall look: fence + hay (meadow), log pile + pines (forest), beach bar + surfboards + palms (beach), railway barrier (train)
  const kind = def.wallStyle, along = (sg, step, fn) => { for (let t = 0; t <= sg.len; t += step) fn(sg.a[0] + sg.ca * t, sg.a[1] + sg.sa * t, t); };
  const frac = (sg, fs) => { if (th.tree !== 'none') for (const f of fs) wallTrees.push({ x: Math.round(sg.a[0] + sg.ca * sg.len * f), y: Math.round(sg.a[1] + sg.sa * sg.len * f) }); };
  const at = (sg, x, y, a, b) => [Math.round(x + sg.ca * a - sg.sa * b), Math.round(y + sg.sa * a + sg.ca * b)];
  for (const sg of wsegs) {
    const shadow = rad => along(sg, 3, (x, y) => darken(Math.round(x), Math.round(y), rad, 2, 3));
    if (kind === 'fence') {
      const LT = hex('#d9b27c'), DK = hex('#7a5230'), PO = hex('#5a3a1c'), PH = hex('#c99e69');
      shadow(2);
      along(sg, 1, (x, y) => { for (const [k, c] of [[-2, LT], [2, DK]]) { const [qx, qy] = at(sg, x, y, 0, k); px(qx, qy, c); } });
      along(sg, 10, (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -3; b <= 3; b++) { const [qx, qy] = at(sg, x, y, a, b); px(qx, qy, a < 0 && b < 3 ? PH : PO); } });
      along(sg, 1, (x, y, t) => {
        if (Math.round(t) % 70 !== 35) return;
        const X = Math.round(x), Y = Math.round(y); darken(X, Y, 6, 2, 3);
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const dd = Math.hypot(dx, dy); if (dd > 6) continue; px(X + dx, Y + dy, dd > 5.2 ? hex('#a8863a') : (Math.round(dd) % 2 ? hex('#e3c16f') : hex('#cfa84f'))); }
      });
      frac(sg, [.3, .7]);
    } else if (kind === 'logs') {
      const DK = hex('#4e3420'), R1c = hex('#d8b27a'), R2c = hex('#c49a5e'), RC = hex('#a07a45');
      shadow(4);
      along(sg, 1, (x, y) => { for (let b = -5; b <= 5; b++) { const [qx, qy] = at(sg, x, y, 0, b); px(qx, qy, DK); } });
      along(sg, 6, (x, y) => {
        for (const row of [-2.5, 2.5]) {
          const [cx, cy] = at(sg, x, y, row > 0 ? 3 : 0, row);
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = Math.hypot(dx, dy); if (dd > 3) continue; px(cx + dx, cy + dy, dd > 2.2 ? DK : dd < 1 ? RC : Math.floor(dd * 1.3) % 2 ? R1c : R2c); }
        }
      });
      frac(sg, [.12, .3, .5, .7, .88]);
    } else if (kind === 'bar') {
      const SB = [['#ff7a45', '#ffd8b0'], ['#2fb5c8', '#e6fbff'], ['#ff5a9e', '#ffe0f0'], ['#ffd93d', '#fff6c8']].map(p => p.map(hex)), OU = hex('#6b4a2b');
      shadow(3);
      let n = 0;
      along(sg, 11, (x, y, t) => {
        if (Math.abs(t - sg.len / 2) < 36) return;
        const [c0, c1] = SB[n++ % 4];
        for (let a = -2; a <= 2; a++) for (let b = -6; b <= 6; b++) { const e = (a / 2.6) ** 2 + (b / 6.4) ** 2; if (e > 1) continue; const [qx, qy] = at(sg, x, y, a, b); px(qx, qy, e > .7 ? OU : Math.abs(a) < 1 ? c1 : c0); }
      });
      // the bar: plank floor, counter and stools on the ground, thatched roof with bunting on the top layer
      const mx = sg.a[0] + sg.ca * sg.len / 2, my = sg.a[1] + sg.sa * sg.len / 2;
      for (let a = -27; a <= 27; a++) for (let b = -15; b <= 15; b++) { const [qx, qy] = at(sg, mx, my, a, b); px(qx, qy, ((a + 40) >> 2) & 1 ? hex('#b8864c') : hex('#a8763c')); }
      for (let a = -24; a <= 24; a++) for (let b = 6; b <= 10; b++) { const [qx, qy] = at(sg, mx, my, a, b); px(qx, qy, b === 6 ? hex('#e8c88c') : hex('#5a3a1c')); }
      for (let a = -20; a <= 20; a += 10) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) { const [qx, qy] = at(sg, mx, my, a + dx, dy); px(qx, qy, a % 20 ? hex('#ffffff') : hex('#e84a5f')); }
      const TH = [[224, 184, 90], [201, 160, 64], [236, 206, 120]], BUN = ['#ff5a7a', '#ffd93d', '#4d96ff', '#6bcb77', '#ffffff'].map(hex);
      for (let a = -29; a <= 29; a++) for (let b = -17; b <= 14; b++) {
        const e = Math.max(Math.abs(a) / 29, Math.abs(b + 1.5) / 15.5); if (e > 1) continue;
        const [qx, qy] = at(sg, mx, my, a, b), v = hash(qx, qy, 3);
        setT(qx, qy, e > .92 ? [150, 110, 40] : (Math.abs(b) + (a >> 1)) % 4 === 0 ? TH[1] : v < .15 ? TH[2] : TH[0]);
      }
      for (let a = -26; a <= 26; a += 4) { const bc = BUN[(a / 4 + 7) % 5 | 0]; for (const bb of [15, 16]) { const [qx, qy] = at(sg, mx, my, a, bb); setT(qx, qy, bc); } }
      frac(sg, [.18, .3, .7, .82]);
    } else if (kind === 'barrier') {
      const RD = hex('#e84a5f'), WH2 = hex('#ffffff'), PO = hex('#444444');
      shadow(2);
      along(sg, 1, (x, y, t) => { for (let b = -2; b <= 2; b++) { const [qx, qy] = at(sg, x, y, 0, b); px(qx, qy, ((Math.floor(t) >> 3) & 1) ? RD : WH2); } });
      along(sg, 24, (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -4; b <= 4; b++) { const [qx, qy] = at(sg, x, y, a, b); px(qx, qy, PO); } });
    }
  }
  if (def.gate && rail) {
    // closed boom gate across the rail corridor
    const gy = def.gate.y, RD = hex('#e84a5f'), WH2 = hex('#ffffff'), PO = hex('#444444');
    for (let x = rail.x - 26; x <= rail.x + 26; x++) for (let b = -2; b <= 2; b++) px(x, gy + b, ((x >> 3) & 1) ? RD : WH2);
    for (const sx of [rail.x - 28, rail.x + 28]) { for (let dy = -4; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) px(sx + dx, gy + dy, PO); px(sx, gy - 3, hex('#ff3b3b')); }
  }
  yield .74;
  // the garden palisade (1S6-11): the fence spots along one side of the road with deep water behind them are joined into one solid line,
  // 5 px wide (dark rim, light and darker bamboo), a post every 9 px, a shadow to the bottom right; the obstacles lie on that same line every
  // 4 px (r 2.5 = half its width), so what you see is exactly what stops you. Spots up to 10 points and 16 px apart are joined (no gaps at the bends).
  const palisade = sides => {
    const SL = hex('#c8b25a'), SM = hex('#8f7a30'), SD = hex('#24190a'), SP = hex('#5a4318'), col = new Map(), posts = new Map(), sh = new Set();
    const put = (x, y, c, m = col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) m.set(y * MW + x, c); };
    const post = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(x + dx, y + dy, Math.abs(dx) === 2 || Math.abs(dy) === 2 ? SD : dx + dy < -1 ? SL : SP, posts); };
    for (const spots of sides) {
      let i0 = spots.findIndex(p => !p); if (i0 < 0) i0 = 0;
      let prev = null, gap = 0, run = 0;
      for (let k = 1; k <= N; k++) {
        const p = spots[(i0 + k) % N];
        if (!p) { if (++gap > 10) prev = null; continue; }
        gap = 0;
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 16) { post(p.x, p.y); walls.push({ x: p.x, y: p.y, r: 2.5 }); run = 0; prev = p; continue; }
        const L = Math.hypot(p.x - prev.x, p.y - prev.y); if (L < .5) continue;
        const ux = (p.x - prev.x) / L, uy = (p.y - prev.y) / L;
        for (let t = .5; t <= L; t += .5) {
          const cx = prev.x + ux * t, cy = prev.y + uy * t, lit = uy - ux > 0 ? 1 : -1; // the side facing the top left is the light one
          for (let w = -2; w <= 2; w += .5) {
            put(cx - uy * w, cy + ux * w, Math.abs(w) > 1.5 ? SD : w * lit > 0 ? SL : SM);
            for (const o of [2, 3]) { const sx = Math.round(cx - uy * w + o), sy = Math.round(cy + ux * w + o); if (sx >= 0 && sy >= 0 && sx < MW && sy < MH) sh.add(sy * MW + sx); }
          }
          run += .5;
          if (run % 4 === 0) walls.push({ x: cx, y: cy, r: 2.5 });
          if (run % 9 === 0) post(cx, cy);
        }
        prev = p;
      }
    }
    for (const j of sh) if (!col.has(j) && !posts.has(j)) { const q = j * 4; d[q] *= .58; d[q + 1] *= .6; d[q + 2] *= .62; }
    for (const [j, c] of col) set(j, c);
    for (const [j, c] of posts) set(j, c);
  };
  // fence along both sides of the track: rope (beach), white pickets (meadow), logs (forest)
  const FENCE = { rope: ['#f0dcaa', '#7a4f2a', '#a8743f', '#5a3a1c', 9], bamboo: ['#c9d49a', '#5f7d34', '#87a24b', '#364a1c', 9], picket: ['#e6e1d2', '#ffffff', '#f4f1e6', '#8a8472', 6], log: ['#8a6440', '#5a3a1c', '#7a5230', '#3b2512', 12], mesh: ['#e8872a', '#5a6068', '#7b838c', '#2c3036', 9] }[th.fence];
  if (FENCE) {
    const RL = hex(FENCE[0]), P0 = hex(FENCE[1]), P1 = hex(FENCE[2]), P2 = hex(FENCE[3]), RL2 = hex('#6b4a2e');
    const garden = th.decor === 'garten', pal = garden ? [new Array(N).fill(null), new Array(N).fill(null)] : null; // palisade spots per side (garden)
    for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
      // the garden: if the first spot is already water, the fence moves out onto the grass strip next to the pond
      let x = 0, y = 0, j = -1;
      for (const o of th.decor === 'garten' ? [5, 7, 9, 11] : [5]) {
        x = Math.round(path[i].x + nrm[i].x * s * (HALF + o)); y = Math.round(path[i].y + nrm[i].y * s * (HALF + o));
        if (x < 1 || y < 1 || x >= MW - 3 || y >= MH - 3) { j = -1; break; }
        j = y * MW + x; if (ter[j] === 0 && dist[j] >= HALF + 4 && !washMask[j] && (!shore[j] || th.decor === 'garten')) break; j = -1;
      }
      if (j < 0) continue;
      if ((def.kipper || []).some(k => Math.hypot(k[0] - x, k[1] - y) < 52)) continue; // the dump trucks drive through a gap in the fence
      // the garden: where deep water lies right behind the fence it is a solid barrier (except at the stepping stones, that is where you go in on purpose)
      // it looks different from the low decoration fence: a thick dark bamboo palisade with posts (drawn below as one line, 1S6-11)
      if (garden && !(def.stones || []).some(q => Math.hypot(q[0] - x, q[1] - y) < 60)) {
        let wet = false; for (let dy = -12; dy <= 12 && !wet; dy += 4) for (let dx = -12; dx <= 12; dx += 4) { const xx = clamp(x + dx, 0, MW - 1), yy = clamp(y + dy, 0, MH - 1); if (ter[yy * MW + xx] === 5 && !bridgeMask[yy * MW + xx]) { wet = true; break; } }
        if (wet) { pal[s > 0 ? 1 : 0][i] = { x, y }; continue; }
      }
      if (i % FENCE[4] === 0) { px(x + 2, y + 2, P2); px(x, y, P1); px(x + 1, y, P0); px(x, y + 1, P0); px(x + 1, y + 1, P2); }
      else { px(x, y, RL); if (th.fence === 'log') px(x + Math.round(nrm[i].x * s), y + Math.round(nrm[i].y * s), RL2); }
    }
    if (garden) palisade(pal);
  }
  // the ramps over the railway (ZUG Rev 3, railJump): one at every crossing, grey concrete across the whole jump lane beside the road, yellow
  // and black stripes at the lip, a shadow behind it; whoever takes one flies over the rails beside the road (the train does not hit cars in the
  // air, train.js). Optional: the road itself stays flat. Since 1S4-8 there are no booms and no islands: the lane is part of the wider road and
  // the ramp starts 4 px outside the normal road edge; on the other side stands one warning light per crossing (solid post, draw.js drawCrossings).
  const ramps = [];
  if (RJ) for (const cr of jumpX) {
    const L = cr.side, i = (cr.i + Math.round(RJ.lip / 2) + N) % N, p = path[i], t = tan[i], nx = -t.y, ny = t.x;
    const l0 = Math.min(L * (HALF + 4), L * (HALF + RJ.w - 2)), l1 = Math.max(L * (HALF + 4), L * (HALF + RJ.w - 2));
    ramps.push({ x: p.x, y: p.y, tx: t.x, ty: t.y, lo: l0 - 3, hi: l1 + 3, vz: RJ.vz, push: RJ.push, cap: RJ.cap });
    const CO = [hex('#a4a8ad'), hex('#b6babf'), hex('#70757c')], YE = hex('#f2c230'), BK = hex('#2a2420'), SH = hex('#5e5040');
    for (let a = -38; a <= 3; a++) for (let l = l0; l <= l1; l++) {
      const x = Math.round(p.x + t.x * a + nx * l), y = Math.round(p.y + t.y * a + ny * l);
      // concrete gets lighter towards the lip (it rises), seams every 8 px, a dark rim on both long edges
      px(x, y, a > 0 ? SH : a >= -2 ? (((l >> 2) & 1) ? YE : BK) : l === l0 || l === l1 ? CO[2] : (a & 7) === 0 ? CO[2] : a > -16 || hash(x, y, 31) < .2 ? CO[1] : CO[0]);
    }
  }
  yield .76;
  // tunnel hills: a rocky hill with a grassy top on the wall line, the train disappears into it (the hill lies on the top layer, so it covers the train). Solid for cars.
  for (const { x: hx, y: hy, hw, portals } of def.tunnels || []) {
    const hh = 33, rr = 12, inside = (x, y) => { const qx = Math.abs(x - hx) - (hw - rr), qy = Math.abs(y - hy) - (hh - rr); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
    for (let q = hx - hw + 20; q <= hx + hw - 20; q += 20) darken(q, hy, 40, 6, 8);
    for (let y = hy - hh - 1; y <= hy + hh + 1; y++) for (let x = hx - hw - 1; x <= hx + hw + 1; x++) {
      const out = inside(x + .5, y + .5); if (out > 0) continue;
      const dep = -out, lit = ((hx - x) + (hy - y)) / (hw + hh) * 18;
      let c;
      if (dep < 2) c = [52, 52, 58];
      else {
        // one natural rock formation over the whole hill, lit from the top left, with boulders, ridges and a few dark cracks; the rim is a bit darker
        const H = (X, Y) => vnoise(X * .1, Y * .1, sd + 14) * .55 + vnoise(X * .24, Y * .24, sd + 15) * .3 + vnoise(X * .6, Y * .6, sd + 16) * .15;
        const sl = (H(x - 1, y - 1) - H(x + 1, y + 1)) * 170, crack = Math.abs(vnoise(x * .07, y * .09, sd + 17) - .5) < .012;
        let g = 130 + (H(x, y) - .5) * 60 + sl + lit * .6; if (hash(x, y, sd + 13) < .05) g -= 12;
        if (crack) g -= 30;
        g *= .72 + .28 * Math.min(1, (dep - 2) / 12);
        c = [g, g - 3, g - 8];
      }
      setT(x, y, c);
    }
    for (let gy = hy - hh + 4; gy <= hy + hh - 4; gy += 8) for (let gx = hx - hw + 4; gx <= hx + hw - 4; gx += 8) if (inside(gx, gy) < -3) walls.push({ x: gx, y: gy, r: 7 });
    for (let y = hy - hh - 8; y <= hy + hh + 8; y++) for (let x = hx - hw - 4; x <= hx + hw + 4; x++) if (y >= 0 && y < MH && x >= 0 && x < MW) wallMask[y * MW + x] = 1;
    // the tunnel mouths on both faces: stone frame and lintel, dark opening
    for (const sy of [-1, 1]) {
      const ye = hy + sy * hh;
      for (const px0 of portals) for (let k = -3; k <= 14; k++) for (let dx = -19; dx <= 19; dx++) {
        const ad = Math.abs(dx), y = ye - sy * k; let c;
        if (k < 0) c = k === -3 ? [112, 108, 98] : [188, 184, 170];
        else if (ad <= 14) c = k < 3 && ad >= 12 ? [96, 94, 100] : [Math.max(62, 118 - k * 4), Math.max(62, 118 - k * 4), Math.max(66, 124 - k * 4)];
        else c = ad === 19 ? [112, 108, 98] : [176, 172, 160];
        if (c) setT(px0 + dx, y, c);
      }
    }
  }
  yield .78;
  if (th.decor === 'wiese') {
    const PET = ['#ff5a7a', '#ffe14d', '#ffffff', '#b36bff', '#5ab4ff'].map(hex);
    flowers(320, PET);
    // pond life: lily pads, reeds and a duck family
    for (const p of def.ponds) {
      for (let k = 0; k < 10; k++) {
        const a = r() * TAU, q = Math.sqrt(r()) * .72, lx = Math.round(p[0] + Math.cos(a) * p[2] * q), ly = Math.round(p[1] + Math.sin(a) * p[3] * q), notch = r() * TAU;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const dd = dx * dx + dy * dy; if (dd > 10 || (dd > 1 && Math.abs(angDiff(Math.atan2(dy, dx), notch)) < .5)) continue;
          px(lx + dx, ly + dy, dx + dy < -1 ? hex('#6fca57') : hex('#3f9a3f'));
        }
        if (r() < .45) { px(lx, ly, hex('#ff9ecf')); px(lx + 1, ly, hex('#ffd1e8')); px(lx, ly - 1, hex('#ff9ecf')); }
      }
      for (let k = 0; k < 40; k++) {
        const a = r() * TAU, rx = Math.round(p[0] + Math.cos(a) * (p[2] + 6)), ry = Math.round(p[1] + Math.sin(a) * (p[3] + 6)); if (!ok(rx, ry)) continue;
        const hgt = 4 + (r() * 4 | 0);
        for (let q = 0; q < hgt; q++) px(rx, ry - q, hex(q > hgt - 3 ? '#6b4226' : '#2f6d24'));
        px(rx + 1, ry, hex('#3f8f2f'));
      }
      critters.push({ type: 'ducks', x: p[0], y: p[1], rx: p[2] * .55, ry: p[3] * .5, ph: r() * TAU });
    }
    // flower beds
    scatter(12, 8, (x, y) => { const pc = PET[(r() * PET.length) | 0]; for (let k = 0; k < 22; k++) { const a = r() * TAU, q = r() * 7, fx = Math.round(x + Math.cos(a) * q), fy = Math.round(y + Math.sin(a) * q); px(fx - 1, fy, pc); px(fx + 1, fy, pc); px(fx, fy - 1, pc); px(fx, fy + 1, pc); px(fx, fy, hex('#ffe14d')); } });
    scatter(40, 3, (x, y) => { const pc = PET[(r() * PET.length) | 0]; for (const [dx, dy] of [[-1, -2], [1, -2], [-2, 0], [2, 0], [-1, 2], [1, 2], [0, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [0, 2]]) px(x + dx, y + dy, pc); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) px(x + dx, y + dy, hex('#ffc93c')); });
    scatter(16, 6, (x, y) => { for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) if ((dx / 6) ** 2 + (dy / 5) ** 2 <= 1) px(x + dx, y + dy, hash(x + dx, y + dy, 3) < .06 ? hex('#e84a5f') : dx + dy < -3 ? hex('#6fca57') : dx + dy > 3 ? hex('#2f7a26') : hex('#439a35')); });
    // picnic blanket with basket and plates
    scatter(2, 14, (x, y) => {
      darken(x, y, 10, 3, 3);
      for (let dy = -7; dy < 7; dy++) for (let dx = -10; dx < 10; dx++) px(x + dx, y + dy, (((dx + 10) / 4 | 0) + ((dy + 7) / 4 | 0)) & 1 ? hex('#e84a5f') : hex('#ffffff'));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) px(x + 4 + dx, y - 1 + dy, (dx + dy) & 1 ? hex('#a8743f') : hex('#8a5a2b'));
      px(x + 3, y - 4, hex('#5a3a1c')); px(x + 4, y - 5, hex('#5a3a1c')); px(x + 5, y - 4, hex('#5a3a1c'));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4) px(x - 5 + dx, y + 2 + dy, hex('#f4f4f4'));
      px(x - 5, y + 2, hex('#e03b3b')); px(x - 4, y + 2, hex('#7bd37b'));
    });
    // windmill with a conical roof; the sails turn while you race
    scatter(1, 30, (x, y) => {
      windmill = { x, y }; trees.push({ x, y, r: 12 }); darken(x, y, 12, 7, 9);
      for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
        const dd = Math.hypot(dx, dy); if (dd > 11) continue;
        const band2 = Math.floor(dd / 2.5) % 2, lit = dx + dy < 0;
        setT(x + dx, y + dy, dd > 10 ? [120, 70, 40] : band2 ? (lit ? [196, 120, 70] : [160, 90, 50]) : (lit ? [222, 146, 92] : [182, 106, 62]));
      }
    });
    scatter(7, 8, (x, y) => critters.push({ type: 'bunny', x, y, ph: r() * TAU, range: 10 + r() * 18, brown: r() < .5 }));
    scatter(26, 3, rock);
  } else if (th.decor === 'wald') {
    const LEAF = ['#e08a2c', '#d9b43a', '#b5562a', '#8a5a2b'].map(hex);
    scatter(800, 1, (x, y) => { const c = LEAF[(r() * 4) | 0]; px(x, y, c); if (r() < .5) px(x + 1, y, c); });
    scatter(50, 3, (x, y) => { const R2 = hex('#e03b3b'), R3 = hex('#a82424'), Wt = hex('#ffffff'); for (let dx = -2; dx <= 2; dx++) px(x + dx, y, R2); for (let dx = -1; dx <= 1; dx++) { px(x + dx, y - 1, R2); px(x + dx, y + 1, R3); } px(x - 1, y, Wt); px(x + 1, y - 1, Wt); px(x, y + 2, hex('#efe3c8')); px(x, y + 3, hex('#d8c9a8')); });
    // ferns
    const F1 = hex('#3f9a3f'), F2 = hex('#2c7a2f'), F3 = hex('#62b85a');
    scatter(50, 6, (x, y) => {
      const off = r() * TAU;
      for (let k = 0; k < 5; k++) {
        const a = off + k * TAU / 5, ca = Math.cos(a), sa = Math.sin(a);
        for (let s = 1; s <= 6; s++) { const fx = Math.round(x + ca * s), fy = Math.round(y + sa * s); px(fx, fy, F2); if (s > 1 && s < 6) { px(Math.round(fx - sa), Math.round(fy + ca), s % 2 ? F1 : F3); px(Math.round(fx + sa), Math.round(fy - ca), s % 2 ? F3 : F1); } }
      }
    });
    // mossy rocks
    scatter(16, 5, (x, y) => {
      darken(x, y, 4, 2, 3);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx / 4.3) ** 2 + (dy / 3.3) ** 2 <= 1) px(x + dx, y + dy, dy < 0 ? (hash(x + dx, y + dy, 4) < .5 ? hex('#5cb85c') : hex('#3f9a3f')) : dy > 1 ? hex('#6e6e68') : hex('#9a9a92'));
    });
    // tree stumps (solid)
    scatter(10, 7, (x, y) => {
      trees.push({ x, y, r: 5 }); darken(x, y, 5, 3, 4);
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const dd = Math.hypot(dx, dy); if (dd > 5.2) continue; px(x + dx, y + dy, dd > 4.3 ? hex('#5a3a1c') : dd < 1 ? hex('#a07a45') : Math.floor(dd * 1.3) % 2 ? hex('#d8b27a') : hex('#c49a5e')); }
    });
    // fallen logs (solid)
    scatter(6, 16, (x, y) => {
      const ang = r() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
      for (const q of [-8, 0, 8]) trees.push({ x: x + ca * q, y: y + sa * q, r: 5 });
      darken(x, y, 13, 3, 4);
      for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
        const a = dx * ca + dy * sa, b = -dx * sa + dy * ca; if (Math.abs(a) > 14 || Math.abs(b) > 4.5) continue;
        let col = Math.abs(a) > 12.5 ? (Math.round(Math.abs(b) * 1.2) % 2 ? '#d8b27a' : '#b8905a') : b < -2.5 ? '#8a6440' : b > 2 ? '#4e3420' : Math.round(a) % 4 === 0 ? '#4e3420' : '#6b4a2e';
        if (Math.abs(a) <= 12.5 && b < 0 && hash(x + dx, y + dy, 6) < .1) col = '#5cb85c';
        px(x + dx, y + dy, hex(col));
      }
    });
    scatter(5, 6, (x, y) => critters.push({ type: 'squirrel', x, y, ph: r() * TAU, range: 10 + r() * 16 }));
    scatter(4, 6, (x, y) => critters.push({ type: 'hedgehog', x, y, ph: r() * TAU, range: 8 + r() * 10 }));
    scatter(20, 3, rock);
  } else if (th.decor === 'strand') {
    const SH = ['#ffffff', '#ffd1dc', '#f7e9d7'].map(hex), OUTL = hex('#6b4a2b');
    scatter(150, 2, (x, y) => { const c = SH[(r() * 3) | 0]; px(x, y, c); px(x + 1, y, c); px(x - 1, y, c); px(x, y - 1, c); px(x, y + 1, hex('#c9b8a0')); });
    scatter(22, 4, (x, y) => { const c = hex('#ff8a3d'), c2 = hex('#ffb77d'); px(x, y, c2); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - Math.PI / 2; for (let s = 1; s <= 3; s++) px(Math.round(x + Math.cos(a) * s), Math.round(y + Math.sin(a) * s), c); } });
    scatter(8, 3, rock);
    // striped beach towels
    const TOW = [['#ff5a7a', '#ffffff'], ['#4d96ff', '#ffffff'], ['#ffd93d', '#ff9f43'], ['#6bcb77', '#ffffff'], ['#b36bff', '#ffd1f0']].map(p => p.map(hex));
    scatter(8, 12, (x, y) => {
      const [c0, c1] = TOW[(r() * TOW.length) | 0], vert = r() < .5, w = vert ? 11 : 19, h = vert ? 19 : 11;
      darken(x, y, 9, 2, 2);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const q = vert ? dy : dx; px(x - (w >> 1) + dx, y - (h >> 1) + dy, (q >> 2) & 1 ? c1 : c0); }
    });
    // sandcastles with a little flag
    scatter(6, 10, (x, y) => {
      const S = ['#f5dca0', '#e9c57d', '#d9b064', '#b8904a'].map(hex);
      for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const dd = Math.hypot(dx, dy); if (dd > 8.5 && dd < 10) px(x + dx, y + dy, WET[0]); }
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) px(x + dx, y + dy, dx + dy < -4 ? S[0] : dx + dy > 4 ? S[2] : S[1]);
      for (const [cx2, cy2] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, 0]]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) px(x + cx2 + dx, y + cy2 + dy, dx + dy < 0 ? S[0] : dx + dy > 1 ? S[3] : S[1]);
      px(x, y - 1, hex('#6b4a2b')); px(x, y - 2, hex('#6b4a2b')); px(x + 1, y - 3, hex('#e03b3b')); px(x + 2, y - 3, hex('#e03b3b')); px(x + 1, y - 2, hex('#e03b3b'));
    });
    // beach balls
    scatter(7, 5, (x, y) => {
      const BC = ['#e03b3b', '#ffffff', '#2e86de', '#ffffff', '#ffd93d', '#ffffff'].map(hex);
      darken(x, y, 4, 2, 3);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const dd = Math.hypot(dx, dy); if (dd > 4.3) continue; px(x + dx, y + dy, dd > 3.5 ? OUTL : dd < 1 ? hex('#ffffff') : BC[Math.floor((Math.atan2(dy, dx) + Math.PI) / TAU * 6) % 6]); }
    });
    // surfboards
    const SB = [['#ff7a45', '#ffd8b0'], ['#2fb5c8', '#e6fbff'], ['#ff5a9e', '#ffe0f0'], ['#ffd93d', '#fff6c8']].map(p => p.map(hex));
    scatter(5, 13, (x, y) => {
      const [c0, c1] = SB[(r() * SB.length) | 0], ang = r() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
      darken(x, y, 8, 3, 4);
      for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
        const a = dx * ca + dy * sa, b = -dx * sa + dy * ca, e = (a / 12) ** 2 + (b / 3.6) ** 2; if (e > 1) continue;
        px(x + dx, y + dy, e > .72 ? OUTL : Math.abs(b) < .7 ? c1 : c0);
      }
    });
    // beach umbrellas: solid obstacles, the striped canopy sits on the top layer
    const UM = ['#e84a5f', '#2e86de', '#ff9f43', '#6bcb77', '#b36bff'].map(hex), UW = hex('#ffffff');
    scatter(8, 14, (x, y) => {
      trees.push({ x, y, r: 9 });
      darken(x, y, 11, 6, 8);
      const c = UM[(r() * UM.length) | 0], rot = r() * TAU;
      for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
        const dd = Math.hypot(dx, dy), an = Math.atan2(dy, dx) + rot, wedge = Math.floor(((an % TAU) + TAU) % TAU / (TAU / 8));
        const edge = 11 - Math.abs(Math.sin(an * 4)) * 1.2; if (dd > edge) continue;
        let col = wedge % 2 ? UW : c;
        if (dx + dy < -8) col = col === UW ? [255, 255, 255] : col.map(v => Math.min(255, v + 40));
        else if (dx + dy > 8) col = col.map(v => v * .78 | 0);
        if (dd < 1.5) col = [240, 240, 240];
        setT(x + dx, y + dy, col);
      }
    });
    scatter(7, 8, (x, y) => critters.push({ type: 'crab', x, y, ph: r() * TAU, range: 8 + r() * 18 }));
    if (decorMap && map === decorMap) special[decorMap.flag] = yield* decorMap.paint({ MW, MH, def, d, set, setT, ter, dist, walls, wallMask, RT });
  } else if (th.decor === 'garten') {
    const rc = (x0, y0, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(x0 + xx, y0 + yy, c); };
    const GR = ['#2f6b3a', '#3f8a47', '#58a85a', '#e8a6c0', '#ffffff'].map(hex);
    // the rails of the bridges are solid: red lacquered railings with dark posts and golden caps, a shadow on the water
    for (let i = 0; i < N; i += 3) for (const s of [-1, 1]) {
      const x = path[i].x + nrm[i].x * s * HALF, y = path[i].y + nrm[i].y * s * HALF;
      if (onDeck(x, y, i)) walls.push({ x, y, r: 3 });
    }
    const BR = [hex('#2a120c'), hex('#b8321f'), hex('#e0543a'), hex('#ff8a6a')], BP = hex('#3a1a10'), BG = hex('#e8c14a');
    for (let j = 0; j < A; j++) {
      if (dist[j] < HALF - 3 || dist[j] > HALF + 3 || !onDeck(j % MW + .5, (j / MW | 0) + .5, near[j])) continue;
      const dd = dist[j], i = near[j], x = j % MW, y = (j / MW) | 0;
      if (dd > HALF + 1.5) { if (ter[j] === 5 || ter[j] === 3) { const q = j * 4; d[q] *= .6; d[q + 1] *= .6; d[q + 2] *= .65; } continue; }
      const post = i % 9 < 2;
      setT(x, y, post ? (dd > HALF - 2.4 && dd < HALF + .4 && i % 9 === 0 ? BG : BP) : dd < HALF - 2.2 || dd > HALF + .8 ? BR[0] : dd < HALF - 1.2 ? BR[3] : dd < HALF - .2 ? BR[2] : BR[1]);
    }
    // clipped hedges between the roads: solid, a few blossoms
    for (const [x1, y1, x2, y2] of def.hedges || []) {
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (let t = 0; t <= L; t += 4) {
        const x = Math.round(x1 + (x2 - x1) * t / L), y = Math.round(y1 + (y2 - y1) * t / L), j = y * MW + x;
        if (dist[j] < HALF + 3 || ter[j] !== 0) continue;
        if (t % 8 === 0) { walls.push({ x, y, r: 5 }); darken(x, y, 5, 2, 3); for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (dx * dx + dy * dy <= 49) wallMask[clamp(y + dy, 0, MH - 1) * MW + clamp(x + dx, 0, MW - 1)] = 1; }
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
          if (dx * dx + dy * dy > 28) continue;
          const sh = (dx + dy) / 6, hh = hash(x + dx, y + dy, 3);
          setT(x + dx, y + dy, hh < .05 ? GR[3 + (hh < .02 ? 1 : 0)] : sh < -.4 ? GR[2] : sh > .4 ? GR[0] : GR[1]);
        }
      }
    }
    // large pagodas outside of the track: stone base, tiers of white walls with red posts and dark curved roofs
    const pagoda = (cx, cy, n, sc) => {
      // seen from above: stacked square tile roofs (four facets, ridges on the diagonals), each tier a bit smaller, a gold finial on top
      const hw0 = Math.round(21 * sc), RF = [['#8793a6', '#6c778a'], ['#566174', '#3f4859']].map(p => p.map(hex)), RD = hex('#2b303c'), EV = hex('#b83a2a'), EV2 = hex('#8a2a1e'), GD = hex('#e8c14a');
      walls.push({ x: cx, y: cy, r: Math.round(hw0 * .85) }); darken(cx, cy, Math.round(hw0 * 1.1), 5, 6);
      for (let dy = -hw0 - 3; dy <= hw0 + 3; dy++) for (let dx = -hw0 - 3; dx <= hw0 + 3; dx++) wallMask[clamp(cy + dy, 0, MH - 1) * MW + clamp(cx + dx, 0, MW - 1)] = 1;
      for (let t = 0; t < n; t++) {
        const hw = Math.round(hw0 - t * hw0 * .8 / n);
        for (let dy = -hw; dy <= hw; dy++) for (let dx = -hw; dx <= hw; dx++) {
          const ax = Math.abs(dx), ay = Math.abs(dy), m = Math.max(ax, ay);
          let c;
          if (m >= hw - 1) c = (dx + dy) > 0 ? EV2 : EV;
          else if (Math.abs(ax - ay) <= 0) c = RD;
          else { const up = ay >= ax ? dy < 0 : dx < 0; c = RF[(m + t) % 4 < 1 ? 1 : 0][up ? 0 : 1]; }
          setT(cx + dx, cy + dy, c);
        }
      }
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) setT(cx + dx, cy + dy, dx + dy < 0 ? hex('#fff0a8') : GD);
    };
    for (const [x, y, n, sc] of def.pagodas || []) pagoda(x, y, n, sc);
    flowers(240, ['#ffc2d6', '#ffffff', '#ff9fbf', '#ffe14d', '#b9a2ff'].map(hex));
    // the decoration stands where the track says, in lines and pairs (a laid-out garden, nothing at random; 1S6-8): bonsai trees in their pots,
    // stone lanterns, cherry trees (drawn with the trees below)
    for (const [x, y] of def.bonsai || []) {
      walls.push({ x, y, r: 5 }); darken(x, y, 5, 2, 3);
      rc(x - 4, y + 1, 9, 4, hex('#8a5a3a')); rc(x - 5, y, 11, 1, hex('#b07a52')); rc(x - 3, y + 4, 7, 1, hex('#5a3a22'));
      for (let k = 0; k < 9; k++) rc(x - 1 + Math.round(Math.sin(k * .55) * 2), y - k, 2, 1, hex('#6b4a2e'));
      for (const [bx, by, rr] of [[x - 5, y - 7, 4], [x + 4, y - 10, 4], [x - 1, y - 14, 5]])
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) if ((dx / (rr + 1)) ** 2 + (dy / rr) ** 2 <= 1) setT(bx + dx, by + dy, dx + dy < -2 ? GR[2] : dx + dy > 2 ? GR[0] : GR[1]);
    }
    for (const [x, y] of def.lanterns || []) {
      const L0 = hex('#b9b7ac'), L1 = hex('#8f8d82'), L2 = hex('#6d6b62');
      walls.push({ x, y, r: 4 }); darken(x, y, 4, 2, 3);
      rc(x - 4, y, 9, 2, L1); rc(x - 1, y - 6, 3, 6, L0); rc(x - 4, y - 11, 9, 5, L1); rc(x - 3, y - 10, 7, 3, L0); rc(x - 1, y - 10, 3, 3, hex('#ffd36a'));
      rc(x - 5, y - 13, 11, 2, L2); rc(x - 3, y - 15, 7, 2, L1); rc(x - 1, y - 17, 3, 2, L0);
    }
    for (const [x, y] of def.cherries || []) wallTrees.push({ x, y });
    // the torii at the entrance of the short cut across the lake [x, y, half span]: two pillars north and south of the way in, the curved
    // black top beam over the red one on the top layer (you drive under it)
    if (def.torii) {
      // [x, y of the feet, half the distance of the pillars]: a red torii in front of the hedge, facing the way in (drawn upright like the lanterns):
      // two pillars with black feet, the red lower beam (nuki), the black top beam (kasagi) with upturned ends over its red layer, the name plate
      const [tx, ty, h] = def.torii, TB = hex('#1f1612'), TR = hex('#e0452a'), TL = hex('#ff7a52'), TD = hex('#9a2614'), TG = hex('#e8c14a');
      for (let dx = -h - 4; dx <= h + 4; dx++) darken(tx + dx + 4, ty + 2, 2, 0, 0);
      for (const qx of [tx - h, tx + h]) {
        walls.push({ x: qx, y: ty, r: 3 });
        rc(qx - 2, ty - 1, 5, 3, TB);
        for (let k = 2; k <= 24; k++) { setT(qx - 1, ty - k, TL); setT(qx, ty - k, TR); setT(qx + 1, ty - k, TD); }
      }
      rc(tx - h - 4, ty - 19, 2 * h + 9, 3, TR); rc(tx - h - 4, ty - 17, 2 * h + 9, 1, TD);
      rc(tx - h - 5, ty - 26, 2 * h + 11, 2, TR);
      for (let dx = -h - 8; dx <= h + 8; dx++) {
        const end = Math.max(0, Math.abs(dx) - h - 4), lift = end > 2 ? 2 : end > 0 ? 1 : 0;
        setT(tx + dx, ty - 29 - lift, TB); setT(tx + dx, ty - 28 - lift, TB); if (Math.abs(dx) <= h + 6) setT(tx + dx, ty - 27 - lift, hex('#3a2a22'));
      }
      rc(tx - 3, ty - 25, 7, 7, TG); rc(tx - 2, ty - 24, 5, 5, TB); rc(tx - 1, ty - 23, 3, 1, TG);
    }
    // lotus pads on the ponds and the lake
    for (const [lx, ly] of [[503, 152], [528, 141], [515, 164], [500, 102], [532, 100], [283, 376], [305, 381], [262, 394], [456, 296], [508, 348], [584, 310], [620, 296], [548, 268]]) {
      let free = true; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (ter[(ly + dy) * MW + lx + dx] !== 5) free = false;
      if (!free) continue;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = dx * dx + dy * dy; if (dd > 10 || (dd > 1 && dx > 0 && dy === 0)) continue; px(lx + dx, ly + dy, dx + dy < -1 ? hex('#6fca57') : hex('#3f9a3f')); }
      px(lx - 1, ly - 1, hex('#ffb3cf')); px(lx, ly - 1, hex('#ffffff')); px(lx - 1, ly, hex('#ff8fb8'));
    }
    // koi and floating lanterns move on ellipses over open water: the ellipse shrinks until the whole thing (m px around its middle) stays
    // clear of stones, bridges and shore all the way round (1S6-6: the koi never swim over a stone)
    const open = (x, y) => { const xx = Math.round(x), yy = Math.round(y); return xx >= 0 && yy >= 0 && xx < MW && yy < MH && ter[yy * MW + xx] === 5 && !bridgeMask[yy * MW + xx]; };
    const fit = (cx, cy, rx, ry, m) => {
      for (let s = 1; s > .15; s -= .1) {
        let fits = true;
        for (let k = 0; k < 48 && fits; k++) {
          const a = k / 48 * TAU, x = cx + Math.cos(a) * rx * s, y = cy + Math.sin(a) * ry * s;
          for (let q = 0; q < 9 && fits; q++) fits = open(x + (q ? Math.cos(q * TAU / 8) * m : 0), y + (q ? Math.sin(q * TAU / 8) * m : 0));
        }
        if (fits) return [rx * s, ry * s];
      }
      if (import.meta.env.DEV) console.warn(def.name + ': kein Platz im Wasser bei', cx, cy);
      return null;
    };
    for (const [kx, ky, krx, kry] of def.koi || []) { const f = fit(kx, ky, krx, kry, 9); if (f) for (let k = 0; k < 3; k++) critters.push({ type: 'koi', x: kx, y: ky, rx: f[0], ry: f[1], ph: r() * TAU + k * 2.1, col: (r() * 3) | 0 }); }
    for (const [fx, fy, frx, fry] of def.floats || []) { const f = fit(fx, fy, frx, fry, 6); if (f) critters.push({ type: 'float', x: fx, y: fy, rx: f[0], ry: f[1], ph: r() * TAU, sp: .08 + r() * .05 }); }
  } else if (th.decor === 'bau') {
    siteRing(yard, walls, MW, MH);
    const site = paintSite({ MW, MH, def, d, set, setT, px, darken, band, path, tan, nrm, yard, walls, scatter, rock, sd, washMask });
    lights = site.lights; mixer = site.mixer; hoses = site.hoses; tight = site.tight;
  } else if (decorMap) {
    special[decorMap.flag] = yield* decorMap.paint({ MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, deep, bridgeMask, isBridge,
      stoneMask, sd, th, r, critters, darken, starPix, mudPix, watPix, RT: decorMap === map ? RT : null });
  } else if (th.decor === 'farm') {
    // ZUG: the Bavarian village first (bahnmap.js), the flowers, hay bales and trees keep out of it
    if (def.village) { const left = paintVillage({ MW, MH, d, set, ter, dist, walls, wallMask, critters, rail, r, sd }); if (left.length && import.meta.env.DEV) console.warn('Dorf: kein Platz für', left.join(' ')); }
    flowers(160, ['#ff5a7a', '#ffe14d', '#ffffff'].map(hex));
    scatter(30, 4, (x, y) => { const Y = hex('#ffcf1f'), B = hex('#5a3a1f'); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; px(Math.round(x + Math.cos(a) * 3), Math.round(y + Math.sin(a) * 3), Y); } for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) px(x + dx, y + dy, B); });
    scatter(14, 7, (x, y) => { for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const dd = Math.hypot(dx, dy); if (dd > 6) continue; px(x + dx, y + dy, dd > 5.2 ? hex('#a8863a') : (Math.round(dd) % 2 ? hex('#e3c16f') : hex('#cfa84f'))); } });
    scatter(20, 3, rock);
  }
  yield .86;
  // trees: shadow on the ground, canopy on the top layer
  const forced = wallTrees.slice(), want = th.trees + forced.length;
  for (let tries = 0; (forced.length || trees.length < want) && tries < 12000; tries++) {
    const f = forced.shift();
    // a forest (treeEdge) also grows right up to the edge of the map, the trees are cut off there
    const m = th.treeEdge ? 2 : 14, x = f ? f.x : m + (r() * (MW - 2 * m) | 0), y = f ? f.y : m + (r() * (MH - 2 * m) | 0), j = y * MW + x;
    if (!f) {
      if (ter[j] !== 0 || dist[j] < HALF + 18 || shore[j] || wallMask[j]) continue;
      if (rail && rail.lines.some(L => Math.abs(x - L) < 36)) continue;
      if (trees.some(o => Math.hypot(o.x - x, o.y - y) < (th.treeGap || 26)) || walls.some(o => Math.hypot(o.x - x, o.y - y) < 17)) continue;
      let wet = false; for (let dy = -14; dy <= 14 && !wet; dy += 7) for (let dx = -14; dx <= 14; dx += 7) { const xx = clamp(x + dx, 0, MW - 1), yy = clamp(y + dy, 0, MH - 1); if (ter[yy * MW + xx] === 3 || ter[yy * MW + xx] === 5) wet = true; }
      if (wet) continue;
    }
    trees.push({ x, y, r: th.tree === 'palm' ? 5 : 9 });
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
      if (dx * dx + dy * dy > 110) continue;
      const xx = x + dx + 5, yy = y + dy + 7; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
      const i = (yy * MW + xx) * 4; d[i] *= .7; d[i + 1] *= .7; d[i + 2] *= .72;
    }
    if (th.tree === 'round' || th.tree === 'cherry') {
      for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
        const X = x + dx, Y = y + dy, dd = Math.hypot(dx, dy) + (vnoise(X * .45, Y * .45, 5) - .5) * 3.5; if (dd > 11.5) continue;
        const s = (dx + dy) / 11 + (vnoise(X * .5, Y * .5, 6) - .5) * .9;
        let col = s < -.55 ? C[2] : s > .45 ? C[0] : C[1];
        if (vnoise(X * .7, Y * .7, 8) > .74 && s < .3) col = C[2];
        if (hash(X, Y, 7) < .015) col = th.tree === 'cherry' ? [255, 246, 250] : [224, 59, 59];
        setT(X, Y, col);
      }
    } else if (th.tree === 'pine') {
      const rot = r() * TAU;
      for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
        const X = x + dx, Y = y + dy, dd = Math.hypot(dx, dy), an = Math.atan2(dy, dx);
        const rad = 9 + 3 * Math.abs(Math.cos(an * 4 + rot)), inner = 5 + 2 * Math.abs(Math.cos(an * 4 + rot + Math.PI / 4));
        if (dd > rad) continue;
        setT(X, Y, dd < 2 ? C[2] : dd < inner ? ((dx + dy) < 0 ? C[2] : C[1]) : ((dx + dy) < -2 ? C[1] : C[0]));
      }
    } else {
      const off = r() * TAU;
      for (let k = 0; k < 7; k++) {
        const a = off + k * TAU / 7, ca = Math.cos(a), sa = Math.sin(a);
        for (let s = 1; s <= 15; s++) {
          const X = x + ca * s, Y = y + sa * s + (s > 9 ? (s - 9) * .5 : 0);
          setT(X, Y, s < 5 ? C[2] : C[1]); setT(X + ca * .5, Y + sa * .5, s < 5 ? C[2] : C[1]);
          if (s >= 4 && s <= 13) { const w = s < 11 ? 2 : 1; for (let q = 1; q <= w; q++) { setT(X - sa * q, Y + ca * q + q * .4, C[0]); setT(X + sa * q, Y - ca * q + q * .4, s % 2 ? C[2] : C[1]); } }
        }
      }
      for (const [dx, dy] of [[-1, -1], [1, -1], [0, 1]]) { setT(x + dx, y + dy, [107, 68, 35]); setT(x + dx + 1, y + dy, [138, 90, 43]); }
    }
    if (trees.length % 12 === 0) yield .86 + .08 * Math.min(1, trees.length / want);
  }
  yield .94;
  const base = toCanvas(img);
  yield .97;
  const top = toCanvas(outlineImg(new ImageData(tp, MW, MH), MW, MH, C[3]));
  const wp = path[wi], solid = trees.concat(walls);
  return { W: MW, H: MH, def, th, name: def.name, path, tan, nrm, N, ter, washMask, trees: solid, grid: obstacleGrid(solid, MW, MH), critters, windmill, shoreY, boat: { x: 60 }, base, top, mudPix, watPix, starPix, rail,
    grow: growing.length ? { sd, at: def.grow, patches: growing } : null,
    washC: hasWash ? { x: wp.x, y: wp.y, tg: tan[wi], nm: nrm[wi] } : null, dist, near, showers, pier, piles, stone: stoneMask, bridges, lights, mixer, cemPix, hoses, tight, ...special,
    // Cup 3 building blocks (see trackfx.js): ramps to jump from, stretches that push the cars, where a second way runs beside the road
    jumps: (decorMap && special[decorMap.flag] || {}).jumps || ramps, pushes: (decorMap && special[decorMap.flag] || {}).pushes || [], alt: (decorMap && special[decorMap.flag] || {}).alt || null };
}


// ---------- the tracks: built when they are needed ----------
// TRACKS holds one light entry per track from the start (name, def, theme). The heavy part (terrain, distance field, pictures,
// obstacles) is built by buildTrack in slices while a menu is shown (idle.js), or at once when a race needs it, and is merged
// into the same object, so G.T === TRACKS[i] keeps working. A built track leaves a small preview picture for the menus.
// Only the KEEP most recently raced tracks keep their heavy data (several MB each, more on bigger maps); the others let it go
// and are built again when they are raced next (the build is deterministic, the track comes out the same).

const KEEP = 2, LIGHT = new Set(['def', 'ti', 'name', 'th', 'W', 'H', 'built', 'job', 'progress', 'used', 'preview', 'shape']);
let clock = 0;

/** @type {Array<Record<string, any>>} */
export const TRACKS = TRACK_DEFS.map((def, ti) => ({ def, ti, name: def.name, th: THEMES[def.theme], W: def.W || WW, H: def.H || WH, built: false, job: null, progress: 0, used: 0, preview: null, shape: null }));

// one more slice of the build, until the clock (performance.now()) reaches `until`; true when the track is built
export function stepTrack(T, until) {
  if (T.built) return true;
  T.job = T.job || buildTrack(T.def, T.ti);
  for (;;) {
    const s = T.job.next();
    if (s.done) { finishTrack(T, s.value); return true; }
    if (s.value !== undefined) T.progress = s.value; // the map modules (ringmap.js ...) pause without a number
    if (performance.now() >= until) return false;
  }
}

// the track is needed now (a race): built at once if it is not, and it counts as just used
export function ensureTrack(T) { useTrack(T); stepTrack(T, Infinity); return T; }

// tracks that are used last are the ones that keep their data
export function useTrack(T) { T.used = ++clock; }

function finishTrack(T, data) {
  Object.assign(T, data); T.built = true; T.job = null; T.progress = 1;
  T.preview = makePreview(T); T.shape = null;
  trimTracks();
}

// let go of the heavy data of all but the KEEP most recently used tracks; the track of the current race (G.T) always stays
export function trimTracks() {
  const cur = TRACKS.includes(G.T) && G.T.built, built = TRACKS.filter(T => T.built && T !== G.T).sort((a, b) => b.used - a.used);
  for (const T of built.slice(cur ? KEEP - 1 : KEEP)) releaseTrack(T);
}

function releaseTrack(T) { for (const k of Object.keys(T)) if (!LIGHT.has(k)) delete T[k]; T.built = false; }

// the menu picture of a track: the whole map at screen size (VW x VH), smoothed once (no pixel noise when it is shrunk)
function makePreview(T) {
  const c = mk(VW, VH), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(T.base, 0, 0, T.W, T.H, 0, 0, VW, VH); g.drawImage(T.top, 0, 0, T.W, T.H, 0, 0, VW, VH);
  return c;
}

// what the menus show of a track: its preview, or while it is not built yet its ground colour and the shape of the road
export function trackPicture(T) {
  if (T.preview) return T.preview;
  if (!T.shape) {
    const c = mk(VW, VH), g = c.getContext('2d'), th = T.th, { path } = centreLine(T.def), s = VW / T.W, sy = VH / T.H;
    g.fillStyle = th.grass[0]; g.fillRect(0, 0, VW, VH);
    g.lineJoin = 'round'; g.beginPath(); path.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, p.x * s, p.y * sy)); g.closePath();
    g.strokeStyle = th.trackEdge; g.lineWidth = (HALF + 2) * 2 * s; g.stroke();
    g.strokeStyle = th.track[0]; g.lineWidth = (HALF - 2) * 2 * s; g.stroke();
    T.shape = c;
  }
  return T.shape;
}

// the tyre tracks and mud splashes of the race: a tiled layer as big as the world (layer.js; sized per race in race.js resetWorld)
export const tctx = new TiledLayer(WW, WH);
