import { MACHINE_TYPES } from '@zamindara/catalog';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The module itself requires .jpg files, which only Metro can load; check its source and the files instead.
describe('machine photos', () => {
  const source = readFileSync(join(__dirname, 'machinePhotos.ts'), 'utf8');
  it('every machine in the catalogue has a photo file and an entry', () => {
    for (const m of MACHINE_TYPES) {
      expect(existsSync(join(__dirname, '..', 'assets', 'machines', `${m.code}.jpg`)), m.code).toBe(true);
      expect(source).toContain(`${m.code}: require('../assets/machines/${m.code}.jpg')`);
    }
  });
});
