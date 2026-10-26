// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { addHistory, listHistory, loadSettings, saveSettings, saveReport, listReports, DEFAULT_SETTINGS } from '../src/lib/storage/repos';
import { clearAll, dumpAll, put, get } from '../src/lib/storage/db';
import { toCSV } from '../src/lib/export';

describe('armazenamento local', () => {
  it('configurações persistem e completam padrões', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ ...DEFAULT_SETTINGS, intro: false });
    expect((await loadSettings()).intro).toBe(false);
  });

  it('histórico em ordem decrescente e relatório vinculado', async () => {
    const r = await saveReport({ kind: 'analise', title: 't', totals: { arquivos: 2 }, rows: [], limitations: [], source: 'teste' });
    await addHistory({ type: 'analise', title: 'a', files: 1, bytes: 1, durationMs: 1, result: 'sucesso', notes: [], at: 1000 });
    await addHistory({ type: 'duplicados', title: 'b', files: 2, bytes: 2, durationMs: 1, result: 'parcial', notes: ['x'], reportId: r.id, at: 2000 });
    const h = await listHistory();
    expect(h.map((x) => x.title)).toEqual(['b', 'a']);
    expect((await listReports())[0].id).toBe(h[0].reportId);
  });

  it('personagem salvo é restaurado igual', async () => {
    await put('characters', { id: 'c1', name: 'Vigia', config: { a: 1 } });
    expect(await get('characters', 'c1')).toEqual({ id: 'c1', name: 'Vigia', config: { a: 1 } });
  });

  it('apagar tudo zera todos os stores', async () => {
    await clearAll();
    const d = await dumpAll();
    expect(Object.values(d).every((v) => v.length === 0)).toBe(true);
  });
});

describe('CSV', () => {
  it('escapa separador, aspas e quebra de linha', () => {
    const csv = toCSV([{ nome: 'a;b', obs: 'diz "oi"', n: 3 }, { nome: 'linha\nnova', obs: '', n: 0 }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"a;b";"diz ""oi""";3');
    expect(csv).toContain('"linha\nnova";;0');
  });
});
