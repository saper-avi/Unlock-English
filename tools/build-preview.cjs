'use strict';
// A directory preview keeps all original book pages; no missing relative assets.
const fs=require('node:fs'); const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dest=path.join(root,'dist','Unlock-English-0.4-preview');
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(path.join(root,'web'),dest,{recursive:true});
fs.writeFileSync(path.join(dest,'README-preview.txt'),'Unlock English 0.4\nЭто папка веб-просмотра, не APK и не один автономный HTML.\nДля запуска используй npm run preview из проекта или обычный локальный статический сервер.\nИИ и Android-фокус в статическом просмотре не подключены.\n');
console.log('Created full preview directory: '+dest);
