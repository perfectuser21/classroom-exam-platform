import {test} from 'node:test';import {strict as assert} from 'node:assert';import {createMoodleClose} from './moodle-close.mjs';
const plan={paperId:'p1',modules:[{version:'A',courseModuleId:2,quizId:3}]};
test('只接受与试卷一致且已关闭的回执',async()=>{const fn=createMoodleClose({invoke:async()=>JSON.stringify({ok:true,paperId:'p1',closed:true,modules:[{version:'A',id:2,quizId:3}]})});assert.deepEqual(await fn(plan),plan.modules)});
test('未关闭或试卷不匹配不能报告成功',async()=>{for(const x of [{ok:true,paperId:'p1',closed:false,modules:[]},{ok:true,paperId:'p1',closed:true,modules:[{version:'A',id:2,quizId:4}]}])await assert.rejects(()=>createMoodleClose({invoke:async()=>JSON.stringify(x)})(plan))});
