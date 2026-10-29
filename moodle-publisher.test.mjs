import {test} from 'node:test';import {strict as assert} from 'node:assert';import {createMoodlePublisher} from './moodle-publisher.mjs';
const q={id:'abcd-1',type:'single',stem:'题目',options:['a','b'],answers:[0],points:1};
test('发送固定 XML 并核对题目身份和 Moodle 回执',async()=>{let payload;const run=createMoodlePublisher({invoke:async p=>{payload=p;return JSON.stringify({ok:true,name:'草稿-abcd-1',moodleId:8})}});assert.deepEqual(await run(q),{moodleId:8});assert.match(payload.xml,/<quiz>/);assert.equal(payload.name,'草稿-abcd-1')});
test('身份不匹配、回执不完整或多选评分未定均不当作成功',async()=>{const run=createMoodlePublisher({invoke:async()=>JSON.stringify({ok:true,name:'other',moodleId:8})});await assert.rejects(()=>run(q));await assert.rejects(()=>run({...q,type:'multiple',answers:[0,1]}));});
