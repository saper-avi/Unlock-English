'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const F=require('../web/feedback.js');
const {AppError,openAIReview}=require('./provider.cjs');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
class Budget {
  constructor(file, limit=20, now=()=>Date.now()) {this.file=file;this.limit=limit;this.now=now;this.data={day:'',attempts:0};
    if(file&&fs.existsSync(file)) {
      try {this.data=JSON.parse(fs.readFileSync(file,'utf8'));if(typeof this.data.day!=='string'||!Number.isInteger(this.data.attempts)||this.data.attempts<0)throw new Error();}
      catch(_){throw new Error('Cannot read local quota ledger. Inspect .local/budget.json; do not silently reset it.');}
    }
  }
  reserve() {
    const day=new Date(this.now()).toISOString().slice(0,10);
    if(this.data.day!==day)this.data={day,attempts:0};
    if(this.data.attempts>=this.limit)throw new AppError(429,'daily_limit','Дневной лимит ИИ-проверок исчерпан. Локальные задания работают.',60);
    this.data.attempts++;
    if(this.file) {
      try {
        fs.mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
        fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.data),{mode:0o600});
        fs.renameSync(this.file+'.tmp',this.file);
      }catch(_){throw new AppError(503,'quota_storage','Не удалось сохранить счётчик запросов. Платная проверка не запущена.');}
    }
  }
}
class ReviewService {
  constructor({content,config,provider=openAIReview,now=()=>Date.now(),budget}) {
    this.content=content;this.config=config;this.provider=provider;this.now=now;
    this.budget=budget||new Budget(config.budgetFile,config.dailyLimit||20,now);
    this.cache=new Map();this.ids=new Map();this.pending=new Map();this.timestamps=[];
  }
  validate(body) {
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='consent,prompt_id,submission_id,text')throw new AppError(400,'invalid_request','Неверный формат запроса.');
    if(body.consent!==true)throw new AppError(400,'consent_required','Перед отправкой нужно согласие на передачу текста.');
    if(typeof body.submission_id!=='string'||!/^[-A-Za-z0-9_]{8,80}$/.test(body.submission_id))throw new AppError(400,'invalid_id','Неверный идентификатор отправки.');
    const prompt=this.content.prompts.find(p=>p.id===body.prompt_id);
    if(!prompt)throw new AppError(400,'invalid_prompt','Тема не найдена.');
    if(typeof body.text!=='string'||!body.text.trim()||body.text.length>5000)throw new AppError(400,'invalid_text','Нужно от 1 до 5000 символов текста.');
    if((body.text.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)||[]).length<5)throw new AppError(400,'insufficient_text','Напиши хотя бы пять английских слов для ИИ-проверки.');
    return {...body,prompt,level:prompt.level};
  }
  async review(body) {
    const input=this.validate(body);
    if(!this.config.enabled||!this.config.apiKey||!this.config.model)throw new AppError(503,'ai_not_configured','ИИ ещё не подключён на сервере. Используй локальную самопроверку или демо.');
    const now=this.now();
    for(const [k,v] of this.cache)if(now-v.at>1800000)this.cache.delete(k);
    // No essay content on disk. Idempotency/cache live only for this server process.
    const fingerprint=digest(JSON.stringify([F.PROMPT_VERSION,this.config.model,input.level,input.prompt.id,input.text]));
    const prior=this.ids.get(input.submission_id);
    if(prior&&prior!==fingerprint)throw new AppError(409,'submission_conflict','Этот идентификатор уже использован для другого текста. Открой тему заново.');
    this.ids.set(input.submission_id,fingerprint);
    if(this.ids.size>1000)this.ids.delete(this.ids.keys().next().value);
    const cached=this.cache.get(fingerprint);
    if(cached)return this.envelope(cached.feedback,input.submission_id,true);
    if(this.pending.has(fingerprint))return this.envelope(await this.pending.get(fingerprint),input.submission_id,true);
    if(this.pending.size>=1)throw new AppError(429,'busy','Другая проверка ещё выполняется. Дождись результата.',5);
    this.timestamps=this.timestamps.filter(t=>now-t<60000);
    if(this.timestamps.length>=(this.config.perMinute||5))throw new AppError(429,'rate_limit','Слишком много проверок подряд. Сделай небольшую паузу.',60);
    this.budget.reserve();this.timestamps.push(now);
    const job=Promise.resolve().then(()=>this.provider(input,this.config)).then(result=>F.validateFeedback(result,input.text));
    this.pending.set(fingerprint,job);
    try {
      const feedback=await job;
      this.cache.set(fingerprint,{feedback,at:this.now()});
      if(this.cache.size>32)this.cache.delete(this.cache.keys().next().value);
      return this.envelope(feedback,input.submission_id,false);
    }finally{this.pending.delete(fingerprint);}
  }
  envelope(feedback,id,cached) {return {schema_version:F.VERSION,submission_id:id,source:'openai',model:this.config.model,cached,checked_at:new Date(this.now()).toISOString(),feedback};}
}
module.exports={Budget,ReviewService};
