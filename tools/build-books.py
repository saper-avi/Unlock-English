#!/usr/bin/env python3
"""Build the interactive supplement. Every source page is retained separately.
Translations and oral/writing prompts are app-authored adaptations, not an Oxford key.
Main-unit terms absent from that unit's extracted text are excluded for manual review.
"""
from pathlib import Path
import json,re,hashlib,unicodedata
ROOT=Path(__file__).resolve().parents[1]; WEB=ROOT/'web'
books=json.loads((WEB/'books/manifest.json').read_text()); cfg=json.loads((ROOT/'content/units.json').read_text())
starts=[4,16,30,42,56,68,82,94,108,120]
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()))
words=[];unresolved=[];duplicates=[];seen=set();counts={}
for line in (ROOT/'content/vocabulary.tsv').read_text().splitlines():
 if not line or line.startswith('#'):continue
 bid,u,origin,items=line.split('|',3);u=int(u);book=next(b for b in books if b['id']==bid)
 pages=[p for p in book['pages'] if p['unit']==u and (p['section']=='Vocabulary bank' if origin=='bank' else p['number']<135)]
 for item in items.split(';'):
  en,ru=item.split('=',1);en=en.strip();ru=ru.strip();key=f'{bid}:{u}:{en.lower()}'
  if key in seen:duplicates.append(key);continue
  ev=[p['number'] for p in pages if norm(en) in norm(p['text'])]
  if not ev:
   # Bank matching splits collocations between columns. Components are explicitly on the supplied page.
   tokens=[t for t in re.findall(r'[a-z]+',en.lower()) if t not in {'a','an','the','your','somebody','someone','of','to','on','in','for','with','by','at','from'}]
   evidence=next((p for p in pages if tokens and all(norm(t) in norm(p['text']) for t in tokens)),None)
   if origin=='bank' and evidence:ev=[evidence['number']];provenance='adapted_matching_or_lemma'
   else:
    unresolved.append(dict(book=bid,unit=u,en=en,ru=ru,reason='Не найдено точное подтверждение в извлечённом тексте своего раздела; не включено в интерактивный словарь.'))
    continue
  else:provenance='text_occurrence'
  seen.add(key)
  words.append(dict(id=bid+str(u)+'-'+hashlib.sha1(en.lower().encode()).hexdigest()[:10],book=bid,unit=u,en=en,ru=ru,sourcePages=ev,sourceSection=origin,provenance=provenance,translation='app-authored',level='A2' if bid=='pre' and u<=4 else 'B1' if bid=='pre' or u<=4 else 'B2'))
for book in books:
 units=[]
 for i,row in enumerate(cfg[book['id']],1):
  title,a,b,c,d,e,vi,bank,grammar,oral,question,sample,writing=row
  st=starts[i-1]
  sections=[dict(id=letter,title=label,pages=list(range(st+off+1,st+off+3))) for letter,label,off in [('A',a,0),('B',b,2),('C',c,4),('D',d,6),('E',e,8)]]
  sections.extend([dict(id='VI',title=vi,pages=[st+11]),dict(id='Review',title='Review',pages=[st+12]),dict(id='VB',title=bank,pages=[134+i]),dict(id='GR',title='Grammar reference & practice',pages=[144+i*2,145+i*2])])
  if i%2==0:
   p=[28,54,80,106,132][i//2-1];sections.append(dict(id='CR',title=f'Cumulative review 1–{i}',pages=[p+1,p+2]))
  level='A2' if book['id']=='pre' and i<=4 else 'B1' if book['id']=='pre' or i<=4 else 'B2'
  units.append(dict(id=book['id']+'-'+str(i),number=i,title=title,level=level,grammar=grammar,sections=sections,wordIds=[w['id'] for w in words if w['book']==book['id'] and w['unit']==i],speaking=dict(task=oral,question=question,repeat=sample,sourcePages=[st+5,st+6],contentType='app-authored adaptation of the speaking function, not a source quotation'),writing=dict(prompt=writing,sourcePages=[st+9,st+10],contentType='app-authored adaptation of the writing genre and strategy')))
 book['units']=units
 book['levelNote']='Маршрут приложения по сложности: не официальная оценка каждого упражнения. Загруженное издание 2014 года; CEFR не указан в этих PDF.'
 # Do not duplicate full text in this second bundle.
 book.pop('pages')
data=dict(version=1,books=books,words=words,sourceNote='Материал двух PDF пользователя. Все 332 страницы сохранены в оригинальном виде. Интерактивный словарь и задания — отдельная адаптация, не официальный ключ. Аудио CD / DVD не предоставлено.')
(WEB/'book-content.js').write_text('window.BOOK_CONTENT='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'content/excluded-vocabulary.json').write_text(json.dumps(unresolved,ensure_ascii=False,indent=2))
report=dict(source_pages=sum(b['pageCount'] for b in books),source_books=2,units=20,interactive_vocabulary_entries=len(words),by_book={b['id']:sum(w['book']==b['id'] for w in words) for b in books},vocabulary_by_unit={f'{b["id"]}-{u}':sum(w['book']==b['id'] and w['unit']==u for w in words) for b in books for u in range(1,11)},excluded_candidates=len(unresolved),duplicate_candidates=len(duplicates),full_exercise_autograding=False,original_audio_included=False,level_labels='Editorial app routes A2→B1 and B1→B2; not first-edition publisher certification')
(ROOT/'docs/book-coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2));print('EXCLUDED',[(x['book'],x['unit'],x['en']) for x in unresolved])
