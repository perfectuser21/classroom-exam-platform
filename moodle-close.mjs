import {runtimeBin} from './runtime-bins.mjs';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
export function createMoodleClose({invoke}){
 return async plan=>{let result;try{result=JSON.parse(await invoke(plan))}catch{throw Error('关闭回执不可用')}if(result.ok!==true||result.paperId!==plan.paperId||result.closed!==true||!Array.isArray(result.modules)||result.modules.length!==plan.modules.length)throw Error('关闭回执无效');return plan.modules.map(g=>{const rows=result.modules.filter(x=>x.version===g.version);if(rows.length!==1||rows[0].id!==g.courseModuleId||rows[0].quizId!==g.quizId)throw Error('关闭回执无效');return {version:g.version,courseModuleId:g.courseModuleId,quizId:g.quizId}})};
}
export function localMoodleCloseInvoke(payload){const php=readFileSync(new URL('./workflows/close-moodle-pilot.php',import.meta.url),'utf8');return new Promise((resolve,reject)=>{const child=execFile(runtimeBin('docker'),['exec','-i','classroom_moodle_pilot-webserver-1','php','-r',php],{timeout:30000,maxBuffer:1048576},(error,out)=>error?reject(Error('试点关闭未确认')):resolve(out));child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload))})}
