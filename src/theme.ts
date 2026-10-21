export type Theme='light'|'dark';
export type ThemeChoice='auto'|Theme;
export function resolveTheme(choice:ThemeChoice,host:Theme|undefined,systemDark:boolean):Theme{return choice==='auto'?(host??(systemDark?'dark':'light')):choice;}
export function bindTheme(root:HTMLElement,win:Window){
 const media=win.matchMedia?.('(prefers-color-scheme: dark)');let choice:ThemeChoice='auto';let host:Theme|undefined;
 const render=()=>{const theme=resolveTheme(choice,host,media?.matches??false);root.dataset.theme=theme;root.style.colorScheme=theme;};
 const change=()=>render();media?.addEventListener('change',change);render();
 return {choose(value:ThemeChoice){choice=value;render();},host(value:Theme|undefined){host=value;render();},dispose(){media?.removeEventListener('change',change);}};
}
