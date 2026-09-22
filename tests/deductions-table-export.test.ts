import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { prioritizeMatchingDeductions, deductionsNote } from '../src/app/lib/utils/deductions-display';
import { buildTableWorksheet, registerTableExport } from '../src/app/lib/utils/table-excel';
import { buildHierarchicalWorkbook } from '../src/app/lib/utils/excel-export';
import { resolveDeductionsSheetSource } from '../src/app/lib/utils/deductions-sheet-source';
import { applyTransactionReferenceSync } from '../src/app/lib/utils/transaction-reference-sync';

test('same normalized name and absolute payment are prioritized without mutating or removing rows', () => {
 const rows=[{'Full name':'Other','TOTAL PAYMENT':1},{'Full name':' Trần Anh Khoa ','TOTAL PAYMENT':1415000},{'Full name':'TRAN  ANH KHOA','TOTAL PAYMENT':-1415000},{'Full name':'TRAN ANH KHOA','TOTAL PAYMENT':2},{'Full name':'','TOTAL PAYMENT':0}];
 const result=prioritizeMatchingDeductions(rows);
 assert.equal(result.length,5);
 assert.deepEqual(result.map(r=>r._matchingDeduction),[true,true,false,false,false]);
 assert.equal(result[0]['TOTAL PAYMENT'],1415000);
 assert.equal(result[1]['TOTAL PAYMENT'],-1415000);
 assert.equal(rows[0]['Full name'],'Other');
});
test('salary note uses the adjacent display value while source month keeps the original note',()=>{
 const row={Note:'Lương T3',_adjacentNote:'Chi tiết','Sheet Source':'Hold T2 + T3'};
 assert.equal(deductionsNote(row),'Chi tiết');
 assert.equal(resolveDeductionsSheetSource(row['Sheet Source'],row.Note).sheetSource,'Hold T3');
 assert.equal(row.Note,'Lương T3');
 assert.equal(deductionsNote({Note:'Lương T12'}),'');
 assert.equal(deductionsNote({Note:'Điều chỉnh lương'}),'Điều chỉnh lương');
});
test('Excel round trip keeps only table columns, preserves hidden columns, exact IDs and General numbers',()=>{
 const schema={columns:[{key:'ID Number',label:'ID NUMBER'},{key:'Full name',label:'FULL NAME'},{key:'TOTAL PAYMENT',label:'TOTAL PAYMENT',type:'currency'},{key:'Note',label:'NOTE'}],hiddenColumns:['Full name']};
 const rows=[{'ID Number':'123456789','Full name':'TRAN ANH KHOA','TOTAL PAYMENT':-1415000,Note:'Lương T3',_adjacentNote:'Chi tiết',_transactionReferenceAudit:{oldValue:'wrong'},Extra:'must not export'}];
 const ws=buildTableWorksheet(rows,schema);
 assert.equal(ws['!ref'],'A1:D2');
 assert.equal(ws.C2.z,'General');
 const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Deductions');
 const restored=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer',cellStyles:true,cellNF:true}).Sheets.Deductions;
 assert.equal(restored['!cols']?.[1].hidden,true);
 assert.equal(restored.C2.v,-1415000);
 assert.equal(restored.C2.w,'-1415000');
 assert.equal(restored.A2.v,'123456789');
 assert.equal(restored.D2.v,'Chi tiết');
});
test('whole-page export respects explicit columns instead of adding row fields',()=>{
 const wb=buildHierarchicalWorkbook({title:'Test',fileName:'test.xlsx',pages:[{title:'Table',table:{headers:['Name','Amount'],rows:[{Name:'A',Amount:1415000,Extra:'hidden logic',_id:'private'}]}}]});
 const ws=wb.Sheets.Table;
 assert.equal(ws['!ref'],'A1:B5');
 assert.equal(ws.B5.z,'General');
});
test('Deductions sync updates authoritative ID and becomes a no-op without modifying Gross Pay',()=>{
 const row={'Tháng báo cáo':'03.2026','ID Number':'WRONG','Full name':'TRAN ANH KHOA','Bank Account Number':'123','TOTAL PAYMENT':10};
 const args={targetTable:'Hold_AE' as const,reportMonth:'03.2026',grossRows:[{...row}],deductionRows:[{...row}],transactionRows:[{'Tháng báo cáo':'03.2026','Document ID':'123456789','Beneficiary Name':'TRAN ANH KHOA','Beneficiary Account No.':'123','Payment Amount':20}]};
 const result=applyTransactionReferenceSync(args);
 assert.equal(result.correctedCells,1);
 assert.equal(result.deductionRows[0]['ID Number'],'123456789');
 assert.equal(result.grossRows[0]['ID Number'],'WRONG');
 const next=applyTransactionReferenceSync({...args,grossRows:result.grossRows,deductionRows:result.deductionRows,transactionRows:result.transactionRows});
 assert.equal(next.correctedCells,0);
});
test('whole-page export uses live table columns and keeps hidden columns without internal metadata',()=>{
 const unregister=registerTableExport('deductions-test',()=>({schema:{columns:[{key:'Full name',label:'FULL NAME'},{key:'TOTAL PAYMENT',label:'TOTAL PAYMENT',type:'currency'}],hiddenColumns:['Full name']},rows:[{'Full name':'TRAN ANH KHOA','TOTAL PAYMENT':1415000,_trace:'private'}]}));
 try {
  const wb=buildHierarchicalWorkbook({title:'Page',fileName:'page.xlsx',pages:[{title:'Deductions',table:{storageKey:'deductions-test',headers:['unrelated'],rows:[{unrelated:'old',extra:'private'}]}}]});
  const ws=wb.Sheets.Deductions;
  assert.equal(ws.A4.v,'FULL NAME');assert.equal(ws.B4.v,'TOTAL PAYMENT');
  assert.equal(ws.A5.v,'TRAN ANH KHOA');assert.equal(ws.B5.v,1415000);
  assert.equal(ws['!cols']?.[0].hidden,true);assert.equal(ws['!ref'],'A1:B5');
 } finally { unregister(); }
});
