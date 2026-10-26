/* Shared contract and local feedback state. No keys, network or Android permissions. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WritingFeedback = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const VERSION = '1.0';
  const PROMPT_VERSION = 'writing-2026-10-25-1';
  const TOPICS = {
    past_simple: 'Past Simple', present_simple: 'Present Simple',
    present_continuous: 'Present Continuous', present_perfect: 'Present Perfect',
    articles: 'Артикли', prepositions: 'Предлоги', agreement: 'Согласование',
    word_order: 'Порядок слов', vocabulary: 'Лексика', spelling: 'Правописание',
    punctuation: 'Пунктуация', coherence: 'Связность', task_response: 'Ответ на тему',
    conditionals: 'Условные предложения', comparatives: 'Сравнения', other: 'Другие темы'
  };
  const obj = properties => ({type:'object', properties, required:Object.keys(properties), additionalProperties:false});
  const string = {type:'string'};
  const nullableString = {type:['string','null']};
  const score = {type:['integer','null'], minimum:0, maximum:10};
  const MODEL_SCHEMA = obj({
    status:{type:'string', enum:['completed','insufficient_text','cannot_assess']},
    summary_ru:string,
    corrected_text:nullableString,
    errors:{type:'array', items:obj({sentence_id:string, original_fragment:string, replacement:string,
      category:{type:'string',enum:Object.keys(TOPICS)}, explanation_ru:string, example_en:nullableString})},
    suggestions:{type:'array',items:obj({original_fragment:string,suggestion:string,explanation_ru:string})},
    scores:{anyOf:[obj({grammar:score,vocabulary:score,coherence:score,task_response:score}),{type:'null'}]},
    priority_topics:{type:'array',items:{type:'string',enum:Object.keys(TOPICS)}},
    warnings_ru:{type:'array',items:string}
  });
  function validateSchema(value, schema, path='$') {
    if (schema.anyOf) {
      if (!schema.anyOf.some(s => { try {validateSchema(value,s,path);return true;}catch(_){return false;} })) throw new Error(path+': unexpected value');
      return;
    }
    const types=Array.isArray(schema.type)?schema.type:[schema.type];
    const matches=t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):t==='integer'?Number.isInteger(value):typeof value===t;
    if (!types.some(matches)) throw new Error(path+': unexpected type');
    if (schema.enum&&!schema.enum.includes(value)) throw new Error(path+': unsupported value');
    if (typeof value==='number'&&(value<schema.minimum||value>schema.maximum)) throw new Error(path+': out of range');
    if (value===null) return;
    if (Array.isArray(value)) { if(value.length>40)throw new Error(path+': too many items');value.forEach((v,i)=>validateSchema(v,schema.items,path+'['+i+']')); }
    else if (typeof value==='object') {
      for(const k of schema.required||[])if(!Object.prototype.hasOwnProperty.call(value,k))throw new Error(path+': missing '+k);
      for(const k of Object.keys(value)) {if(!schema.properties[k])throw new Error(path+': unexpected field');validateSchema(value[k],schema.properties[k],path+'.'+k);}
    } else if(typeof value==='string'&&value.length>12000)throw new Error(path+': text too long');
  }
  // Stable, deterministic segments; not a linguistic sentence parser. IDs avoid model-made offsets.
  function sentences(text) {
    const out=[];
    const re=/[^.!?\n]+(?:[.!?]+|(?=\n)|$)/g;
    let m;
    while((m=re.exec(text))) {
      const trimmed=m[0].trim();
      if(trimmed) out.push({id:'s'+(out.length+1), text:trimmed, start:m.index+m[0].indexOf(trimmed)});
    }
    return out;
  }
  function validateFeedback(result, text) {
    validateSchema(result, MODEL_SCHEMA);
    if(!result.summary_ru.trim()||result.summary_ru.length>1800)throw new Error('Invalid summary');
    if(result.errors.length>16||result.suggestions.length>6||result.priority_topics.length>5||result.warnings_ru.length>5)throw new Error('Feedback too long');
    const parts=new Map(sentences(text).map(s=>[s.id,s.text]));
    const seen=new Set();
    for(const e of result.errors) {
      if(!e.original_fragment.trim()||!parts.get(e.sentence_id)?.includes(e.original_fragment))throw new Error('Correction fragment is not in the source sentence');
      if(e.original_fragment===e.replacement||!e.explanation_ru.trim()||e.explanation_ru.length>1000)throw new Error('Invalid correction');
      const key=e.sentence_id+'\u0000'+e.original_fragment;
      if(seen.has(key))throw new Error('Duplicate correction');seen.add(key);
    }
    for(const s of result.suggestions)if(!s.original_fragment.trim()||!text.includes(s.original_fragment)||!s.suggestion.trim()||!s.explanation_ru.trim())throw new Error('Invalid suggestion fragment');
    if(result.status==='completed'&&(!result.corrected_text||!result.corrected_text.trim()))throw new Error('Missing corrected text');
    if(result.status!=='completed'&&(result.scores!==null||result.errors.length||result.corrected_text!==null||result.suggestions.length||result.priority_topics.length))throw new Error('Unassessed text must not have grades or corrections');
    return result;
  }
  function emptyState() {return {version:1, reviews:[], priorityTopics:[]};}
  function restore(raw) {
    const base=emptyState();
    if(!raw||raw.version!==1||!Array.isArray(raw.reviews))return base;
    for(const r of raw.reviews.slice(0,50)) {
      try {
        if(typeof r.id!=='string'||typeof r.text!=='string'||r.text.length>5000||typeof r.promptId!=='string'||!['A1','A2','B1','B2'].includes(r.level)||typeof r.createdAt!=='number'||!Number.isFinite(r.createdAt))continue;
        validateFeedback(r.feedback,r.text);
        base.reviews.push({id:r.id,promptId:r.promptId,level:r.level,text:r.text,createdAt:r.createdAt,feedback:r.feedback});
      } catch(_) { /* Ignore corrupt imported entries, never execute or apply them. */ }
    }
    base.priorityTopics=[...new Set(base.reviews.filter(r=>r.feedback.status==='completed').slice(0,10).flatMap(r=>r.feedback.priority_topics))].slice(0,12);
    return base;
  }
  function storeReview(raw, record) {
    const state=restore(raw);
    validateFeedback(record.feedback,record.text);
    const existing=state.reviews.find(r=>r.promptId===record.promptId&&r.text===record.text);
    if(existing)return state;
    state.reviews.unshift(record);
    return restore(state);
  }
  function findReview(raw,promptId,text) {return (raw?.reviews||[]).find(r=>r.promptId===promptId&&r.text===text)||null;}
  const MATCH = {
    past_simple:/past simple|прошедш/, present_simple:/present simple/,
    present_continuous:/present continuous/,present_perfect:/present perfect/,
    articles:/article|артикл/,prepositions:/preposition|предлог/,
    agreement:/present simple|согласован/,word_order:/word order|порядок|question|вопрос/,
    conditionals:/conditional|условн/,comparatives:/comparative|superlative|сравнен/,
    vocabulary:/vocabulary|collocation|word choice|лексик|слов|phrasal/,
    spelling:/spelling|правописан/,punctuation:/punctuation|пунктуац/,
    coherence:/linking|connector|связ|reading|чтени/,task_response:/reading|чтени/
  };
  function recommendations(raw, questions, level) {
    const topics=restore(raw).priorityTopics;
    return questions.filter(q=>q.level===level&&topics.some(t=>MATCH[t]?.test((q.topic||'').toLowerCase().replace(/[-_]/g,' ')))).slice(0,8);
  }
  const SAMPLE = 'Yesterday I go to university and meet my friend. We discussed our project in the library. I enjoyed the conversation because we found a useful idea for our presentation.';
  function demo() {
    return {text:SAMPLE, feedback:{status:'completed',summary_ru:'Мысль понятна. В первом предложении два глагола нужно поставить в прошедшее время.',
      corrected_text:'Yesterday I went to university and met my friend. We discussed our project in the library. I enjoyed the conversation because we found a useful idea for our presentation.',
      errors:[{sentence_id:'s1',original_fragment:'go',replacement:'went',category:'past_simple',explanation_ru:'Yesterday указывает на завершённое событие в прошлом. Используй went — форму Past Simple глагола go.',example_en:'Yesterday I went to the library.'},
        {sentence_id:'s1',original_fragment:'meet',replacement:'met',category:'past_simple',explanation_ru:'Встреча тоже произошла вчера. Прошедшая форма meet — met.',example_en:'I met a friend after class.'}],
      suggestions:[],scores:null,priority_topics:['past_simple'],warnings_ru:['Демо на заранее подготовленном примере. Это не проверка твоего текста.']}};
  }
  return {VERSION,PROMPT_VERSION,TOPICS,MODEL_SCHEMA,validateSchema,sentences,validateFeedback,emptyState,restore,storeReview,findReview,recommendations,demo};
});
