import {runtimeBin} from './runtime-bins.mjs';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
export function createMoodleQuizPublisher({invoke}){
 return async (draft,paper)=>{
  const input={paperId:draft.id,name:draft.name,duration:draft.duration,deadline:draft.deadline||0,version:paper.version,questions:paper.questions};let result;try{result=JSON.parse(await invoke(input))}catch{throw Error('Moodle 试卷回执不可用')}
  if(result.ok!==true||result.paperId!==draft.id||result.version!==paper.version||result.hidden!==true||!Number.isSafeInteger(result.quizId)||result.quizId<1||!Number.isSafeInteger(result.courseModuleId)||result.courseModuleId<1)throw Error('Moodle 试卷回执无效');
  return {quizId:result.quizId,courseModuleId:result.courseModuleId};
 };
}
export function localMoodleQuizInvoke(payload){
 const php=readFileSync(new URL('./workflows/create-moodle-quiz.php',import.meta.url),'utf8');
 return new Promise((resolve,reject)=>{const child=execFile(runtimeBin('docker'),['exec','-i','classroom_moodle_pilot-webserver-1','php','-r',php],{timeout:30000,maxBuffer:1048576},(error,out)=>error?reject(Error('Moodle 试卷创建未确认')):resolve(out));child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload))});
}
