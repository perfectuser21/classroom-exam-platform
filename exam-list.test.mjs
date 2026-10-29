import test from 'node:test';
import assert from 'node:assert/strict';
import {groupExams} from './exam-list.mjs';
test('已在本工作台创建的考试单独展示，其他考试仍可访问',()=>{
 const exams=[{id:1,name:'旧考试'},{id:2,name:'正式考试'},{id:3,name:'另一套卷'}];
 const jobs=[{papers:[{status:'created',quizId:2},{status:'unknown',quizId:3}]}];
 assert.deepEqual(groupExams(exams,jobs),{managed:[exams[1]],other:[exams[0],exams[2]]});
});
test('发布记录不可用时不隐藏考试',()=>{
 const exams=[{id:1,name:'考试'}];
 assert.deepEqual(groupExams(exams,null),{managed:exams,other:[]});
});
