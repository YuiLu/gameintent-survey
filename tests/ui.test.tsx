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
test('label and description judgments are paged while both annotation languages remain visible',()=>{
 const label=render('en',<Evaluation question={question} onSubmit={()=>{}}/>);
 const description=render('en',<Evaluation question={question} draft={{page:1,label_support:'supported'}} onSubmit={()=>{}}/>);
 assert.match(label,/Does the video support the intent label/);assert.match(label,/name="label"/);assert.doesNotMatch(label,/name="description"/);
 assert.match(description,/Is the intent description visually grounded/);assert.match(description,/name="description"/);assert.doesNotMatch(description,/name="label"/);
 for(const html of [label,description]){assert.match(html,/Hold the tower/);assert.match(html,/守住防御塔/);assert.match(html,/Protect a position/);assert.match(html,/保护一个位置/);}
});
