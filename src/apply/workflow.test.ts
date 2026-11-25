import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SLOT_KEYS } from './input';
import venues from './venues.json';

const yml = readFileSync(new URL('../../.github/workflows/apply.yml', import.meta.url), 'utf8');

/** inputs: の直下にある入力名と、その入力の options（あれば）を取り出す */
function inputs(): Map<string, string[] | null> {
  const block = yml.split(/\n\s{4}inputs:\n/)[1]?.split(/\n\S/)[0] ?? '';
  const result = new Map<string, string[] | null>();
  for (const part of block.split(/\n(?= {6}\w+:)/)) {
    const name = part.match(/^ {6}(\w+):/m)?.[1];
    if (!name) continue;
    const options = part.match(/options:\s*\[(.*)\]/)?.[1];
    result.set(name, options === undefined ? null : options.split(',').map((o) => o.trim().replace(/^['"]|['"]$/g, '')));
  }
  return result;
}

describe('apply.yml', () => {
  it('会場の選択肢が venues.json と同じ', () => {
    const expected = ['なし', ...venues.venues.map((v) => v.name)];
    const found = inputs();
    for (const slot of SLOT_KEYS) expect(found.get(`${slot}_venue`), slot).toEqual(expected);
  });

  it('入力は月・6枠の会場と日付と受付開始・確認だけの20個（上限25個以内）', () => {
    const names = [...inputs().keys()];
    expect(names).toHaveLength(20);
    expect(names).toContain('month');
    expect(names).toContain('dry_run');
    for (const slot of SLOT_KEYS) {
      expect(names).toContain(`${slot}_date`);
      expect(names).toContain(`${slot}_reception`);
    }
  });
});
