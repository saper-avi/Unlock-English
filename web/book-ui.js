/* Coursebook supplement. Original pages, adapted practice and self-assessment are distinct. */
(function(root){'use strict';
function create(o){
 const C=root.BookCore,D=root.BOOK_CONTENT,P=root.BOOK_PAGES,Speech=root.BookSpeech;
 root.addEventListener('book-speech-notice',()=>o.toast('Английский голос пока недоступен. Проверь настройки синтеза речи Android.'));
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const btn=(s,a,v='',cls='secondary',extra='')=>`<button class="${cls}" data-action="bk-${a}" data-value="${esc(v)}" ${extra}>${s}</button>`;
 let view='library',bookId='pre',unitNo=1,page=5,zoom=1,showText=false,filter='',session=null,left=null,right=null,pairLock=false;
 let speech={mode:'repeat',text:'',source:'',busy:false,request:null,message:'',checked:false,checklist:false};
 let turn=0,sessionSerial=0,leaveTimer=null;
 function state(){let parent=o.getState();if(!parent.bookStudy||parent.bookStudy.version!==1)parent.bookStudy=C.restore(parent.bookStudy);return parent.bookStudy;}
 function save(){o.save();}
 const book=()=>D.books.find(b=>b.id===bookId)||D.books[0];
 const unit=()=>book().units.find(u=>u.number===unitNo)||book().units[0];
 const source=()=>P.find(b=>b.id===bookId);
 const allWords=()=>[...D.words,...state().customWords];
 const words=()=>allWords().filter(w=>w.book===bookId&&w.unit===unitNo);
 function redraw(kind='update'){o.render(kind);}
 function route(v){turn++;pairLock=false;clearTimeout(leaveTimer);if(view==='speaking'&&v!=='speaking'){Speech.stop();speech.busy=false;}view=v;filter='';redraw('page');root.scrollTo(0,0);}
 function leave(){turn++;clearTimeout(leaveTimer);pairLock=false;Speech.stop();speech.busy=false;speech.request=null;}
 function crumb(title){return `<div class="bk-crumb">${btn('‹','back','','back-btn','aria-label="Назад"')}<span>${esc(book().title)}<br><strong>${esc(title)}</strong></span></div>`;}
 function sourceLabel(pages){return `PDF ${pages.join('–')}`;}
 function vocabCount(b){return D.words.filter(w=>w.book===b.id).length;}
 function studied(b){return Object.keys(state().pages).filter(k=>k.startsWith(b.id+':')&&state().pages[k]).length;}
 function library(){
 const due=C.due(state(),allWords()).length;
 return `<div class="screen-title"><div class="eyebrow">YOUR LEARNING LIBRARY</div><h1 class="spaced">Больше, чем квиз.</h1><p class="sub">Две книги. Двадцать юнитов. Читай, соединяй пары, вспоминай и говори.</p></div>
 <div class="bk-small-stats"><span><b>332</b> страницы</span><span><b>${D.words.length}</b> карточек</span><span><b>${due}</b> повторить</span></div>
 ${D.books.map((b,i)=>`<button class="bk-book bk-book-${b.id}" data-action="bk-open-book" data-value="${b.id}"><span class="bk-cover"><img src="books/${b.id}/001.webp" alt="Обложка ${esc(b.title)}" loading="lazy"></span><span class="bk-book-copy"><span class="eyebrow">COURSE ${String(i+1).padStart(2,'0')}</span><h2>${esc(b.title.replace('Insight ',''))}</h2><span class="pill">${b.levelRange}</span><p>10 юнитов · ${vocabCount(b)} слов и выражений</p><span class="bk-progress"><i style="width:${studied(b)/b.pageCount*100}%"></i></span><small>${studied(b)} / ${b.pageCount} страниц отмечено</small></span><span class="bk-go">↗</span></button>`).join('')}
 <div class="note-card"><div><strong>Оригинал и тренажёр — не одно и то же</strong><p>Обе книги сохранены целиком: тексты, рисунки, задания, review, vocabulary bank и грамматические приложения. Автопроверка есть у отдельных адаптированных тренировок, не у каждого упражнения на странице. Русские переводы и дополнительные формулировки составлены для приложения.</p>${btn('Что входит в курс','coverage','','text-btn')}</div></div>
 <p class="privacy-foot">Диапазоны A2 → B1 и B1 → B2 — маршруты приложения. A1 и прежние квизы остались в разделе «Квизы».</p>`;
 }
 function contents(){
 const b=book();return `${crumb('Карта курса')}<div class="screen-title"><div class="eyebrow">${b.levelRange} · INSIGHT</div><h1 class="spaced">${esc(b.title.replace('Insight ',''))}</h1><p class="sub">Сохраняем порядок книги. В каждом юните — оригинальные разделы и отдельная практика.</p></div>
 <div class="bk-two">${btn('Продолжить чтение','read-last','','primary')}${btn('Поиск по книге','search','','secondary')}</div>
 <div class="bk-path">${b.units.map(u=>{const n=u.sections.flatMap(s=>s.pages).filter(p=>state().pages[C.pageKey(b.id,p)]).length;return `<button class="bk-unit" data-action="bk-open-unit" data-value="${u.number}"><span class="bk-unit-index">${String(u.number).padStart(2,'0')}</span><span><small>${u.level} · ${u.wordIds.length} карточек</small><strong>${esc(u.title)}</strong><em>${esc(u.grammar)}</em></span><span class="bk-mini-progress">${n}<small>стр.</small></span></button>`;}).join('')}</div>
 <div class="bk-two">${btn('Содержание книги','page','3')}${btn('Полное покрытие','coverage')}</div><p class="privacy-foot">Уровень внутри курса — ориентир, а не результат теста CEFR.</p>`;
 }
 function unitPage(){
 const u=unit(),ws=words(),known=ws.filter(w=>(state().words[w.id]?.stage||0)>=3).length;
 return `${crumb('Unit '+u.number)}<div class="bk-unit-hero"><span class="eyebrow">${book().levelRange} · UNIT ${u.number}</span><h1>${esc(u.title)}</h1><p>${esc(u.grammar)}</p><span class="bk-progress"><i style="width:${known/Math.max(1,ws.length)*100}%"></i></span><small>${known} / ${ws.length} карточек с устойчивым повторением</small></div>
 <div class="bk-mode-grid">
 ${mode('Aa','Слова','Карточки и интервальное повторение','flash')}${mode('⇄','Matching','Соедини слово и перевод','match')}${mode('⌨','Вспомнить','Напиши без подсказки','recall')}${mode('◉','Speaking','Повтори фразу или ответь','speaking')}
 </div><div class="bk-two">${btn('Грамматика · 4 вопроса','grammar','','primary')}${btn('Writing · свой текст','writing')}</div>
 <div class="section-head"><h2>Вся глава</h2><small>Источник, без сокращений</small></div><div class="bk-sections">${u.sections.map(s=>`<button data-action="bk-page" data-value="${s.pages[0]}" class="bk-section"><span class="bk-section-id">${esc(s.id)}</span><span><strong>${esc(s.title)}</strong><small>${sourceLabel(s.pages)} ${s.pages.every(p=>state().pages[C.pageKey(bookId,p)])?'· изучено':''}</small></span><span>›</span></button>`).join('')}</div>
 ${btn('Все слова этого юнита','vocabulary','','secondary bk-spaced')}<p class="privacy-foot">Тренировки используют лексику и темы раздела. Speaking-фразы и квизы — адаптация приложения. Аудиотреки CD и DVD в PDF отсутствуют.</p>`;
 }
 function mode(symbol,title,note,action){return `<button class="bk-mode" data-action="bk-${action}"><span class="bk-mode-icon">${symbol}</span><strong>${title}</strong><small>${note}</small></button>`;}
 function reader(){
 const p=source().pages[page-1];const k=C.pageKey(bookId,page);const studied=!!state().pages[k];
 return `${crumb(p.section)}<div class="bk-reader-tools"><label>PDF <input id="bk-page-number" type="number" min="1" max="166" value="${page}" aria-label="Номер страницы PDF"> / 166</label>${btn('Перейти','jump','','text-btn')}${btn(zoom===1?'Увеличить':'Уменьшить','zoom','','text-btn')}</div>
 <div class="bk-reader-caption">${p.printed?`Печатная страница ${p.printed}${page>=146?' · Grammar reference (другая нумерация)':''}`:'Служебная страница'}${p.unit?' · Unit '+p.unit:''}</div>
 <div class="bk-reader-viewport" style="--page-zoom:${zoom}"><img class="bk-source-page" src="${p.image}" alt="${esc(book().title)}, страница PDF ${page}, ${esc(p.section)}" decoding="async"></div>
 <div class="bk-reader-nav">${btn('← Назад','page',String(page-1),'secondary',page<=1?'disabled':'')}${btn('Дальше →','page',String(page+1),'primary',page>=166?'disabled':'')}</div>
 ${btn(studied?'✓ Отмечена изученной':'Отметить страницу изученной','mark-page','','secondary bk-spaced','aria-pressed="'+studied+'"')}
 ${/listen|\bDVD\b/i.test(p.text)?'<div class="bk-source-notice">На странице есть задание с аудио или видео. Оригинальная запись не приложена: не угадываем ответы и не считаем её прослушанной.</div>':''}
 <label class="eyebrow bk-label" for="bk-note">Мои ответы и заметки · сохраняются автоматически</label><textarea id="bk-note" class="bk-textarea" maxlength="12000" placeholder="1) …  2) …\nЗдесь можно выполнить задания с оригинальной страницы.">${esc(state().notes[k]||'')}</textarea>
 <p class="tiny muted">Это самостоятельная работа. Приложение не объявляет ответы на странице автоматически правильными.</p>
 <div class="bk-two bk-spaced">${btn(showText?'Скрыть текст':'Показать извлечённый текст','raw-text')}${btn('Добавить своё слово','add-word')}</div>
 ${showText?`<div class="bk-source-notice">Текст извлечён из PDF: возможны ошибки распознавания и порядок колонок. Для сверки используй изображение выше.</div><pre class="bk-raw">${esc(p.text)}</pre>`:''}`;
 }
 function vocabulary(){
 const list=words().filter(w=>(w.en+' '+w.ru).toLowerCase().includes(filter.toLowerCase()));
 return `${crumb('Vocabulary bank')}<h1 class="spaced">Слова в контексте.</h1><p class="sub">Unit ${unitNo} · ${esc(unit().title)}. Нажми на номер страницы, чтобы увидеть исходное задание.</p>
 <input class="answer-input bk-spaced" id="bk-word-search" placeholder="Найти слово или перевод" value="${esc(filter)}" type="search"><div class="bk-two bk-spaced">${btn('Повторить сейчас','flash','','primary')}${btn('Добавить своё','add-word')}</div>
 <div id="bk-word-results">${wordRows(list)}</div>`;
 }
 function wordRows(list){return `<p class="tiny muted bk-spaced">${list.length} карточек · переводы составлены для приложения</p>`+list.map(w=>`<article class="bk-word"><div><strong lang="en">${esc(w.en)}</strong><p>${esc(w.ru)}</p><small>${state().words[w.id]?`Этап повторения ${state().words[w.id].stage} / 5`:'Новое слово'}${w.translation==='user-authored'?' · твоя карточка':''}</small></div><div>${btn('♫','say-word',w.id,'bk-round','aria-label="Прослушать '+esc(w.en)+'"')}${btn('PDF '+w.sourcePages[0],'page',String(w.sourcePages[0]),'text-btn')}</div></article>`).join('');}
 function makeSession(kind){
 const pool=C.pick(state(),words(),words().length);const selected=pool.slice(0,kind==='match'?5:8);
 session={id:Date.now().toString(36)+'-'+(++sessionSerial),kind,items:selected,index:0,seen:false,checked:false,answer:'',correct:0,finished:false,reward:0};
 if(kind==='match'){session.match=C.matching(pool,Math.random,5);session.items=session.match.left;}
 route(kind);
 }
 function finishSession(){if(session.finished)return;session.finished=true;session.reward=C.reward(state(),o.getState(),bookId+':'+unitNo+':'+session.kind);save();redraw('result');o.ux.celebrate(document.getElementById('app'),'finish');}
 function exerciseTop(title,done,total){return `${crumb(title)}<div class="quiz-label"><span class="pill">${esc(unit().title)}</span><small>${done} / ${total}</small></div><div class="progress-bar"><span style="width:${done/Math.max(1,total)*100}%"></span></div>`;}
 function resultView(){return `${crumb('Тренировка завершена')}<div class="bk-result"><div class="celebration-stage"><div class="result-visual">✓</div></div><div class="eyebrow">ANOTHER STEP FORWARD</div><h1>Слова становятся<br>твоими.</h1><p class="sub">${session.kind==='flash'?'Ты проверил себя по карточкам. Это самооценка, а не экзамен.':`Верно с первой попытки: ${session.correct} из ${session.items.length}.`} Сложные слова вернутся раньше.</p><div class="bk-small-stats"><span><b>${session.items.length}</b> карточек</span><span><b>+${session.reward}</b> XP</span></div>${btn('Вернуться к юниту','unit','','primary')}${btn('Другая тренировка','unit','','plain')}</div>`;}
 function flash(){if(!session)return unitPage();if(session.finished)return resultView();const w=session.items[session.index];if(!w)return unitPage();return `${exerciseTop('Flashcards',session.index,session.items.length)}<p class="quiz-instruction">Прежде чем открыть перевод, вспомни его самостоятельно.</p><button class="bk-flash ${session.seen?'is-flipped':''}" data-action="bk-reveal" aria-label="Показать перевод"><span class="eyebrow">${session.seen?'MEANING':'TRY TO REMEMBER'}</span><strong lang="en">${esc(w.en)}</strong><span class="bk-flash-meaning">${session.seen?esc(w.ru):'Нажми, чтобы проверить себя'}</span></button><div class="bk-two bk-spaced">${btn('♫ Послушать','say-word',w.id)}${btn('Контекст в книге','page',String(w.sourcePages[0]))}</div>${session.seen?`<div class="bk-two bk-spaced">${btn('Пока не помню','flash-grade','no')}${btn('Вспомнил','flash-grade','yes','primary')}</div><p class="privacy-foot">Честная самооценка помогает выбрать следующий интервал.</p>`:btn('Показать перевод','reveal','','primary bk-spaced')}`;}
 function match(){if(!session)return unitPage();if(session.finished)return resultView();const m=session.match;return `${exerciseTop('Matching',m.matched.length,m.left.length)}<h2>Найди связь.</h2><p class="sub">Сначала выбери слово, затем перевод. Порядок можно менять.</p><div class="bk-match-grid">${['left','right'].map(side=>`<div class="bk-match-column">${m[side].map(w=>`<button class="bk-tile ${m.matched.includes(w.id)?'is-matched':''} ${(side==='left'?left:right)===w.id?'is-selected':''}" data-action="bk-pair-${side}" data-value="${w.id}" ${m.matched.includes(w.id)?'disabled':''} lang="${side==='left'?'en':'ru'}">${esc(side==='left'?w.en:w.ru)}${m.matched.includes(w.id)?'<span>✓</span>':''}</button>`).join('')}</div>`).join('')}</div><p id="bk-match-message" class="bk-match-message" aria-live="polite">${m.matched.length?'Хорошо. Продолжай.':'Соедини все пары — спешить не нужно.'}</p>`;}
 function recallView(){if(!session)return unitPage();if(session.finished)return resultView();const w=session.items[session.index];return `${exerciseTop('Active recall',session.index,session.items.length)}<p class="quiz-instruction">Вспомни английское слово или выражение.</p><div class="sentence">${esc(w.ru)}</div><input class="answer-input" id="bk-recall-answer" value="${esc(session.answer)}" placeholder="Type in English…" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="160" ${session.checked?'disabled':''}>${session.checked?`<div class="feedback ${session.lastCorrect?'':'wrong'}"><strong>${session.lastCorrect?'Верно.':'Закрепим слово.'}</strong><p lang="en">${esc(w.en)}</p><p>${session.lastCorrect?'Слово вернётся позже.':'Здесь проверяется именно эта карточка, а не любой возможный синоним перевода.'}</p></div>${btn('Дальше','next-recall','','primary bk-spaced')}`:btn('Проверить','check-recall','','primary bk-spaced')}`;}
 function speaking(){
 const s=speech,u=unit();const compare=s.checked&&s.mode==='repeat'?C.compareSpeech(u.speaking.repeat,s.text):null;
 return `${crumb('Speaking lab')}<div class="screen-title"><div class="eyebrow">FIND YOUR VOICE</div><h1 class="spaced">Скажи это вслух.</h1><p class="sub">${esc(u.speaking.task)}</p></div>
 <div class="bk-two">${btn('Повторить фразу','speech-mode','repeat',s.mode==='repeat'?'primary':'secondary')}${btn('Ответить самому','speech-mode','answer',s.mode==='answer'?'primary':'secondary')}</div>
 <div class="bk-speech-card"><span class="eyebrow">${s.mode==='repeat'?'LISTEN & REPEAT':'YOUR OWN ANSWER'}</span><h2 lang="en">${esc(s.mode==='repeat'?u.speaking.repeat:u.speaking.question)}</h2><div class="bk-two">${btn('♫ Послушать','speak-model')}${btn('♫ Медленнее','speak-slow')}</div></div>
 <div class="bk-mic-wrap ${s.busy?'is-listening':''}"><span class="bk-mic-wave"></span>${btn(s.busy?'■':'◉',s.busy?'speech-stop':'record','','bk-mic',s.busy?'aria-label="Отменить распознавание"':'aria-label="Начать голосовой ответ"')}</div><p class="bk-mic-caption">${s.busy?'Слушаю через системный распознаватель…':'Нажми и произнеси ответ'}</p>
 ${s.message?`<div class="bk-source-notice" role="status">${esc(s.message)}</div>`:''}
 <label class="eyebrow bk-label" for="bk-transcript">${s.source==='voice'?'Распознано · можно исправить ошибку распознавания':'Текстовый вариант / расшифровка'}</label><textarea id="bk-transcript" class="bk-textarea" maxlength="2500" placeholder="Распознанный ответ появится здесь. Можно также написать ответ — это отдельный текстовый режим.">${esc(s.text)}</textarea>
 <p class="tiny muted">${s.source==='voice'?'Речь преобразована в текст.':'Ввод вручную не считается проверкой голоса.'} Мы сравниваем слова, не оцениваем акцент или произношение.</p>
 ${btn(s.mode==='repeat'?'Сравнить слова':'Самопроверка ответа','check-speech','','primary bk-spaced',s.busy?'disabled':'')}
 ${compare?`<div class="feedback ${compare.ratio!==null&&compare.ratio>=85?'':'wrong'}"><strong>${compare.status==='no_speech'?'Нет текста для сравнения':`Совпадение слов: ${compare.matched} / ${compare.total}`}</strong><p>${compare.missing.length?'Проверь фрагменты: '+esc(compare.missing.join(', ')):'Все слова примера найдены в нужном порядке.'}</p><p>Это не оценка произношения. Ошибка распознавания не означает, что ты произнёс слово неправильно.</p></div>`:''}
 ${s.checked&&s.mode==='answer'?`<div class="feature-card"><h3>Проверь себя</h3><p class="spaced">Я ответил на вопрос, добавил причину или пример и попробовал использовать слова юнита.</p></div>`:''}
 ${s.checked&&s.text.trim()?`<label class="bk-checkbox bk-spaced"><input type="checkbox" id="bk-speech-check" ${s.checklist?'checked':''}>Я прочитал свой ответ и разобрал трудные места</label>${btn('Сохранить практику','save-speech','','secondary bk-spaced',s.checklist?'':'disabled')}`:''}
 <p class="privacy-foot">Фразы тренажёра составлены по коммуникативным темам учебника. Оригинальные speaking-задания: ${sourceLabel(u.speaking.sourcePages)}. Озвучка синтезируется устройством, это не CD учебника.</p>${btn('Открыть исходный раздел','page',String(u.speaking.sourcePages[0]),'text-btn')}`;
 }
 function record(){
 if(!state().speechConsent){o.modal('Голосовая практика',`<p>После нажатия открывается распознавание английской речи. Системный сервис Android или браузера может отправлять звук своему поставщику; режим зависит от устройства и может требовать интернет.</p><div class="disclosure">Приложение сохраняет только полученный текст и не записывает звук в фоне. Можно отказаться и написать ответ вручную. Никакой оценки акцента или IELTS здесь нет.</div>${btn('Понятно, включить','consent-record','','primary')}${btn('Продолжить без микрофона','decline-record','','secondary bk-spaced')}`);return;}
 speech.busy=true;speech.message='';speech.checked=false;speech.request='speech-'+Date.now()+'-'+(++sessionSerial);redraw();Speech.recognize(speech.request);
 }
 root.addEventListener('book-speech-result',e=>{
  const r=e.detail;if(view!=='speaking'||r.id!==speech.request)return;
  speech.busy=false;speech.request=null;
  if(r.status==='ok'&&String(r.text||'').trim()){speech.text=String(r.text).slice(0,2500);speech.source='voice';speech.message='Готово. Проверь, верно ли устройство расслышало тебя.';}
  else{speech.message=({'cancelled':'Распознавание отменено. Можно повторить без штрафа.','not-allowed':'Нет разрешения на распознавание. Можно написать ответ или изменить разрешение.','no-speech':'Не удалось расслышать речь. Попробуй ещё раз.','timeout':'Ответ от распознавателя не получен. Попробуй ещё раз или используй текст.'})[r.status]||'Распознавание сейчас недоступно. Проверь сервис голосового ввода и интернет или напиши ответ вручную.';}
  redraw();
 });
 root.addEventListener('book-native-status',e=>{if(e.detail?.message)o.toast(e.detail.message);});
 function searchView(){return `${crumb('Поиск по всей книге')}<h1>Найти в источнике.</h1><p class="sub">Поиск по всем 166 страницам, включая приложения. В извлечённом тексте могут быть ошибки распознавания.</p><input class="answer-input bk-spaced" id="bk-source-search" value="${esc(filter)}" type="search" placeholder="Например: present perfect"><div id="bk-search-results">${searchRows()}</div>`;}
 function searchRows(){if(filter.trim().length<2)return'<p class="privacy-foot">Введи хотя бы два символа.</p>';const q=C.norm(filter).replace(/ /g,'');return source().pages.filter(p=>C.norm(p.text).replace(/ /g,'').includes(q)).map(p=>`<button class="bk-section" data-action="bk-page" data-value="${p.number}"><span class="bk-section-id">${p.number}</span><span><strong>${esc(p.section)}</strong><small>${p.unit?'Unit '+p.unit+' · ':''}${p.printed?'печатная '+p.printed:''}</small></span><span>›</span></button>`).join('')||'<p class="privacy-foot">Совпадений не найдено. Проверь написание или открой страницу вручную.</p>';}
 function coverage(){
  o.modal('Что включено в 0.4',`<p><strong>332 из 332 страниц</strong> двух загруженных PDF доступны без интернета: оригинальные тексты, иллюстрации, упражнения, review, Vocabulary insight, Vocabulary bank и Grammar reference & practice.</p><div class="disclosure"><strong>Интерактивная часть</strong><br>${D.words.length} карточек; matching, активное вспоминание, интервальное повторение; 80 дополнительных грамматических вопросов, 20 письменных и 40 устных заданий по темам книг.<br><br><strong>Не вся страница проверяется автоматически.</strong> Для остальных упражнений есть изображение и сохраняемые ответы. Официальные ключи и аудио/видеотреки не предоставлены. Мы не подставляем вымышленные ответы к listening.<br><br>Уровни A2 → B1 / B1 → B2 и переводы — редакционные решения приложения. Новые формулировки тренажёра помечены как адаптация. Полный исходник доступен для сверки.</div>${btn('Понятно','dismiss','','primary')}`);
 }
 function addWord(){o.modal('Моя карточка',`<p>Добавь слово со страницы и собственный перевод. Это не автоматически проверенная запись словаря.</p><label class="bk-label" for="bk-new-en">English</label><input id="bk-new-en" class="answer-input" maxlength="100"><label class="bk-label" for="bk-new-ru">Значение в этом контексте</label><input id="bk-new-ru" class="answer-input" maxlength="200">${btn('Добавить к юниту '+unitNo,'save-word','','primary bk-spaced')}`);}
 function handle(action,value){
 const a=action.replace(/^bk-/,'');
 switch(a){
 case'open-book':bookId=value==='int'?'int':'pre';unitNo=1;route('contents');break;
 case'open-unit':unitNo=Math.max(1,Math.min(10,Number(value)||1));route('unit');break;
 case'unit':route('unit');break;
 case'back':if(view==='library'){o.go('home');break;}if(view==='contents')route('library');else if(view==='unit')route('contents');else route('unit');break;
 case'page':{const n=Number(value);if(Number.isInteger(n)&&n>=1&&n<=166){page=n;const pg=source().pages[n-1];if(pg.unit)unitNo=pg.unit;state().lastPages[bookId]=n;zoom=1;showText=false;save();route('reader');}break;}
 case'read-last':handle('bk-page',String(state().lastPages[bookId]||5));break;
 case'jump':handle('bk-page',document.getElementById('bk-page-number')?.value);break;
 case'zoom':zoom=zoom===1?2:1;redraw();break;
 case'raw-text':showText=!showText;redraw();break;
 case'mark-page':{const marked=C.markPage(state(),bookId,page,166);save();redraw();if(marked)o.ux.play('correct');break;}
 case'vocabulary':route('vocabulary');break;
 case'search':route('search');break;
 case'flash':case'match':case'recall':left=right=null;makeSession(a);break;
 case'reveal':if(session&&!session.finished&&!session.seen){session.seen=true;redraw();}break;
 case'flash-grade':if(session?.kind==='flash'&&session.seen&&!session.finished){const w=session.items[session.index];if(C.record(state(),w.id,value==='yes',session.id+':'+w.id,Date.now(),'self-assessed')){session.correct+=Number(value==='yes');session.index++;session.seen=false;save();if(session.index>=session.items.length)finishSession();else{redraw('question');o.ux.play(value==='yes'?'correct':'incorrect');}}}break;
 case'pair-left':case'pair-right':{
  if(!session||session.kind!=='match'||session.finished||pairLock||session.match.matched.includes(value))break;
  if(a==='pair-left')left=value;else right=value;
  if(!left||!right){redraw();break;}
  const result=C.pair(session.match,left,right);if(result.ignored){left=right=null;break;}
  pairLock=true;const epoch=turn;
  const l=left,r=right;
  // Update tiles in place so correct pairs visibly settle before the next view.
  for(const el of document.querySelectorAll('.bk-tile')){if(el.dataset.value===l||el.dataset.value===r)el.classList.add(result.correct?'bk-pair-success':'bk-pair-error');}
  o.ux.play(result.correct?'correct':'incorrect');
  const message=document.getElementById('bk-match-message');if(message)message.textContent=result.correct?'Пара найдена.':'Не эта пара. Посмотри ещё раз.';
  if(result.correct){session.correct+=Number(result.first);C.record(state(),l,result.first,session.id+':'+l,Date.now(),'matching');save();}
  leaveTimer=setTimeout(()=>{if(epoch!==turn)return;left=right=null;pairLock=false;if(result.finished)finishSession();else redraw();},o.ux.motion()?440:30);break;
 }
 case'check-recall':if(session?.kind==='recall'&&!session.checked&&!session.finished){const text=document.getElementById('bk-recall-answer')?.value||session.answer;if(!text.trim()){o.toast('Сначала введи ответ.');break;}const w=session.items[session.index];session.answer=text;session.lastCorrect=C.recall(w,text);session.checked=true;session.correct+=Number(session.lastCorrect);C.record(state(),w.id,session.lastCorrect,session.id+':'+w.id,Date.now(),'recall');save();redraw('feedback');o.ux.play(session.lastCorrect?'correct':'incorrect');}break;
 case'next-recall':if(session?.kind==='recall'&&session.checked&&!session.finished){session.index++;session.checked=false;session.answer='';if(session.index>=session.items.length)finishSession();else redraw('question');}break;
 case'say-word':{const w=allWords().find(w=>w.id===value);if(w&&!Speech.speak(w.en))o.toast('Голос английского языка недоступен на этом устройстве.');break;}
 case'speaking':speech={mode:'repeat',text:'',source:'',busy:false,request:null,message:'',checked:false,checklist:false};route('speaking');break;
 case'speech-mode':Speech.stop();speech={mode:value==='answer'?'answer':'repeat',text:'',source:'',busy:false,request:null,message:'',checked:false,checklist:false};redraw();break;
 case'record':record();break;
 case'consent-record':state().speechConsent=true;save();o.closeModal();record();break;
 case'decline-record':o.closeModal();document.getElementById('bk-transcript')?.focus();break;
 case'speech-stop':Speech.stop();speech.busy=false;speech.request=null;speech.message='Остановлено. Попытка не считается ошибкой.';redraw();break;
 case'speak-model':case'speak-slow':if(!Speech.speak(speech.mode==='repeat'?unit().speaking.repeat:unit().speaking.question,a==='speak-slow'))o.toast('Для озвучки нужен установленный английский голос.');break;
 case'check-speech':if(!speech.text.trim())o.toast('Сначала произнеси или напиши ответ.');else{speech.checked=true;speech.checklist=false;redraw();}break;
 case'save-speech':if(speech.checked&&speech.checklist&&speech.text.trim()){
  const id=bookId+':'+unitNo+':'+speech.mode+':'+Date.now();state().speaking.unshift({id,book:bookId,unit:unitNo,text:speech.text,source:speech.source||'typed',mode:speech.mode,date:new Date().toISOString(),assessment:'self-check / transcript comparison; not pronunciation scoring'});state().speaking=state().speaking.slice(0,100);
  const xp=C.reward(state(),o.getState(),bookId+':'+unitNo+':speaking-'+speech.mode);save();speech.checked=false;route('unit');o.toast('Практика сохранена. +'+xp+' XP');o.ux.play('finish');}break;
 case'grammar':o.startQuiz(bookId,unitNo);break;
 case'writing':o.openWriting('book-writing-'+bookId+'-'+unitNo);break;
 case'coverage':coverage();break;
 case'add-word':addWord();break;
 case'save-word':{const w=C.custom(state(),document.getElementById('bk-new-en')?.value,document.getElementById('bk-new-ru')?.value,bookId,unitNo,view==='reader'?page:134+unitNo);if(w){save();o.closeModal();o.toast('Твоя карточка добавлена.');redraw();}else o.toast('Заполни английское слово и его значение.');break;}
 case'dismiss':o.closeModal();break;
 default:return false;
 }return true;
 }
 function input(el){
 switch(el.id){
 case'bk-note':C.saveNote(state(),bookId,page,el.value);save();return true;
 case'bk-recall-answer':if(session)session.answer=el.value;return true;
 case'bk-word-search':filter=el.value;document.getElementById('bk-word-results').innerHTML=wordRows(words().filter(w=>(w.en+' '+w.ru).toLowerCase().includes(filter.toLowerCase())));return true;
 case'bk-source-search':filter=el.value;document.getElementById('bk-search-results').innerHTML=searchRows();return true;
 case'bk-transcript':speech.text=el.value;speech.source=speech.source==='voice'?'edited-transcript':'typed';speech.checked=false;speech.checklist=false;return true;
 case'bk-speech-check':speech.checklist=el.checked;const b=document.querySelector('[data-action="bk-save-speech"]');if(b)b.disabled=!el.checked;return true;
 default:return false;
 }
 }
 function render(){return `<div class="book-app">${({library,contents,unit:unitPage,reader,vocabulary,flash,match,recall:recallView,speaking,search:searchView}[view]||library)()}</div>`;}
 return{render,handle,input,leave,back:()=>{handle('bk-back');return true;},current:()=>view,openPage:(b,u,p)=>{bookId=b;unitNo=u;handle('bk-page',String(p));},reset:()=>{session=null;route('library');}};
}
root.BookUI={create};
})(window);
