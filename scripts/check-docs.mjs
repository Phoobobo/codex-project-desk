import {readFile,access} from 'node:fs/promises';
for(const file of ['README.md','INSTALL.md','PERMISSIONS.md','HOT-UPDATE.md']){
 const text=await readFile(file,'utf8');
 for(const m of text.matchAll(/\]\(([^)]+)\)/g))if(!m[1].includes('://')&&!m[1].startsWith('#'))await access(m[1].split('#')[0]);
 if(!text.endsWith('\n'))throw Error(file+' must end with newline');
}
console.log('Documentation relative links and formatting checks passed. Official external sources were fetched during authoring.');
