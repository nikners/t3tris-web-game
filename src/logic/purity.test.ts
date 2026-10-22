import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const logicDir = join(process.cwd(), 'src', 'logic');

function logicSourceFiles(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
}

describe('logic purity guard', () => {
  it('boots with a green smoke assertion', () => {
    expect(true).toBe(true);
  });

  it('never imports three and never touches the DOM', () => {
    const offenders: string[] = [];

    for (const file of logicSourceFiles(logicDir)) {
      const source = readFileSync(join(logicDir, file), 'utf8');

      if (/from\s+['"]three['"]/.test(source) || /require\(\s*['"]three['"]\s*\)/.test(source)) {
        offenders.push(file + ': imports three');
      }

      if (/\b(document|window|navigator|HTMLElement)\b/.test(source)) {
        offenders.push(file + ': references a DOM global');
      }
    }

    expect(offenders).toEqual([]);
  });
});
