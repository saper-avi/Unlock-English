/* Voice adapter. Native Android intent and TTS preferred; Web Speech only as a browser fallback.
   Audio is never uploaded to the app backend. Device recognition services may use their own network. */
(function(root){'use strict';let rec=null,active=null,watchdog=null;
function result(data){if(!data||data.id!==active)return;clearTimeout(watchdog);active=null;rec=null;root.dispatchEvent(new CustomEvent('book-speech-result',{detail:data}));}
root.onNativeBookSpeech=result;
function stop(){clearTimeout(watchdog);active=null;if(rec){try{rec.abort();}catch(_){}rec=null;}try{root.BookNative?.stopSpeaking();}catch(_){}try{root.speechSynthesis?.cancel();}catch(_){} }
function recognize(id){
 stop();active=id;watchdog=setTimeout(()=>result({id,status:'timeout',text:''}),45000);
 try{if(root.BookNative?.recognize){root.BookNative.recognize(id);return true;}
 const API=root.SpeechRecognition||root.webkitSpeechRecognition;if(!API){result({id,status:'unavailable',text:''});return false;}
 rec=new API();rec.lang='en-GB';rec.interimResults=false;rec.maxAlternatives=1;
 rec.onresult=e=>result({id,status:'ok',text:e.results?.[0]?.[0]?.transcript||''});
 rec.onerror=e=>result({id,status:e.error||'error',text:''});
 rec.onend=()=>{if(active===id)result({id,status:'cancelled',text:''});};rec.start();return true;
 }catch(_){result({id,status:'unavailable',text:''});return false;}
}
function speak(text,slow=false){text=String(text||'').slice(0,600);if(!text)return false;try{if(root.BookNative?.speak){root.BookNative.speak(text,!!slow);return true;}if(root.speechSynthesis&&root.SpeechSynthesisUtterance){root.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=slow?.72:.95;const voice=root.speechSynthesis.getVoices().find(v=>v.lang==='en-GB')||root.speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)u.voice=voice;root.speechSynthesis.speak(u);return true;}}catch(_){}return false;}
root.BookSpeech={recognize,speak,stop,capable:()=>!!(root.BookNative?.recognize||root.SpeechRecognition||root.webkitSpeechRecognition)};
})(window);
