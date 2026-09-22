import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleTastePresets, deleteTastePreset } from '../src/app/lib/theme-preset-library';
import { USER_DEFAULT_UI_SETTINGS_KEY } from '../src/app/lib/ui-settings';
test('preset list retains saved colors and deletion across fresh reads', () => {
  const values = new Map<string,string>();
  const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:()=>true}});
  try {
    values.set(USER_DEFAULT_UI_SETTINGS_KEY+'_small',JSON.stringify({preset:'lila-rose',tableHeaderBg:'#c5d9e8',accent:'#123456',tableRadius:'20px'}));
    const initial=getVisibleTastePresets();
    assert.equal(initial.find(p=>p.id==='lila-rose')?.tableHeaderBg,'#c5d9e8');
    assert.equal(initial.find(p=>p.id==='default')?.accent,'#123456');
    assert.ok(initial.every(p=>p.tableRadius==='0px'));
    deleteTastePreset('ss26');
    assert.ok(!getVisibleTastePresets().some(p=>p.id==='ss26'));
    assert.equal(getVisibleTastePresets().length,initial.length-1);
  } finally {
    if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');
    if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
  }
});
