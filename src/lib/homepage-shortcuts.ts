export const homepageShortcutIds=['add-subscriber','subscribers','profiles','servers'] as const;
export type HomepageShortcutId=typeof homepageShortcutIds[number];
export type HomepageShortcut={id:HomepageShortcutId;enabled:boolean};
export const defaultHomepageShortcuts:HomepageShortcut[]=homepageShortcutIds.map(id=>({id,enabled:true}));
export function normalizeHomepageShortcuts(input:unknown):HomepageShortcut[]{
 const result:HomepageShortcut[]=[];
 if(Array.isArray(input))for(const entry of input){if(entry&&homepageShortcutIds.includes(entry.id)&&!result.some(item=>item.id===entry.id))result.push({id:entry.id,enabled:typeof entry.enabled==='boolean'?entry.enabled:true});}
 for(const id of homepageShortcutIds)if(!result.some(item=>item.id===id))result.push({id,enabled:true});
 return result;
}
