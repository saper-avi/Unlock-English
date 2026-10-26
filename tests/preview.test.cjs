'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const vm=require('node:vm');
const file=path.join(__dirname,'fixtures/Unlock-English-0.3-preview.html');
test('historical 0.3 regression fixture has seven ordered inline scripts with matching CSP hashes and no network permission',()=>{
  const html=fs.readFileSync(file,'utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(scripts.length,7);assert.match(scripts[0],/UNLOCK_OFFLINE_PREVIEW/);
  assert.match(html,/connect-src 'none'/);assert.equal(html.includes('<script defer src='),false);assert.equal(html.includes('href="style.css"'),false);
  for(const script of scripts){assert.ok(html.includes("'sha256-"+crypto.createHash('sha256').update(script).digest('base64')+"'"));assert.doesNotThrow(()=>new vm.Script(script));}
  assert.ok(html.indexOf('id="app"')<html.indexOf('<script>'));
});
test('default configuration leaves AI disabled and API key blank',()=>{
  const example=fs.readFileSync(path.join(__dirname,'../.env.example'),'utf8');
  assert.match(example,/^AI_ENABLED=false$/m);assert.match(example,/^OPENAI_API_KEY=$/m);
});
