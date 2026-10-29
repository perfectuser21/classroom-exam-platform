import {test} from 'node:test';import {strict as assert} from 'node:assert';import {examPaths} from './exam-paths.mjs';
test('为每名考生提供相互隔离的素材和答案目录',()=>{let x=examPaths('exam-01','student-01');assert.equal(x.materials,'E:\\ClassroomExam\\exam-01\\student-01\\materials');assert.equal(x.answers,'E:\\ClassroomExam\\exam-01\\student-01\\answers');assert.notEqual(examPaths('exam-01','student-02').answers,x.answers)});
test('拒绝路径穿越、绝对路径、Windows 保留名及过长标识',()=>{for(const x of ['../escape','C:\\x','a/b','CON','con.txt','trailing.','a'.repeat(65),''])assert.throws(()=>examPaths('exam-01',x));});
