import {examPaths} from './exam-paths.mjs';
export function practicalExamQuestions(exam,materials,tasks){examPaths(exam,'student');if(!Array.isArray(materials)||!Array.isArray(tasks))throw Error('题目记录不可用');const ids=new Set(materials.filter(x=>x?.exam===exam&&typeof x.taskbookId==='string').map(x=>x.taskbookId));return tasks.filter(x=>ids.has(x.id)).map(x=>structuredClone(x))}
