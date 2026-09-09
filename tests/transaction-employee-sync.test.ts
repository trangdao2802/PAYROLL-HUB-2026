import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildTransactionEmployeeRecords, syncTransactionEmployeesToSupabase } from '../src/app/lib/utils/transaction-employee-sync';

test('Transaction rows map to the nhan_vien columns and skip conflicting identities', () => {
  const result = buildTransactionEmployeeRecords([
    {'Document ID': '0007', 'Beneficiary Name': 'Nguyễn Văn A', 'Beneficiary Account No.': '001234'},
    {'Document ID': '0007', 'Beneficiary Name': 'NGUYEN VAN A', 'Beneficiary Account No.': '001234'},
    {'Document ID': '0008', 'Beneficiary Name': 'Nguyễn Văn B', 'Beneficiary Account No.': '009999'},
    {'Document ID': '0008', 'Beneficiary Name': 'Nguyễn Văn C', 'Beneficiary Account No.': '009999'},
  ]);

  assert.deepEqual(result.records, [{ma_nv: '0007', ho_ten: 'Nguyễn Văn A', bank_number_acc: '001234'}]);
  assert.deepEqual(result.skippedDocumentIds, ['0008']);
});

test('employee sync accepts the legacy Full Name and bank account aliases', () => {
  assert.deepEqual(buildTransactionEmployeeRecords([
    {'ID Number': '0010', 'Full Name': 'Legacy Employee', 'Bank Account Number': '000123'},
  ]), {
    records: [{ma_nv: '0010', ho_ten: 'Legacy Employee', bank_number_acc: '000123'}],
    skippedDocumentIds: [],
  });
});

test('nhan_vien sync preserves an existing value when Transaction leaves that cell blank', async () => {
  const calls: unknown[][] = [];
  const existingRows = [{id: 'employee-1', ma_nv: '0007', ho_ten: 'Old Name', bank_number_acc: '009999'}];
  const client = {
    from(table: string) {
      assert.equal(table, 'nhan_vien');
      const query = {
        select(columns: string) { calls.push(['select', columns]); return query; },
        in(column: string, values: string[]) {
          calls.push(['in', column, values]);
          return query;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({data: existingRows, error: null}).then(resolve, reject);
        },
        upsert(rows: unknown[], options: unknown) {
          calls.push(['upsert', rows, options]);
          return Promise.resolve({error: null});
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;

  const result = await syncTransactionEmployeesToSupabase(client, [
    {'Document ID': '0007', 'Beneficiary Name': 'New Name', 'Beneficiary Account No.': ''},
    {'Document ID': '0009', 'Beneficiary Name': 'New Employee', 'Beneficiary Account No.': '001111'},
  ]);

  assert.deepEqual(result, {synced: 2, inserted: 1, updated: 1, skipped: 0, skippedDocumentIds: []});
  const upsert = calls.find(call => call[0] === 'upsert');
  assert.ok(upsert);
  assert.deepEqual(upsert[1], [
    {id: 'employee-1', ma_nv: '0007', ho_ten: 'New Name', bank_number_acc: '009999'},
    {ma_nv: '0009', ho_ten: 'New Employee', bank_number_acc: '001111'},
  ]);
  assert.deepEqual(upsert[2], {onConflict: 'ma_nv'});
});
