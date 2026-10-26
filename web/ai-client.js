/* Network transport: same-origin personal backend only. No provider API key here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WritingAI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function id() {return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'s-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
  function createClient({fetchImpl=(...args)=>fetch(...args),timeoutMs=40000}={}) {
    let pending=null;
    return {
      cancel(){if(pending)pending.abort();},
      async status(){const r=await fetchImpl('/api/status',{credentials:'omit',cache:'no-store'});if(!r.ok)throw new Error('Backend unavailable');return r.json();},
      async review({text,promptId,submissionId,token}) {
        if(pending)throw new Error('Проверка уже идёт.');
        if(!token)throw new Error('Сначала укажи токен локального сервера в подключении ИИ.');
        if(token.startsWith('sk-'))throw new Error('Здесь нужен токен сервера, а не API-ключ OpenAI.');
        const controller=new AbortController();pending=controller;let timedOut=false;
        const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
        try {
          const r=await fetchImpl('/api/writing/review',{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal,
            headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({text,prompt_id:promptId,submission_id:submissionId,consent:true})});
          let body;try{body=await r.json();}catch(_){throw new Error('Сервер вернул непонятный ответ. Локальная проверка доступна.');}
          if(!r.ok)throw new Error(body?.error?.message||'Не удалось проверить текст.');
          if(body.schema_version!=='1.0'||body.source!=='openai'||body.submission_id!==submissionId)throw new Error('Ответ не соответствует отправленному тексту.');
          return body;
        } catch(e) {
          if(controller.signal.aborted)throw new Error(timedOut?'Сервис не ответил вовремя. Текст сохранён.':'Ожидание отменено. Уже отправленный запрос может завершиться на сервере.');
          if(e instanceof TypeError)throw new Error('Нет соединения с сервером. Текст сохранён; локальная самопроверка доступна.');
          throw e;
        } finally {clearTimeout(timer);if(pending===controller)pending=null;}
      }
    };
  }
  return {id,createClient};
});
