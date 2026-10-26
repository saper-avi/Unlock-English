/* Pure course logic. No microphone, network, DOM or effect can complete the daily lock mission. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BookCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const validId=id=>typeof id==='string'&&id.length>0&&id.length<140&&!['__proto__','constructor','prototype'].includes(id);
const DAY=86400000, INTERVALS=[10*60000,DAY,3*DAY,7*DAY,14*DAY,30*DAY];
const safeMap=x=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).filter(([k])=>!['__proto__','constructor','prototype'].includes(k))):{};
function fresh(){return{version:1,words:{},pages:{},notes:{},lastPages:{},rewards:{},attempts:[],speaking:[],customWords:[],speechConsent:false};}
function restore(raw){
 const b=fresh(),x=safeMap(raw);for(const key of ['words','pages','notes','lastPages','rewards']) b[key]=safeMap(x[key]);
 b.notes=Object.fromEntries(Object.entries(b.notes).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v.slice(0,12000)]));
 b.attempts=Array.isArray(x.attempts)?x.attempts.filter(v=>typeof v==='string').slice(-2000):[];
 b.speaking=Array.isArray(x.speaking)?x.speaking.filter(v=>v&&typeof v.text==='string'&&validId(v.id)).slice(0,100).map(v=>({...v,text:v.text.slice(0,2500)})):[];
 b.customWords=Array.isArray(x.customWords)?x.customWords.filter(v=>v&&validId(v.id)&&typeof v.en==='string'&&v.en.trim()&&typeof v.ru==='string'&&v.ru.trim()&&['pre','int'].includes(v.book)&&Number.isInteger(v.unit)&&v.unit>=1&&v.unit<=10).slice(0,3000).map(v=>({...v,en:v.en.slice(0,100),ru:v.ru.slice(0,200),translation:'user-authored',sourcePages:[Array.isArray(v.sourcePages)&&Number.isInteger(v.sourcePages[0])&&v.sourcePages[0]>=1&&v.sourcePages[0]<=166?v.sourcePages[0]:134+v.unit]})):[];
 b.speechConsent=x.speechConsent===true;return b;
}
function norm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[‘’ʼ]/g,"'").replace(/[^\p{L}\p{N}' -]/gu,' ').replace(/\s+/g,' ').trim();}
function recall(word,answer){const variants=[word.en,...(word.accepted||[])].map(norm);return variants.includes(norm(answer));}
function localDay(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
function record(st,id,correct,attempt,now=Date.now(),mode='recall'){
 if(!validId(id)||!attempt||st.attempts.includes(attempt))return false;
 st.attempts.push(attempt);st.attempts=st.attempts.slice(-2000);
 const old=safeMap(st.words[id]);const oldLevel=Number.isFinite(old.stage)?Math.max(0,Math.min(5,old.stage)):0;
 const stage=correct?Math.min(5,oldLevel+1):0;
 st.words[id]={stage,seen:(Number(old.seen)||0)+1,correct:(Number(old.correct)||0)+Number(correct),lapses:(Number(old.lapses)||0)+Number(!correct),last:now,due:now+INTERVALS[stage],mode};return true;
}
function due(st,words,now=Date.now()){return words.filter(w=>st.words[w.id]&&Number(st.words[w.id].due)<=now).sort((a,b)=>st.words[a.id].due-st.words[b.id].due);}
function pick(st,words,n=8,now=Date.now()){
 return words.slice().sort((a,b)=>{const x=st.words[a.id],y=st.words[b.id];const rank=v=>!v?1:(!Number.isFinite(v.due)||v.due<=now?0:2);return rank(x)-rank(y)||(x?.last||0)-(y?.last||0)||a.id.localeCompare(b.id);}).slice(0,n);
}
function shuffled(arr,random=Math.random){const r=arr.slice();for(let i=r.length-1;i>0;i--){let j=Math.floor(random()*(i+1));j=Math.max(0,Math.min(i,j));[r[i],r[j]]=[r[j],r[i]];}return r;}
function matching(words,random=Math.random,n=5){
 const unique=[];const en=new Set(),ru=new Set();for(const w of words){if(!en.has(norm(w.en))&&!ru.has(norm(w.ru))){unique.push(w);en.add(norm(w.en));ru.add(norm(w.ru));}if(unique.length===n)break;}
 return {left:shuffled(unique,random),right:shuffled(unique,random),matched:[],wrong:[],selectedLeft:null,selectedRight:null,finished:false};
}
function pair(m,left,right){if(m.finished||m.matched.includes(left)||m.matched.includes(right)||!m.left.some(w=>w.id===left)||!m.right.some(w=>w.id===right))return{ignored:true};if(left===right){m.matched.push(left);m.finished=m.matched.length===m.left.length;return{correct:true,first:!m.wrong.includes(left),finished:m.finished};}if(!m.wrong.includes(left))m.wrong.push(left);return{correct:false,finished:false};}
function reward(st,parent,key,amount=15,day=localDay()){
 const token=day+':'+key;if(st.rewards[token])return 0;st.rewards[token]=true;parent.xp=(Number(parent.xp)||0)+amount;return amount;
}
function speechTokens(text){return norm(text).replace(/\bi'm\b/g,'i am').replace(/\bit's\b/g,'it is').replace(/\bi've\b/g,'i have').replace(/\bi'll\b/g,'i will').replace(/\bwe're\b/g,'we are').replace(/\byou're\b/g,'you are').replace(/\bthey're\b/g,'they are').replace(/\bdon't\b/g,'do not').replace(/\bdoesn't\b/g,'does not').replace(/\bdidn't\b/g,'did not').replace(/\bwon't\b/g,'will not').replace(/\bcan't\b/g,'cannot').replace(/\bwouldn't\b/g,'would not').replace(/\bshouldn't\b/g,'should not').replace(/\bwasn't\b/g,'was not').replace(/\bweren't\b/g,'were not').split(/\s+/).filter(Boolean);}
function compareSpeech(target,text){
 const a=speechTokens(target),b=speechTokens(text);if(!b.length)return{status:'no_speech',ratio:null,matched:0,total:a.length,missing:a};
 // LCS counts words in order, not phonemes or accent quality. The UI labels this explicitly.
 const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]+1:Math.max(d[i-1][j],d[i][j-1]);
 const missing=[];let i=a.length,j=b.length;while(i>0){if(j>0&&a[i-1]===b[j-1]){i--;j--;}else if(j>0&&d[i][j-1]>=d[i-1][j])j--;else missing.unshift(a[--i]);}
 const matched=d[a.length][b.length];return{status:'transcript_comparison',ratio:Math.round(100*matched/Math.max(a.length,b.length,1)),matched,total:a.length,missing};
}
function pageKey(book,page){return book+':'+page;}
function markPage(st,book,page,count){if(!Number.isInteger(page)||page<1||page>count)return false;const k=pageKey(book,page);st.pages[k]=!st.pages[k];return st.pages[k];}
function saveNote(st,book,page,text){st.notes[pageKey(book,page)]=String(text||'').slice(0,12000);}
function custom(st,en,ru,book,unit,page){en=String(en||'').trim().slice(0,100);ru=String(ru||'').trim().slice(0,200);if(!en||!ru||!/[a-z]/i.test(en))return null;const exists=st.customWords.find(w=>norm(w.en)===norm(en)&&w.book===book&&w.unit===unit);if(exists){exists.ru=ru;return exists;}const w={id:'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),en,ru,book,unit,sourcePages:[page],translation:'user-authored'};st.customWords.push(w);return w;}
return {DAY,INTERVALS,fresh,restore,norm,recall,localDay,record,due,pick,shuffled,matching,pair,reward,speechTokens,compareSpeech,pageKey,markPage,saveNote,custom};
});
