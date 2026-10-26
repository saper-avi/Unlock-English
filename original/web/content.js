/* Original offline learning material. Levels are learning routes, not certification. */
(function () {
  'use strict';
  const questions = [];
  const prompts = [];
  const counts = {};
  function choice(level, skill, topic, sentence, correct, distractors, explanation, tip) {
    const n = (counts[level] || 0) + 1;
    counts[level] = n;
    const options = [correct, ...distractors];
    const shift = (n - 1) % 4;
    for (let i = 0; i < shift; i++) options.unshift(options.pop());
    questions.push({id: level.toLowerCase() + '-' + String(n).padStart(2, '0'), level, skill, topic,
      type: 'choice', instruction: skill === 'reading' ? 'Прочитайте текст и выберите ответ.' : 'Выберите правильный вариант.',
      sentence, options, answer: correct, explanation, tip});
  }
  function input(level, skill, topic, sentence, answer, explanation, tip, accepted) {
    const n = (counts[level] || 0) + 1;
    counts[level] = n;
    questions.push({id: level.toLowerCase() + '-' + String(n).padStart(2, '0'), level, skill, topic,
      type: 'input', instruction: 'Впишите форму слова из скобок. Меняйте только это слово.',
      sentence, answer, accepted: accepted || [answer], explanation, tip});
  }
  function prompt(level, title, description, questions, vocabulary, sample) {
    const bounds = {A1: [25, 70], A2: [50, 100], B1: [90, 160], B2: [130, 240]}[level];
    const n = prompts.filter(p => p.level === level).length + 1;
    prompts.push({id: 'writing-' + level.toLowerCase() + '-' + n, level, title, description,
      minWords: bounds[0], maxWords: bounds[1], questions,
      vocabulary: vocabulary.map(pair => ({word: pair[0], meaning: pair[1]})), sample});
  }

  // A1: basic personal information, routines and concrete everyday situations.
  choice('A1', 'grammar', 'be', 'I ___ a university student.', 'am', ['is', 'are', 'be'],
    'После I в настоящем времени нужна форма am: I am a student.', 'I am · he/she/it is · you/we/they are');
  choice('A1', 'grammar', 'be', 'My laptop ___ on the desk.', 'is', ['am', 'are', 'be'],
    'My laptop — один предмет, поэтому используется is.', 'Один предмет или человек: is.');
  choice('A1', 'grammar', 'present-simple', 'My sister ___ in an office every weekday.', 'works', ['work', 'working', 'to work'],
    'В Present Simple после he, she и it к глаголу обычно добавляется -s.', 'She works. They work.');
  choice('A1', 'grammar', 'articles', 'I have ___ old computer.', 'an', ['a', 'these', 'those'],
    'Old начинается с гласного звука, поэтому перед old computer нужен артикль an.', 'a/an выбирается по следующему звуку.');
  choice('A1', 'grammar', 'plural', 'There are two ___ in our classroom.', 'windows', ['window', 'a window', 'an window'],
    'После two существительное должно стоять во множественном числе: windows.', 'two books · three windows');
  choice('A1', 'grammar', 'possessives', 'This is Anna. ___ phone is new.', 'Her', ['His', 'Their', 'Our'],
    'Телефон принадлежит Анне. Для принадлежности после she используется her.', 'she → her · he → his');
  choice('A1', 'grammar', 'questions', '___ you study English every day?', 'Do', ['Does', 'Is', 'Are'],
    'Вопрос в Present Simple с you начинается с Do. После него стоит начальная форма глагола.', 'Do you study? Does she study?');
  choice('A1', 'grammar', 'can', 'I can ___ a simple website.', 'build', ['builds', 'building', 'to build'],
    'После can используется начальная форма глагола без to.', 'can + глагол без окончаний');
  choice('A1', 'grammar', 'there-is-are', 'There ___ three books in my bag.', 'are', ['is', 'am', 'be'],
    'Three books — множественное число, поэтому нужно There are.', 'There is a book. There are books.');
  choice('A1', 'grammar', 'negatives', 'He ___ like cold coffee.', "doesn't", ["don't", "isn't", "aren't"],
    'Для отрицания с he в Present Simple используется does not, или doesn’t. Сам like остаётся без -s.', "He doesn't like. They don't like.");
  choice('A1', 'vocabulary', 'workplace', 'Which item do you normally use to type on a computer?', 'A keyboard', ['A plate', 'A blanket', 'A spoon'],
    'Keyboard — клавиатура. Глагол type означает «печатать текст».', 'type on a keyboard');
  choice('A1', 'vocabulary', 'time', 'A lesson starts at 9:00 and ends at 10:00. How long is it?', 'One hour', ['One minute', 'One day', 'One week'],
    'Между 9:00 и 10:00 проходит один час: one hour.', '60 minutes = one hour');
  choice('A1', 'vocabulary', 'opposites', 'Which word is the opposite of expensive?', 'Cheap', ['Busy', 'Early', 'Quiet'],
    'Expensive — дорогой, cheap — дешёвый.', 'an expensive phone · a cheap ticket');
  choice('A1', 'vocabulary', 'everyday-actions', 'Your phone battery is almost empty. What do you need to do?', 'Charge the phone', ['Wash the phone', 'Cook the phone', 'Print the phone'],
    'Charge the phone означает «зарядить телефон».', 'charge a phone · charge a battery');
  choice('A1', 'reading', 'reading-details', 'Mira lives in Astana. She studies design and works in a café on Saturdays. What does she study?', 'Design', ['Medicine', 'English', 'Cooking'],
    'В тексте прямо сказано: She studies design.', 'Ищите конкретную информацию после study/studies.');
  choice('A1', 'reading', 'reading-details', 'The library opens at 8:00. The computer room opens at 9:00. Which place opens first?', 'The library', ['The computer room', 'Both at 9:00', 'Neither place opens'],
    'Библиотека открывается в 8:00, раньше компьютерного кабинета в 9:00.', 'first — первым, раньше другого');
  choice('A1', 'reading', 'reading-details', 'Message: "Please bring your notebook tomorrow. You do not need your laptop." What should you bring?', 'A notebook', ['A laptop', 'A camera', 'A printer'],
    'Bring your notebook — принеси тетрадь. Laptop, наоборот, не нужен.', 'Обращайте внимание на do not.');
  choice('A1', 'reading', 'reading-details', 'Tim has a blue bag. His brother has a black bag. Whose bag is blue?', "Tim's", ["His brother's", "His teacher's", "His friend's"],
    'В первом предложении указано, что синяя сумка принадлежит Тиму.', "Tim's bag = сумка Тима");
  input('A1', 'grammar', 'be', 'My friends ___ at the library. (be)', 'are',
    'My friends — множественное число. Подходящая форма be в настоящем времени — are.', 'We/you/they are.');
  input('A1', 'grammar', 'present-simple', 'She ___ in Astana. (live)', 'lives',
    'После she в Present Simple к live добавляется -s: lives.', 'She lives. I live.');
  input('A1', 'grammar', 'plural', 'I have three ___. (book)', 'books',
    'После three нужна форма множественного числа: books.', 'Обычно множественное число: существительное + s.');
  input('A1', 'grammar', 'present-simple', 'He ___ English after work. (study)', 'studies',
    'В study перед y стоит согласная. В форме для he окончание y меняется на -ies.', 'study → studies');
  input('A1', 'grammar', 'can', 'We can ___ the project today. (finish)', 'finish',
    'После can глагол не получает окончаний и не требует to.', 'can finish · can work · can learn');
  input('A1', 'grammar', 'questions', '___ she work here? (do)', 'Does',
    'Для вопроса с she нужна форма Does. Глагол work остаётся в начальной форме.', 'Does he/she/it ...?');

  // A2: past experience, comparisons, plans and practical messages.
  choice('A2', 'grammar', 'past-simple', 'Yesterday I ___ a new client.', 'met', ['meet', 'meeting', 'meets'],
    'Yesterday указывает на завершённое прошлое. Прошедшая форма meet — met.', 'meet → met');
  choice('A2', 'grammar', 'past-simple', 'We ___ finish the report last night.', "didn't", ["don't", "doesn't", "aren't"],
    'Last night требует прошедшего времени. Отрицание: didn’t + начальная форма finish.', "didn't + глагол без окончаний");
  choice('A2', 'grammar', 'present-continuous', 'Please be quiet. I ___ to an online lesson right now.', 'am listening', ['listen', 'listened', 'listens'],
    'Действие происходит прямо сейчас. Нужен Present Continuous: am listening.', 'right now → am/is/are + -ing');
  choice('A2', 'grammar', 'comparatives', 'This screen is ___ than my old one.', 'larger', ['large', 'largest', 'the large'],
    'Для сравнения с than нужна сравнительная степень: larger.', 'large → larger → the largest');
  choice('A2', 'grammar', 'quantifiers', 'How ___ time do we have before the lesson?', 'much', ['many', 'few', 'a few'],
    'Time в значении количества времени — неисчисляемое существительное. Используется how much.', 'how much time · how many lessons');
  choice('A2', 'grammar', 'future-plans', 'We are going ___ a small app this summer.', 'to build', ['build', 'building', 'built'],
    'Конструкция для намерений: be going to + начальная форма глагола.', 'are going to build');
  choice('A2', 'grammar', 'modals', 'You ___ save your work before you close the editor. It is a good idea.', 'should', ['can to', 'should to', 'must to'],
    'Совет выражается через should. После модального глагола to не ставится.', 'should + начальная форма');
  choice('A2', 'grammar', 'object-pronouns', 'I sent the files to Lena. Did she receive ___?', 'them', ['they', 'their', 'theirs'],
    'Files заменяется объектным местоимением them. They используется как подлежащее.', 'They are ready. I sent them.');
  choice('A2', 'grammar', 'infinitives', 'I want ___ my speaking skills.', 'to improve', ['improve', 'improved', 'improving'],
    'После want для следующего действия обычно используется to + глагол.', 'want to learn · want to improve');
  choice('A2', 'grammar', 'past-continuous', 'At 8 p.m. yesterday, I ___ for my exam.', 'was studying', ['am studying', 'study', 'studies'],
    'Описывается процесс в конкретный момент прошлого: was studying.', 'was/were + -ing');
  choice('A2', 'vocabulary', 'work-words', 'The client says: "Please finish the page by Friday." Friday is the ___.', 'deadline', ['password', 'receipt', 'keyboard'],
    'Deadline — крайний срок сдачи работы.', 'meet a deadline — уложиться в срок');
  choice('A2', 'vocabulary', 'technology', 'You want to keep a second copy of important files. You make a ___.', 'backup', ['browser', 'headline', 'meeting'],
    'Backup — резервная копия данных.', 'make a backup · back up your files');
  choice('A2', 'vocabulary', 'communication', 'Which phrase politely asks someone to repeat information?', 'Could you say that again, please?', ['I completely agree with you.', 'Thank you for your help.', 'See you next Monday.'],
    'Could you say that again, please? — вежливая просьба повторить.', 'Could you ...? часто используется в вежливых просьбах.');
  choice('A2', 'vocabulary', 'money', 'You paid for a service and received a document showing the payment. It is a ___.', 'receipt', ['deadline', 'schedule', 'review'],
    'Receipt подтверждает, что оплата уже произведена. Invoice обычно сообщает, какую сумму нужно оплатить.', 'a receipt — чек, подтверждение оплаты');
  choice('A2', 'reading', 'reading-details', 'Notice: "The Tuesday workshop has moved to Thursday. The room and start time stay the same." What has changed?', 'The day', ['The room', 'The start time', 'The teacher'],
    'Занятие перенесли со вторника на четверг. Место и время начала не изменились.', 'stay the same — оставаться прежним');
  choice('A2', 'reading', 'reading-details', 'Email: "Thanks for the draft. The colours look good, but please make the headings larger." What change does the client request?', 'Larger headings', ['Different colours', 'A shorter email', 'A new logo'],
    'Клиент просит увеличить заголовки: make the headings larger.', 'but часто вводит главное уточнение.');
  choice('A2', 'reading', 'reading-details', 'A course costs 20,000 tenge. Students get a discount, but they must show a student card. What is needed for the discount?', 'A student card', ['A laptop', 'A bank statement', 'A printed homework task'],
    'Для скидки нужно предъявить student card — студенческий билет.', 'must show — необходимо показать');
  choice('A2', 'reading', 'reading-details', 'Dana takes the bus on rainy days. When the weather is dry, she walks to university. It is raining today. How will she probably travel?', 'By bus', ['On foot', 'By bicycle', 'By train'],
    'По условию Dana выбирает автобус в дождливые дни. Сегодня дождь.', 'on foot — пешком · by bus — на автобусе');
  input('A2', 'grammar', 'past-simple', 'I ___ the client an email yesterday. (send)', 'sent',
    'Прошедшая форма send — sent.', 'send → sent → sent');
  input('A2', 'grammar', 'comparatives', 'This exercise is ___ than the last one. (easy)', 'easier',
    'При сравнении easy превращается в easier: y заменяется на -ier.', 'easy → easier');
  input('A2', 'grammar', 'present-continuous', 'She is ___ a presentation now. (make)', 'making',
    'В конструкции is + -ing у make исчезает конечная e: making.', 'make → making');
  input('A2', 'grammar', 'past-simple', 'We ___ the instructions carefully last night. (read)', 'read',
    'Прошедшая форма read пишется так же, но произносится /red/.', 'read /riːd/ → read /red/');
  input('A2', 'grammar', 'superlatives', 'This is the ___ room in the building. (quiet)', 'quietest',
    'Превосходная степень quiet обычно quietest. В сочетании с most также возможно most quiet.', 'the quietest room', ['quietest', 'most quiet']);
  input('A2', 'grammar', 'past-simple', 'He ___ a useful question during yesterday’s lesson. (ask)', 'asked',
    'Ask — правильный глагол, его прошедшая форма asked.', 'ask + ed → asked');

  // B1: relationships between events, explanations and decisions.
  choice('B1', 'grammar', 'present-perfect', 'I ___ three versions of the design so far.', 'have created', ['has created', 'am creating', 'will create'],
    'So far связывает результат с настоящим. Present Perfect: have + третья форма created.', 'so far — к настоящему моменту');
  choice('B1', 'grammar', 'present-perfect', 'She has worked here ___ 2023.', 'since', ['for', 'during', 'while'],
    'Since обозначает начальную точку периода: since 2023. For используется с длительностью.', 'since Monday · for two weeks');
  choice('B1', 'grammar', 'first-conditional', 'If the client approves the draft, we ___ development tomorrow.', 'will start', ['started', 'had started', 'have started'],
    'Реальное возможное условие: if + Present Simple, will + начальная форма в результате.', 'If it works, we will continue.');
  choice('B1', 'grammar', 'second-conditional', 'If I had more free time, I ___ another language.', 'would learn', ['will learn', 'have learned', 'am learning'],
    'Гипотетическая ситуация в настоящем: if + Past Simple, would + глагол.', 'If I had time, I would learn.');
  choice('B1', 'grammar', 'passive', 'The new website ___ by our team last month.', 'was launched', ['launched', 'is launching', 'has launch'],
    'Сайт является объектом действия. Пассив в прошлом: was + launched.', 'was/were + третья форма глагола');
  choice('B1', 'grammar', 'relative-clauses', 'The colleague ___ helped me fix the bug works remotely.', 'who', ['which', 'where', 'whose'],
    'Who связывает описание с человеком и является подлежащим в helped me.', 'a person who ... · a tool which ...');
  choice('B1', 'grammar', 'gerunds', 'I enjoy ___ difficult problems with my team.', 'solving', ['solve', 'to solve', 'solved'],
    'После enjoy используется форма с -ing.', 'enjoy doing something');
  choice('B1', 'grammar', 'past-perfect', 'By the time I opened the meeting link, the call ___ already started.', 'had', ['has', 'is', 'was'],
    'Звонок начался раньше другого события в прошлом. Past Perfect: had started.', 'Более раннее прошлое: had + третья форма.');
  choice('B1', 'grammar', 'used-to', 'I ___ take handwritten notes, but now I use a tablet.', 'used to', ['use to', 'am used', 'was use'],
    'Used to описывает привычку в прошлом, которая изменилась.', 'used to + начальная форма');
  choice('B1', 'grammar', 'linking-words', '___ the deadline was tight, we completed the project on time.', 'Although', ['Because of', 'Despite', 'During'],
    'После although может идти полное предложение: the deadline was tight. После despite нужен иной тип конструкции.', 'Although + подлежащее + сказуемое');
  choice('B1', 'vocabulary', 'collocations', 'I have compared the laptops and now need to ___ a decision.', 'make', ['do', 'give', 'take up'],
    'Устойчивое сочетание make a decision означает «принять решение».', 'make a decision');
  choice('B1', 'vocabulary', 'work-words', 'The client’s comments helped us improve the draft. These comments are ___.', 'feedback', ['equipment', 'permission', 'income'],
    'Feedback — обратная связь о выполненной работе.', 'receive feedback · act on feedback');
  choice('B1', 'vocabulary', 'phrasal-verbs', 'We need to ___ why the app keeps crashing.', 'find out', ['give away', 'turn off', 'put on'],
    'Find out — выяснить информацию или причину.', 'find out why/how/when');
  choice('B1', 'vocabulary', 'professional-communication', 'Which sentence politely asks for a clearer explanation?', 'Could you clarify what you mean by “urgent”?', ['You are always wrong about deadlines.', 'Urgent tasks are impossible for everyone.', 'There is nothing to discuss.'],
    'Could you clarify ...? позволяет уточнить значение без обвинения собеседника.', 'clarify — прояснить, уточнить');
  choice('B1', 'reading', 'reading-inference', 'A team tested two homepage layouts. Layout A received more clicks, but users found information faster with Layout B. The team chose B because helping users find information was its main goal. Why did B win?', 'It performed better on the team’s main goal.', ['It received more clicks.', 'It was the only layout tested.', 'Users spent more time searching.'],
    'Главная цель — быстрее находить информацию. По этому показателю выиграл B, хотя кликов было больше у A.', 'Сопоставляйте результат с заявленной целью.');
  choice('B1', 'reading', 'reading-purpose', 'Email: "I can deliver the landing page on Friday. Adding a second language would require two extra days. Please confirm whether you want it included." What is the writer mainly doing?', 'Clarifying how an extra feature affects delivery.', ['Refusing to finish the project.', 'Confirming that both versions are finished.', 'Asking the client to translate every page.'],
    'Автор объясняет влияние дополнительной функции на срок и просит подтвердить объём работы.', 'require — требовать · confirm — подтвердить');
  choice('B1', 'reading', 'reading-inference', 'Students could watch recorded lessons at any time. However, many still attended the live sessions because they could ask questions immediately. What advantage did live sessions offer?', 'Immediate interaction with the teacher.', ['No need for an internet connection.', 'Access at any time of day.', 'Shorter recordings for every student.'],
    'В тексте указана возможность сразу задавать вопросы. Остальные преимущества не заявлены.', 'Выбирайте вывод, подтверждённый текстом.');
  choice('B1', 'reading', 'reading-details', 'The internship is unpaid, lasts eight weeks, and requires attendance on Mondays and Wednesdays. Applicants must submit a portfolio; previous employment is optional. Which item is required?', 'A portfolio', ['Previous employment', 'A payment from the applicant', 'Daily attendance'],
    'Must submit означает обязательное требование. Previous employment is optional — опыт работы необязателен.', 'required — обязательный · optional — по выбору');
  input('B1', 'grammar', 'present-perfect', 'I have ___ this problem before. (see)', 'seen',
    'После have в Present Perfect нужна третья форма: see → saw → seen.', 'have/has + третья форма');
  input('B1', 'grammar', 'passive', 'The files were ___ to the wrong folder. (move)', 'moved',
    'В пассиве после were используется третья форма moved.', 'were moved — были перемещены');
  input('B1', 'grammar', 'gerunds', 'She suggested ___ the meeting until tomorrow. (postpone)', 'postponing',
    'После suggest перед действием используется -ing. Конечная e в postpone убирается.', 'suggest doing something');
  input('B1', 'grammar', 'second-conditional', 'If the room ___ quieter, I would concentrate better. (be)', 'were',
    'В гипотетическом условии традиционно используется were. В разговорном английском с the room встречается was.', 'If it were ..., I would ...', ['were', 'was']);
  input('B1', 'grammar', 'past-perfect', 'They had already ___ when I arrived. (leave)', 'left',
    'После had нужна третья форма leave — left.', 'leave → left → left');
  input('B1', 'grammar', 'word-formation', 'The instructions were clear and ___. (help)', 'helpful',
    'После clear and нужно прилагательное. Helpful — полезный, помогающий.', 'help → helpful');

  // B2: nuance, argument, advanced structures and evidence.
  choice('B2', 'grammar', 'third-conditional', 'If we had tested the payment form last Monday, we ___ the error before Tuesday’s launch.', 'would have found', ['will find', 'would find', 'are finding'],
    'Нереальное условие в прошлом: if + had + третья форма; результат — would have + третья форма.', 'If we had checked, we would have noticed.');
  choice('B2', 'grammar', 'modal-deduction', 'The office is empty and all the lights are off. Everyone ___ gone home.', 'must have', ['must to have', 'has must', 'must having'],
    'Must have + третья форма выражает уверенный вывод о прошлом: вероятно, все ушли.', 'must have done — должно быть, сделал');
  choice('B2', 'grammar', 'inversion', 'Not only ___ the deadline, but we also reduced the cost.', 'did we meet', ['we met', 'we have met', 'we had met'],
    'После вынесенного в начало Not only используется инверсия: did + подлежащее + начальная форма.', 'Not only did we ..., but we also ...');
  choice('B2', 'grammar', 'concession', '___ having limited resources, the team delivered a reliable product.', 'Despite', ['Although', 'Even though', 'Whereas'],
    'Перед having без отдельного подлежащего подходит despite. Although и even though обычно вводят полное предложение.', 'despite + существительное / -ing');
  choice('B2', 'grammar', 'relative-clauses', 'The report, ___ was published yesterday, challenges the original forecast.', 'which', ['that', 'what', 'whose'],
    'В дополнительном придаточном с запятыми для неодушевлённого предмета используется which. That в такой конструкции не подходит.', 'Дополнительная информация: , which ... ,');
  choice('B2', 'grammar', 'wish', 'I wish I ___ more careful when I sent that email yesterday.', 'had been', ['have been', 'will be', 'would been'],
    'Сожаление о прошлом после I wish выражается через Past Perfect: had been.', 'I wish I had done ...');
  choice('B2', 'grammar', 'future-perfect', 'By the time the client arrives tomorrow, we ___ the final tests.', 'will have completed', ['had completed', 'completed', 'have completed'],
    'Действие завершится к определённому будущему моменту. Future Perfect: will have completed.', 'by a future point → will have + третья форма');
  choice('B2', 'grammar', 'verb-patterns', 'The manager insisted on ___ the contract before work began.', 'reviewing', ['review', 'to review', 'reviewed'],
    'После предлога on действие выражается формой -ing: insisted on reviewing.', 'insist on doing something');
  choice('B2', 'grammar', 'mixed-conditional', 'If I had accepted that job last year, I ___ in another city now.', 'would be living', ['had lived', 'will live', 'have lived'],
    'Прошлое условие приводит к воображаемому результату сейчас. Поэтому результат — would be living.', 'Прошлое условие → результат в настоящем');
  choice('B2', 'grammar', 'contrast', 'The new system is faster, ___ the old one is easier to maintain.', 'whereas', ['because of', 'despite', 'in spite of'],
    'Whereas соединяет два предложения и подчёркивает различие между ними.', 'whereas — тогда как');
  choice('B2', 'vocabulary', 'collocations', 'The reviewer ___ concerns about how the app stores personal data.', 'raised', ['rose', 'grew', 'lifted up'],
    'Raise concerns — высказать опасения. Rise не принимает такой прямой объект.', 'raise concerns about something');
  choice('B2', 'vocabulary', 'argumentation', 'A claim supported by several independent sources is more ___.', 'credible', ['portable', 'edible', 'invisible'],
    'Credible означает «заслуживающий доверия, правдоподобный».', 'credible evidence · a credible explanation');
  choice('B2', 'vocabulary', 'work-words', 'Choosing a lighter laptop but accepting a smaller screen is a ___.', 'trade-off', ['breakdown', 'takeover', 'checkout'],
    'Trade-off — компромисс, при котором преимущество получают ценой другого свойства.', 'a trade-off between weight and screen size');
  choice('B2', 'vocabulary', 'hedging', 'Which sentence expresses a cautious conclusion rather than certainty?', 'The results suggest that shorter lessons may help.', ['The results prove that every learner improves.', 'Shorter lessons always work for everyone.', 'There can be no doubt about the outcome.'],
    'Suggest и may ограничивают уверенность утверждения. Остальные варианты заявляют категорический результат.', 'suggest · may · appears to');
  choice('B2', 'reading', 'reading-evidence', 'A study found that students who used a planning app submitted more assignments on time. However, the students chose whether to use the app, and their previous habits were not measured. Which conclusion is justified?', 'App use was associated with timely submission, but causation is uncertain.', ['The app definitely caused every improvement.', 'Planning apps have no possible benefit.', 'The study proved that previous habits were identical.'],
    'Наблюдается связь, но добровольный выбор и неизвестные прежние привычки мешают уверенно установить причину.', 'association не равна доказанной causation.');
  choice('B2', 'reading', 'reading-implication', 'A company advertises an unlimited design plan. Its terms state that only one request can be active at a time and each revision enters the same queue. What should a customer infer?', 'Unlimited requests do not mean unlimited simultaneous work.', ['All revisions are completed immediately.', 'Only one request is allowed during the subscription.', 'The company never accepts revisions.'],
    'Число запросов может не ограничиваться, но условия ограничивают параллельную работу и скорость очередью.', 'Различайте объём услуги и условия её выполнения.');
  choice('B2', 'reading', 'reading-purpose', 'An author argues that digital tools can improve access to education, then describes unreliable internet and inaccessible interfaces. She concludes that technology helps only when these barriers are addressed. What is her position?', 'Supportive, but conditional on removing access barriers.', ['Entirely opposed to digital education.', 'Convinced that access problems no longer exist.', 'Interested only in reducing teachers’ salaries.'],
    'Автор признаёт преимущества, но ставит условие: устранить барьеры доступа.', 'conditional support — поддержка при определённых условиях');
  choice('B2', 'reading', 'reading-evidence', 'Two teams report average task times of 12 and 18 minutes. The first team handled simple edits; the second handled complex integrations. Which additional information is most necessary for a fair productivity comparison?', 'How comparable the tasks were in scope and difficulty.', ['Whether the teams used the same wallpaper.', 'Which team had a shorter name.', 'The colour of the office walls.'],
    'Без сопоставимой сложности и объёма задач разница во времени не показывает, какая команда продуктивнее.', 'Сравнивайте сопоставимые условия.');
  input('B2', 'grammar', 'third-conditional', 'We would have ___ the issue if we had checked the logs. (notice)', 'noticed',
    'После would have нужна третья форма noticed.', 'would have + третья форма');
  input('B2', 'grammar', 'word-formation', 'The team questioned the ___ of the survey results. (reliable)', 'reliability',
    'После the и перед of здесь нужно существительное reliability — надёжность.', 'reliable → reliability');
  input('B2', 'grammar', 'verb-patterns', 'The delay prevented us from ___ on time. (launch)', 'launching',
    'После prevent someone from используется форма -ing.', 'prevent someone from doing something');
  input('B2', 'grammar', 'wish', 'She wishes she had ___ the requirements more carefully. (read)', 'read',
    'После had нужна третья форма read. Написание не меняется, произношение — /red/.', 'wish + had + третья форма');
  input('B2', 'grammar', 'word-formation', 'Clear milestones make progress easier to ___. (measurement)', 'measure',
    'После easier to нужен глагол. Measurement — существительное, measure — глагол «измерять».', 'measurement → measure');
  input('B2', 'grammar', 'participles', 'Having ___ the research, we revised our original proposal. (complete)', 'completed',
    'Having completed обозначает действие, завершённое до основного действия revised.', 'Having + третья форма, ...');

  prompt('A1', 'My usual day', 'Опишите обычный учебный или рабочий день. Пишите короткими полными предложениями.',
    ['When do you get up?', 'What do you do during the day?', 'What do you do in the evening?'],
    [['usually', 'обычно'], ['get up', 'вставать'], ['lesson', 'урок, занятие'], ['evening', 'вечер']],
    'I usually get up at eight. I have breakfast and go to university. My lessons start at nine. After class, I study English at home. In the evening, I watch a video or talk to my friends.');
  prompt('A1', 'My workspace', 'Расскажите о месте, где вы учитесь или работаете: что там есть и чем вы пользуетесь.',
    ['Where do you study?', 'What is on your desk?', 'Do you like this place?'],
    [['desk', 'письменный стол'], ['next to', 'рядом с'], ['notebook', 'тетрадь'], ['quiet', 'тихий']],
    'I study in my room. My desk is next to the window. There is a laptop and a notebook on it. I have a small lamp. I like this place because it is quiet in the morning.');
  prompt('A1', 'A place in my city', 'Опишите одно знакомое место: парк, библиотеку, кафе или университет.',
    ['What is the place?', 'Where is it?', 'What do you do there?'],
    [['near', 'рядом с'], ['park', 'парк'], ['walk', 'гулять, идти пешком'], ['weekend', 'выходные']],
    'There is a small park near my home. It has trees and a lake. I go there with my friends at the weekend. We walk and talk. I like the park because it is quiet and beautiful.');
  prompt('A1', 'Why I learn English', 'Напишите, где вам нужен английский и как вы сейчас занимаетесь.',
    ['Why do you want to learn English?', 'When do you practise?', 'What is difficult for you?'],
    [['learn', 'учить, изучать'], ['practise', 'практиковаться'], ['understand', 'понимать'], ['difficult', 'трудный']],
    'I learn English for my studies and my future job. I practise in the evening. I read short texts and learn new words. Speaking is difficult for me. I want to understand videos and talk to people from other countries.');
  prompt('A1', 'Someone I know', 'Опишите знакомого человека. Можно использовать вымышленное имя.',
    ['Who is this person?', 'What do they do?', 'What do you like doing together?'],
    [['friendly', 'дружелюбный'], ['classmate', 'одногруппник'], ['together', 'вместе'], ['help', 'помогать']],
    'My friend is a student. His name is Amir. He studies design and likes music. He is friendly and often helps me with my projects. We sometimes go to a café after class. We talk about films and our plans.');
  prompt('A1', 'My ideal weekend', 'Расскажите, как вам нравится проводить свободный день.',
    ['Where do you want to go?', 'Who do you want to see?', 'What do you want to do?'],
    [['free time', 'свободное время'], ['relax', 'отдыхать'], ['cook', 'готовить еду'], ['visit', 'посещать']],
    'On my ideal weekend, I get up late and cook breakfast. I have time to read a book. In the afternoon, I visit a friend. We play a game or watch a film. In the evening, I relax at home.');

  prompt('A2', 'An app I use', 'Опишите полезное приложение и объясните, как оно помогает в обычной жизни.',
    ['What does the app do?', 'When do you use it?', 'What would you like to change?'],
    [['useful', 'полезный'], ['reminder', 'напоминание'], ['save time', 'экономить время'], ['feature', 'функция']],
    'I use a calendar app to organise my studies. I add lessons, project deadlines and important meetings. The app sends me reminders before each event. This helps me remember my plans and saves time. I check it every morning. I like the simple design, but I would like larger text. Sometimes the screen looks too crowded when I have many tasks.');
  prompt('A2', 'A project I finished', 'Расскажите о небольшом завершённом проекте: учебном, рабочем или личном.',
    ['What did you make?', 'What was difficult?', 'What did you learn?'],
    [['project', 'проект'], ['finish', 'закончить'], ['solve', 'решить'], ['proud', 'гордый']],
    'Last month, I made a simple website for a class project. I chose the colours and wrote the text myself. At first, the page did not look good on my phone. I changed the layout and tested it again. The project took three evenings. I learned to check different screen sizes. I felt proud when everything worked well.');
  prompt('A2', 'A different weekend', 'Опишите выходные, которые отличались от обычных. Используйте прошедшее время.',
    ['Where did you go?', 'What happened?', 'Would you like to do it again?'],
    [['last weekend', 'в прошлые выходные'], ['decide', 'решить'], ['spend time', 'проводить время'], ['enjoy', 'получать удовольствие']],
    'Last weekend, my friends and I visited a small exhibition. We usually stay at home, so this was something different. We saw paintings by local artists and took some photos. After that, we had lunch and discussed our favourite pictures. I enjoyed the afternoon because I learned something new. I would like to visit another exhibition next month.');
  prompt('A2', 'A better study routine', 'Опишите свою учебную привычку и одно изменение, которое хотите попробовать.',
    ['When do you usually study?', 'What distracts you?', 'What are you going to change?'],
    [['routine', 'привычный порядок'], ['distract', 'отвлекать'], ['take a break', 'сделать перерыв'], ['plan', 'планировать']],
    'I usually study after dinner, but I often check my phone. Then a short break becomes a long one. I am going to put my phone in another room and study for twenty minutes first. After that, I can take a short break. I also want to write a small plan before I start. These changes seem easy to try.');
  prompt('A2', 'Two places to live', 'Сравните два города или два района. Можно описывать вымышленные места.',
    ['Which place is quieter?', 'Which place has better transport?', 'Where would you prefer to live?'],
    [['quieter', 'тише'], ['more expensive', 'дороже'], ['transport', 'транспорт'], ['prefer', 'предпочитать']],
    'My old neighbourhood was quieter than the city centre. There were fewer cars and more trees. However, the bus journey to university was much longer. The centre is busier and more expensive, but most places are close to each other. At the moment, I prefer living near university. I can walk to class and spend less time travelling.');
  prompt('A2', 'A problem I solved', 'Расскажите о понятной бытовой или технической проблеме и своих действиях.',
    ['What was the problem?', 'What did you do first?', 'How did you solve it?'],
    [['problem', 'проблема'], ['check', 'проверять'], ['instructions', 'инструкции'], ['finally', 'наконец']],
    'Yesterday, I could not open a document on my laptop. First, I checked the file name and tried another program. That did not help. Then I asked my classmate to send the document again. The new copy opened without any problems. I was happy because I needed it for my homework. Now I always keep a second copy of important files.');

  prompt('B1', 'Should students have a part-time job?', 'Сформулируйте мнение, рассмотрите одно преимущество и одну сложность, добавьте пример.',
    ['What can students gain from working?', 'How might a job affect their studies?', 'What balance would you recommend?'],
    [['part-time job', 'работа с неполной занятостью'], ['gain experience', 'получить опыт'], ['workload', 'нагрузка'], ['balance', 'баланс, сочетание']],
    'I think a part-time job can be useful for university students if the working hours are reasonable. Students can earn some money and gain experience that they cannot get from lectures alone. For example, working with clients can teach them to communicate clearly and organise their time. However, a job can become a problem when it leaves too little time for studying or sleeping. I would recommend starting with a few hours a week and checking whether it affects important assignments. Employers should also understand that students sometimes need extra time during exams. A useful job should support a student’s development rather than take over their entire schedule.');
  prompt('B1', 'Working together from different places', 'Объясните, что помогает команде работать удалённо. Предложите конкретные правила.',
    ['What is convenient about remote teamwork?', 'What problems can appear?', 'Which rules could help?'],
    [['remote', 'удалённый'], ['share updates', 'сообщать об изменениях'], ['responsibility', 'ответственность, обязанность'], ['misunderstanding', 'недопонимание']],
    'Remote teamwork allows people to contribute from different places, which can make a project more flexible. However, it is easy to misunderstand a short message or assume that someone else is handling a task. I would give every task a clear owner and a deadline. The team should keep important files in one shared place and send a short update when something changes. A weekly call could help with difficult questions, while simple updates can stay in writing. These rules would make responsibilities clearer without requiring everyone to be online all day. In my view, reliable communication matters more than using many different applications.');
  prompt('B1', 'Choosing a device on a limited budget', 'Опишите, как выбирать устройство под свои задачи. Обоснуйте приоритеты без указания конкретных цен.',
    ['Which tasks must the device handle?', 'Which features are essential?', 'What could you compromise on?'],
    [['limited budget', 'ограниченный бюджет'], ['essential', 'необходимый'], ['compare', 'сравнивать'], ['compromise', 'идти на компромисс']],
    'Before buying a device, I would write down the tasks I need it for. A student who mainly reads documents has different needs from someone who edits videos. I would compare several options using the same list of essential features. For me, a comfortable keyboard, enough memory and a manageable weight would matter more than an impressive appearance. I could accept an older model if it still handled my work reliably. I would also check its condition and possible repair costs. This approach would help me spend money on useful features instead of choosing a device only because it is popular.');
  prompt('B1', 'A skill that took time to learn', 'Опишите процесс освоения навыка: начало, трудность, полезное изменение и результат.',
    ['What did you find difficult at first?', 'What helped you improve?', 'What advice would you give a beginner?'],
    [['improve gradually', 'улучшаться постепенно'], ['attempt', 'попытка'], ['feedback', 'обратная связь'], ['keep practising', 'продолжать практиковаться']],
    'Learning to explain my design decisions took more time than learning the software itself. At first, I said that a layout looked better without explaining why. My feedback sessions were confusing because other people did not understand my choices. I started writing down the purpose of each section before presenting it. I also practised describing how a change could help a visitor find information. My explanations gradually became clearer. I still need practice, but I feel more confident now. I would advise beginners to ask for specific feedback and focus on one improvement at a time. Progress becomes easier to notice when the goal is clear.');
  prompt('B1', 'Learning with an AI assistant', 'Предложите разумный способ использовать AI при обучении. Объясните пользу и ограничение.',
    ['Which learning tasks could AI help with?', 'What should the learner still do?', 'How would you check an answer?'],
    [['explanation', 'объяснение'], ['rely on', 'полагаться на'], ['check a source', 'проверить источник'], ['independently', 'самостоятельно']],
    'An AI assistant can be a useful part of a study routine. I would use it to explain an unfamiliar idea, suggest practice questions or give feedback on a draft. However, I would still try the task myself before asking for help. Otherwise, it would be difficult to know what I actually understand. When an answer includes an important fact, I would compare it with course materials or a reliable source. I would also ask for a simpler explanation if the first one was unclear. For me, the best result would be the ability to solve a similar problem independently later.');
  prompt('B1', 'One change for my university', 'Предложите одно улучшение университетской жизни и объясните, как оценить результат.',
    ['What problem would you address?', 'What change would you introduce?', 'How would you know whether it helped?'],
    [['introduce', 'ввести, внедрить'], ['clear schedule', 'понятное расписание'], ['notification', 'уведомление'], ['measure progress', 'измерять прогресс']],
    'I would introduce a single place for important timetable changes at my university. Students sometimes receive different information from different group chats, so it is difficult to know which message is correct. The official page could show the current room, start time and date of the latest update. Students could choose to receive notifications for their own group. Before introducing this system everywhere, I would test it with a few groups for one month. We could ask students whether they missed fewer changes and whether the page was easy to use. A small, reliable improvement would be more useful than a complicated system that nobody updates.');

  prompt('B2', 'How should universities assess practical skills?', 'Постройте аргумент: позиция, альтернативный подход, пример и обоснованный вывод.',
    ['What can an exam measure well?', 'What can a practical project reveal?', 'How could an assessment combine both fairly?'],
    [['assessment', 'оценивание'], ['demonstrate competence', 'показать компетентность'], ['criteria', 'критерии'], ['individual contribution', 'личный вклад']],
    'Universities should use a combination of examinations and practical projects to assess professional skills. An examination can reveal whether a student understands essential concepts without relying on a team. However, it may show little about their ability to manage an extended task, respond to feedback or explain a design decision. A practical project can provide evidence of these abilities, but it creates other difficulties. Students may have unequal access to equipment, and a polished result does not necessarily reveal each person’s contribution. I would therefore combine a manageable project with a short individual discussion. Students could explain their choices, describe a problem they encountered and demonstrate a small change. Clear criteria should be published in advance, and the university should provide access to necessary resources. This approach would not remove every source of unfairness, but it would make the final judgement depend on several forms of evidence rather than one performance on one day.');
  prompt('B2', 'Convenience and digital privacy', 'Обсудите обмен персональных данных на удобство. Разделите необходимые и необязательные данные.',
    ['When is sharing data necessary?', 'What would meaningful consent look like?', 'Which limits should a service respect?'],
    [['consent', 'согласие'], ['data collection', 'сбор данных'], ['proportionate', 'соразмерный'], ['withdraw permission', 'отозвать разрешение']],
    'Digital services often become more convenient when they know something about their users. A navigation tool, for example, needs a location to suggest a route. The important question is whether the information collected is proportionate to the function being provided. I would expect an application to explain what it needs, why it needs it and how long it keeps it. Meaningful consent should also include a practical way to decline optional collection or withdraw permission later. Some people argue that detailed explanations create too much friction. This is a real design challenge, but hiding the choice is not a convincing solution. A short explanation at the moment a feature is used may be more helpful than a long document presented only during registration. In my view, convenience and privacy can support each other when a service asks for limited information and gives users understandable control over it.');
  prompt('B2', 'Clear rules for freelance projects', 'Предложите правила сотрудничества, учитывая интересы и заказчика, и исполнителя.',
    ['What should be agreed before work begins?', 'How should additional requests be handled?', 'What makes a process fair to both sides?'],
    [['scope of work', 'объём работ'], ['milestone', 'этап проекта'], ['revision', 'правка'], ['mutual expectations', 'взаимные ожидания']],
    'A successful freelance project needs clear expectations as well as technical skill. Before work begins, both sides should agree on the deliverables, the payment schedule and the number or scope of revisions. These details help the client understand what they are buying and help the freelancer estimate the effort involved. However, a project may reveal needs that neither side anticipated. I would allow additional requests through a simple change process: describe the new work, explain its effect on the price and deadline, and obtain agreement before continuing. Critics may see this as unnecessary formality for a small task. Yet the process can be brief and written in ordinary language. It does not need to create distance between the people involved. Regular demonstrations and clear records can make cooperation easier. A fair arrangement should give the client a chance to review progress while ensuring that completed work and extra effort are recognised.');
  prompt('B2', 'Does AI change what creativity means?', 'Рассмотрите роль AI в творческой работе. Дайте критерий качества, выходящий за рамки скорости.',
    ['Which parts of creative work can be automated?', 'What decisions remain important?', 'How would you judge the final result?'],
    [['creative judgement', 'творческое суждение'], ['generate alternatives', 'создавать варианты'], ['originality', 'оригинальность'], ['intention', 'замысел']],
    'AI tools can generate many visual or written alternatives quickly, but this does not make every result equally valuable. Creative work also involves deciding what a project is trying to communicate, who it is for and why a particular choice is appropriate. A designer might use generated ideas as a starting point while taking responsibility for selection, revision and the final message. The strongest objection is that easy generation may encourage people to accept the first attractive result. This could produce work that looks polished but has little connection to its purpose. I would judge a project by the quality of its decisions rather than by the number of hours spent producing it. Can the creator explain the result? Does it serve the audience? Has it been reviewed carefully? These questions leave room for new tools while preserving the importance of intention, understanding and individual judgement.');
  prompt('B2', 'Should a city prioritise public transport?', 'Обсудите транспортную политику на уровне аргументов и примеров, без неподтверждённых статистических данных.',
    ['Who could benefit from better public transport?', 'What concerns might drivers raise?', 'How could a city evaluate a pilot project?'],
    [['accessibility', 'доступность'], ['commute', 'поездка на работу или учёбу'], ['allocate resources', 'распределять ресурсы'], ['pilot project', 'пробный проект']],
    'I would support greater investment in reliable public transport, particularly on routes that connect residential areas with universities and workplaces. A useful service should give residents a practical choice, including those who cannot drive or do not own a car. However, prioritising buses can create concerns if road space is reduced before a reasonable alternative is available. Drivers may feel that the inconvenience is immediate while the promised benefits are uncertain. A city could address this by testing changes on one route and publishing clear evaluation criteria. These might include journey reliability, accessibility and the experience of passengers and nearby residents. The pilot should run long enough to reveal everyday problems, and feedback should lead to adjustments. My support would therefore depend on implementation rather than on a slogan. The aim should be to help people reach important places predictably, while considering the different needs of the communities affected.');
  prompt('B2', 'Can an app help us protect our attention?', 'Оцените идею добровольного ограничения отвлекающих приложений. Рассмотрите и пользу, и возможный побочный эффект.',
    ['What problem would the restriction address?', 'When could it become unhelpful?', 'How should the user remain in control?'],
    [['distraction', 'отвлечение'], ['self-imposed', 'добровольно установленный'], ['sustainable habit', 'устойчивая привычка'], ['emergency access', 'экстренный доступ']],
    'An application that limits access to distractions could help someone begin a task they keep postponing. A self-imposed restriction creates a pause between the impulse to open an app and the action itself. Nevertheless, the restriction should support a meaningful activity rather than become the entire reason for doing it. If the required task is repetitive or badly matched to the user’s ability, they may focus on escaping the barrier as quickly as possible. I would therefore connect a modest daily task with useful feedback and visible progress. The user should choose which applications are affected and retain access to essential services. An emergency pause would also be sensible, since real life does not always follow a schedule. The long-term goal should be a sustainable habit that gradually requires less external pressure. I would evaluate the tool by the quality and consistency of practice, not simply by the number of minutes it blocks.');

  window.LESSON_CONTENT = {questions, prompts};
})();
