export const homepageShortcutIds=['add-subscriber','subscribers','profiles','servers','connected','disconnected','expired','pending','suspended','quota','hotspot-packages','hotspot-batches','hotspot-standalone','equipment','activity','data','subscription'] as const;
export type HomepageShortcutId=typeof homepageShortcutIds[number];
export type HomepageShortcut={id:HomepageShortcutId;enabled:boolean};
const initiallyEnabled:readonly HomepageShortcutId[]=['add-subscriber','subscribers','profiles','servers'];
export const defaultHomepageShortcuts:HomepageShortcut[]=homepageShortcutIds.map(id=>({id,enabled:initiallyEnabled.includes(id)}));
export function normalizeHomepageShortcuts(input:unknown):HomepageShortcut[]{
 const result:HomepageShortcut[]=[];
 if(Array.isArray(input))for(const entry of input){if(entry&&homepageShortcutIds.includes(entry.id)&&!result.some(item=>item.id===entry.id))result.push({id:entry.id,enabled:typeof entry.enabled==='boolean'?entry.enabled:initiallyEnabled.includes(entry.id)});}
 for(const item of defaultHomepageShortcuts)if(!result.some(entry=>entry.id===item.id))result.push({...item});
 return result;
}
