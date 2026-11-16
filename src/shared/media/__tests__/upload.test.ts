import { describe, expect, it } from 'vitest';
import { fitWithin, sha256Hex } from '../upload';

describe('media upload helpers', () => {
  it('fits a picture inside the box without upscaling', () => {
    expect(fitWithin(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitWithin(0, 600)).toEqual({ w: 0, h: 0 });
  });

  it('hashes bytes as lowercase hex SHA-256', async () => {
    const buf = new TextEncoder().encode('abc').buffer as ArrayBuffer;
    expect(await sha256Hex(buf)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
