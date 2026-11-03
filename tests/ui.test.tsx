import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {Entry,Evaluation,LanguageProvider} from '../app/study';
const question={id:'UI_FIXTURE',game:'dota',duration:20,labels:[{id:'defend',en:'defend',zh:'防守',definition_en:'Protect a position.',definition_zh:'保护一个位置。'}],task_en:'What is this side trying to do?',task_zh:'这一方想要做什么？',description_en:'Hold the tower.',description_zh:'守住防御塔。',video_url:'/test-fixture.mp4'};
const render=(language:'en'|'zh',child:React.ReactNode)=>renderToStaticMarkup(<LanguageProvider initialLanguage={language}>{child}</LanguageProvider>);
test('English and Chinese participant screens have real localized interface copy',()=>{
 const en=render('en',<Entry config={{status:'draft',config:{mainPerParticipant:10}}} onStart={()=>{}} busy={false} error=""/>);
 const zh=render('zh',<Entry config={{status:'draft',config:{mainPerParticipant:10}}} onStart={()=>{}} busy={false} error=""/>);
 assert.match(en,/Enter the study/);assert.match(en,/familiar games/);assert.doesNotMatch(en,/>10<|10 main|minimum/);
 assert.match(zh,/进入问卷/);assert.doesNotMatch(en,/续答码|resume code|先看一个示例/);
});
test('blind stage hides the annotation even if a draft requests the second page',()=>{
 const blind={...question,blind_mode:true,label_choices:[question.labels[0]]};
 const before=render('en',<Evaluation question={blind} draft={{page:1}} onSubmit={()=>{}}/>);
 assert.match(before,/What is the target trying to do/);assert.match(before,/type="checkbox"/);assert.doesNotMatch(before,/Hold the tower|守住防御塔|name="description"/);
 const after=render('en',<Evaluation question={{...blind,blind_locked:true,blind_response:{labels:['defend'],status:'selected'}}} onSubmit={()=>{}}/>);
 assert.match(after,/Hold the tower/);assert.match(after,/守住防御塔/);assert.match(after,/name="description"/);assert.doesNotMatch(after,/type="checkbox"/);
});

test('video buffers the current clip and exposes an accessible loading indicator',async()=>{
 const {Player}=await import('../app/study');
 const html=render('en',<Player src="/api/media/test_clip" onLoaded={()=>{}} onTime={()=>{}}/>);
 assert.match(html,/preload="auto"/);assert.match(html,/role="status"/);assert.match(html,/Loading video/);assert.match(html,/Reload/);
});
