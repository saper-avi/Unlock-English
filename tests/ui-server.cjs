'use strict';
// Explicit fixture server for UI tests only. Never calls OpenAI.
const {createServer,loadContent}=require('../backend/server.cjs');const {ReviewService}=require('../backend/service.cjs');const F=require('../web/feedback.js');
const config={enabled:true,apiKey:'TEST_ONLY',model:'TEST_FIXTURE_NOT_A_REAL_MODEL',accessToken:'ui-test-token-not-for-production-000000',dailyLimit:50};
const content=loadContent();
const service=new ReviewService({content,config,provider:async()=>{await new Promise(r=>setTimeout(r,150));return F.demo().feedback;}});
const server=createServer({config,content,service});server.listen(4181,'127.0.0.1',()=>console.log('UI fixture server ready on 4181. NO real AI calls.'));
