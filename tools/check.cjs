'use strict';
const {spawnSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
for(const dir of ['web','backend','tools','tests'])for(const name of fs.readdirSync(dir)){if(!/\.(?:js|cjs)$/.test(name))continue;const p=path.join(dir,name);const r=spawnSync(process.execPath,['--check',p],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('JavaScript syntax checks passed.');
