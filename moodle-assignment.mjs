import {runtimeBin} from './runtime-bins.mjs';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
export function createMoodleAssignment({invoke}){
 return async (paperId,groups)=>{let result;try{result=JSON.parse(await invoke({paperId,groups}))}catch{throw Error('分配回执不可用')}
  if(result.ok!==true||result.paperId!==paperId||result.hidden!==true||!Array.isArray(result.groups)||result.groups.length!==groups.length)throw Error('分配回执无效');
  return groups.map(g=>{const rows=result.groups.filter(x=>x.version===g.version);if(rows.length!==1||!Number.isSafeInteger(rows[0].groupId)||rows[0].groupId<1||rows[0].courseModuleId!==g.courseModuleId||rows[0].count!==g.studentIds.length)throw Error('分配回执无效');return {version:g.version,groupId:rows[0].groupId,courseModuleId:g.courseModuleId,count:rows[0].count}});
 };
}
export function localMoodleAssignmentInvoke(payload){
 const php=readFileSync(new URL('./workflows/verify-pilot-participants.php',import.meta.url),'utf8')+'\n'+readFileSync(new URL('./workflows/assign-moodle-pilot.php',import.meta.url),'utf8');
 return new Promise((resolve,reject)=>{const child=execFile(runtimeBin('docker'),['exec','-i','classroom_moodle_pilot-webserver-1','php','-r',php],{timeout:30000,maxBuffer:1048576},(error,out)=>error?reject(Error('试点分配未确认')):resolve(out));child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload))});
}
