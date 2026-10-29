import {test} from 'node:test';import {strict as assert} from 'node:assert';import {createMoodleRelease} from './moodle-release.mjs';
const plan={paperId:'p1',groups:[{version:'A',courseModuleId:2,quizId:3,groupId:4,studentIds:[1,2,3,4,5]}]};
test('只接受与计划一致的开放回执',async()=>{const run=createMoodleRelease({invoke:async()=>JSON.stringify({ok:true,paperId:'p1',open:true,modules:[{version:'A',id:2,quizId:3}]})});assert.deepEqual(await run(plan),[{version:'A',courseModuleId:2,quizId:3}])});
test('未开放、身份或试卷编号不符时不报告成功',async()=>{for(const r of [{ok:true,paperId:'p1',open:false,modules:[]},{ok:true,paperId:'p1',open:true,modules:[{version:'A',id:2,quizId:9}]}])await assert.rejects(()=>createMoodleRelease({invoke:async()=>JSON.stringify(r)})(plan))});
