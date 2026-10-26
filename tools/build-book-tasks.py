from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
D=json.loads((R/'web/book-content.js').read_text().split('=',1)[1].strip().rstrip(';'))
questions=[];prompts=[];counts={}
for line in (R/'content/grammar.tsv').read_text().splitlines():
 if not line or line.startswith('#'):continue
 b,u,s,ans,ds,exp,topic=line.split('|');u=int(u);unit=next(x for x in next(k for k in D['books'] if k['id']==b)['units'] if x['number']==u)
 key=f'{b}-{u}';n=counts.get(key,0)+1;counts[key]=n;opts=[ans]+ds.split(';');opts=opts[n%4:]+opts[:n%4]
 questions.append(dict(id=f'book-{key}-{n}',level=unit['level'],skill='grammar',topic=topic,type='choice',instruction='Практика по теме учебника: выбери правильный вариант.',sentence=s,answer=ans,accepted=[ans],options=opts,explanation=exp,tip=exp,book=b,unit=u,sourcePages=unit['sections'][-2 if u%2==0 else -1]['pages'],contentType='app-authored adaptation of grammar rule'))
for book in D['books']:
 for unit in book['units']:
  ws=[w for w in D['words'] if w['id'] in unit['wordIds']][:5]
  prompts.append(dict(id='book-writing-'+unit['id'],level=unit['level'],title=unit['sections'][4]['title'],description=unit['writing']['prompt'],questions=['Who are you writing to and why?','Which ideas and examples will you include?','How will you organize and check your text?'],vocabulary=[dict(word=w['en'],meaning=w['ru']) for w in ws],sample='Plan your own response first. Introduce the situation, develop your ideas with examples, and write an appropriate ending.',minWords={'A2':50,'B1':90,'B2':130}[unit['level']],maxWords={'A2':100,'B1':160,'B2':240}[unit['level']],book=book['id'],unit=unit['number'],sourcePages=unit['writing']['sourcePages'],contentType='app-authored writing adaptation'))
(R/'web/book-tasks.js').write_text('(function(){\nconst q='+json.dumps(questions,ensure_ascii=False)+';\nconst p='+json.dumps(prompts,ensure_ascii=False)+';\nwindow.LESSON_CONTENT.questions.push(...q);window.LESSON_CONTENT.prompts.push(...p);\n})();\n')
print('New questions',len(questions),'new writing prompts',len(prompts))
