import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_APP_DATA } from '../src/app/constants/initial-data';
import { createClearedWebData } from '../src/app/lib/utils/data-clear-scopes';
import { trackTableOriginals, restoreTableOriginals, grossPayRowVisible, sourceRowIndex } from '../src/app/lib/utils/table-originals';

const source = () => ({ ...structuredClone(INITIAL_APP_DATA),
  Sheet1_AE: { headers: ['ID Number', 'TOTAL PAYMENT'], data: [
    { id: 'jan', 'ID Number': '001', 'Tháng báo cáo': '01.2026', 'TOTAL PAYMENT': 10 },
    { id: 'feb', 'ID Number': '002', 'Tháng báo cáo': '02.2026', 'TOTAL PAYMENT': 20 },
  ] },
});

test('Gross Pay draft is visible with blank identity, imported blank identity is excluded', () => {
  assert.equal(grossPayRowVisible({ _isNew: true, 'ID Number': '' }), true);
  assert.equal(grossPayRowVisible({ 'ID Number': ' ' }), false);
  assert.equal(grossPayRowVisible({ 'ID Number': '000123' }), true);
});
test('month-filtered row resolves to source index and id-less rows cannot match arbitrary blanks', () => {
  const rows = source().Sheet1_AE.data;
  assert.equal(sourceRowIndex(rows, { ...rows[1] }), 1);
  assert.equal(sourceRowIndex(rows, { _originalIndex: 1 }), 1);
  assert.equal(sourceRowIndex(rows, { id: 'missing', _originalIndex: 0 }), -1);
  assert.equal(sourceRowIndex([{}, {}], {}), -1);
});
test('restore recovers edited/deleted rows and removes inserted rows without touching other tables', () => {
  const base = source();
  const edited = trackTableOriginals(base, { ...base, Sheet1_AE: { ...base.Sheet1_AE, data: [
    { ...base.Sheet1_AE.data[1], 'TOTAL PAYMENT': 999 },
    { id: 'custom', _isNew: true },
  ] } }, true);
  const restored = restoreTableOriginals(edited, ['Sheet1_AE']);
  assert.deepEqual(restored.Sheet1_AE, base.Sheet1_AE);
  assert.equal(restored.BankExport, edited.BankExport);
  assert.equal(restored.Hold_AE, edited.Hold_AE);
  restored.Sheet1_AE.data[0]['TOTAL PAYMENT'] = 2000;
  assert.equal(edited.TableOriginals!.Sheet1_AE!.data[0]['TOTAL PAYMENT'], 10);
});
test('multiple edits and reload keep the first snapshot', () => {
  const base = source();
  const first = trackTableOriginals(base, { ...base, Sheet1_AE: { headers: [], data: [] } }, true);
  const reloaded = structuredClone(first);
  const second = trackTableOriginals(reloaded, { ...reloaded, Sheet1_AE: { headers: ['x'], data: [{ x: 1 }] } }, true);
  assert.deepEqual(restoreTableOriginals(second, ['Sheet1_AE']).Sheet1_AE, base.Sheet1_AE);
});
test('explicit source import replaces stale baseline with freshly parsed data', () => {
  const base = source();
  const edited = trackTableOriginals(base, { ...base, Sheet1_AE: { headers: [], data: [] } }, true);
  const fresh = { headers: ['ID Number'], data: [{ 'ID Number': '003' }] };
  const imported = trackTableOriginals(edited, { ...edited, Sheet1_AE: fresh }, false, ['Sheet1_AE']);
  assert.deepEqual(restoreTableOriginals(imported, ['Sheet1_AE']).Sheet1_AE, fresh);
});
test('missing baseline fails explicitly; recomputation never invents an original', () => {
  const base = source();
  assert.throws(() => restoreTableOriginals(base, ['Sheet1_AE']), /Chưa có bản gốc/);
  const calculated = trackTableOriginals(base, { ...base, Sheet1_AE: { ...base.Sheet1_AE } }, false);
  assert.equal(calculated.TableOriginals, undefined);
});
test('global deletion does not retain payroll in original snapshots', () => {
  const base = source();
  const edited = trackTableOriginals(base, { ...base, Sheet1_AE: { headers: [], data: [] } }, true);
  const cleared = trackTableOriginals(edited, createClearedWebData(edited), true);
  assert.deepEqual(cleared.TableOriginals, {});
  assert.throws(() => restoreTableOriginals(cleared, ['Sheet1_AE']), /Chưa có bản gốc/);
});
