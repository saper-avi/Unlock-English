'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {ReviewService}=require('./service.cjs');
const {AppError}=require('./provider.cjs');
const ROOT=path.resolve(__dirname,'..');
const WEB=path.join(ROOT,'web');
function loadContent() {const context={window:{}};for(const name of ['content.js','book-tasks.js'])vm.runInNewContext(fs.readFileSync(path.join(WEB,name),'utf8'),context);return JSON.parse(JSON.stringify(context.window.LESSON_CONTENT));}
const digest=value=>crypto.createHash('sha256').update(String(value)).digest();
function authorized(header,token) {return typeof header==='string'&&header.startsWith('Bearer ')&&crypto.timingSafeEqual(digest(header.slice(7)),digest(token));}
function parseBody(req) {
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0;let finished=false;
    req.on('data',chunk=>{size+=chunk.length;if(size>32768){finished=true;reject(new AppError(413,'body_too_large','Текст запроса слишком большой.'));return;}if(!finished)chunks.push(chunk);});
    req.on('end',()=>{if(finished)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(_){reject(new AppError(400,'invalid_json','Неверный формат JSON.'));}});
    req.on('error',()=>reject(new AppError(400,'request_error','Запрос прерван.')));
  });
}
function createServer({config,content=loadContent(),service}={}) {
  if(!config||typeof config.accessToken!=='string'||config.accessToken.length<32)throw new Error('A local access token of at least 32 characters is required.');
  service=service||new ReviewService({content,config});
  const staticFiles=new Set(['index.html','style.css','content.js','core.js','feedback.js','ai-client.js','ux.js','motion.css','app.js','book.css','book-content.js','book-pages.js','book-tasks.js','book-core.js','book-speech.js','book-ui.js']);
  function json(res,status,data,extra={}) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(data));}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    try {
      const port=server.address()?.port;
      const hosts=new Set(['127.0.0.1:'+port,'localhost:'+port]);
      if(!hosts.has(req.headers.host))throw new AppError(403,'invalid_host','Этот сервер работает только локально.');
      const origin=req.headers.origin;
      if(origin&&!new Set([...hosts].map(h=>'http://'+h)).has(origin))throw new AppError(403,'invalid_origin','Запрос из другого источника запрещён.');
      const url=new URL(req.url,'http://'+req.headers.host);
      if(url.pathname==='/api/status'&&req.method==='GET') {
        json(res,200,{version:'0.4.0',ai_configured:Boolean(config.enabled&&config.apiKey&&config.model),mode:'personal-local',authentication:'bearer'});return;
      }
      if(url.pathname==='/api/writing/review') {
        if(req.method!=='POST'){json(res,405,{error:{code:'method_not_allowed',message:'Нужен POST-запрос.'}},{Allow:'POST'});return;}
        if(!authorized(req.headers.authorization,config.accessToken))throw new AppError(401,'unauthorized','Нужен токен локального сервера — не API-ключ OpenAI. Открой «Подключение ИИ».');
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new AppError(415,'content_type','Нужен Content-Type: application/json.');
        const result=await service.review(await parseBody(req));json(res,200,result);return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:{message:'Method not allowed'}},{Allow:'GET, HEAD'});return;}
      if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const pageAsset=/^books\/(?:pre|int)\/\d{3}\.webp$/.test(name)&&Number(name.slice(-8,-5))>=1&&Number(name.slice(-8,-5))<=166;
      if(!staticFiles.has(name)&&!pageAsset){json(res,404,{error:{message:'Not found'}});return;}
      const data=fs.readFileSync(path.join(WEB,name));
      const type=pageAsset?'image/webp':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript';
      res.writeHead(200,{'Content-Type':type+(pageAsset?'':'; charset=utf-8')});res.end(req.method==='HEAD'?undefined:data);
    } catch(e) {
      if(res.destroyed)return;
      const known=e instanceof AppError;
      json(res,known?e.status:500,{error:{code:known?e.code:'server_error',message:known?e.message:'Ошибка сервера. Текст сохранён; локальные задания доступны.'}},known&&e.retryAfter?{'Retry-After':String(e.retryAfter)}:{});
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;
  return server;
}
function getToken(dir) {
  if(process.env.APP_ACCESS_TOKEN)return process.env.APP_ACCESS_TOKEN;
  const file=path.join(dir,'access-token.txt');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  if(!fs.existsSync(file))fs.writeFileSync(file,crypto.randomBytes(32).toString('base64url'),{mode:0o600,flag:'wx'});
  return fs.readFileSync(file,'utf8').trim();
}
function positive(value,fallback,max) {const n=value===undefined||value===''?fallback:Number(value);if(!Number.isInteger(n)||n<1||n>max)throw new Error('Invalid numeric configuration');return n;}
function start() {
  const env=path.join(ROOT,'.env');if(fs.existsSync(env))process.loadEnvFile(env);
  const local=path.join(ROOT,'.local');
  const config={accessToken:getToken(local),enabled:process.env.AI_ENABLED==='true',apiKey:process.env.OPENAI_API_KEY||'',model:process.env.OPENAI_MODEL||'',reasoningEffort:process.env.OPENAI_REASONING_EFFORT||'',
    timeoutMs:positive(process.env.AI_TIMEOUT_MS,35000,90000),maxOutputTokens:positive(process.env.AI_MAX_OUTPUT_TOKENS,3000,6000),
    perMinute:positive(process.env.AI_PER_MINUTE,5,60),dailyLimit:positive(process.env.AI_DAILY_LIMIT,20,500),budgetFile:path.join(local,'budget.json')};
  const port=positive(process.env.PORT,4173,65535);
  const server=createServer({config});
  server.on('error',()=>{console.error('Cannot start local server. Check port and configuration.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    console.log(`Unlock English 0.4.0: http://127.0.0.1:${port}`);
    console.log('AI: '+(config.enabled&&config.apiKey&&config.model?'enabled (provider calls cost money)':'OFF — local learning and fixed demo only'));
    console.log('Local access token: '+config.accessToken);
    console.log('Enter this token in the app’s AI settings. It is NOT an OpenAI API key. Do not share it.');
  });
}
if(require.main===module){try{start();}catch(_){console.error('Invalid server configuration. Check .env, token and .local files. No provider request was made.');process.exitCode=1;}}
module.exports={createServer,authorized,loadContent};
