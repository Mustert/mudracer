import { describe, expect, it } from 'vitest';

// a canvas stand-in that records what is drawn on it
globalThis.document = { getElementById: () => null, createElement: () => { const c = { width: 0, height: 0, calls: [] }; c.getContext = () => ({ canvas: c, fillRect: (...a) => c.calls.push(['fill', ...a]), clearRect: (...a) => c.calls.push(['clear', ...a]) }); return c; } };
const { TILE, TiledLayer } = await import('../src/layer.js');

describe('tiled layer (tyre tracks)', () => {
  it('makes tiles only where something is drawn, and draws into every tile a rectangle touches', () => {
    const L = new TiledLayer(1000, 600);
    expect(L.tiles.size).toBe(0);
    L.fillRect(TILE - 1, 10, 2, 2);
    expect(L.tiles.size).toBe(2);
    const [a, b] = [...L.tiles.values()];
    expect(a.canvas.calls[0]).toEqual(['fill', TILE - 1, 10, 2, 2]);
    expect(b.canvas.calls[0]).toEqual(['fill', -1, 10, 2, 2]);
  });
  it('rubbing out (destination-out) and clearing never make tiles; clearing everything drops them', () => {
    const L = new TiledLayer(1000, 600);
    L.globalCompositeOperation = 'destination-out'; L.fillRect(0, 0, 1000, 600);
    expect(L.tiles.size).toBe(0);
    L.globalCompositeOperation = 'source-over'; L.fillRect(5, 5, 1, 1); L.fillRect(900, 500, 1, 1);
    L.clearRect(0, 0, 10, 10);
    expect(L.tiles.size).toBe(2);
    L.clearRect(0, 0, 1000, 600);
    expect(L.tiles.size).toBe(0);
  });
  it('keeps at most `keep` tiles, the ones far from the view go first', () => {
    const L = new TiledLayer(480, 6400); L.keep = 4;
    for (let y = 0; y < 6400; y += TILE) L.fillRect(10, y + 5, 1, 1);
    L.draw({ drawImage: () => {} }, 0, 6400 - 270, 480, 270, 0, 0);
    expect(L.tiles.size).toBe(4);
    const rows = [...L.tiles.keys()].map(k => Math.floor(k / L.cols));
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(Math.floor(6400 / TILE) - 4);
  });
});
