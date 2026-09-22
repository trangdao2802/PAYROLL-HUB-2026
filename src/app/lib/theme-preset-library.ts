import { ALL_TASTE_PRESETS, TASTE_PRESETS, getUserDefaultUiSettingsSync, type TastePreset } from './ui-settings';
const KEY = 'PayrollApp_DeletedTastePresets';
export function getVisibleTastePresets(): TastePreset[] {
  let deleted: string[] = [];
  try { deleted = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* use built-ins */ }
  const saved = getUserDefaultUiSettingsSync();
  return ALL_TASTE_PRESETS.filter(p => !deleted.includes(p.id)).map(p => ({
    ...p, ...TASTE_PRESETS[p.id],
    ...((p.id === 'default' || p.id === saved?.preset) && saved ? saved : {}),
    id: p.id, name: p.name, tableRadius: '0px',
  }));
}
export function deleteTastePreset(id: string): void {
  if (getVisibleTastePresets().length <= 1) return;
  let deleted: string[] = [];
  try { deleted = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* start empty */ }
  localStorage.setItem(KEY, JSON.stringify([...new Set([...deleted, id])]));
  window.dispatchEvent(new Event('ui-user-default-changed'));
}
