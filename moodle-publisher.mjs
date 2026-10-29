import {runtimeBin} from './runtime-bins.mjs';
import {questionXml} from './moodle-question-xml.mjs';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
export function createMoodlePublisher({invoke}){
 return async question=>{const xml=questionXml([question]),name='草稿-'+question.id;let result;try{result=JSON.parse(await invoke({name,xml}))}catch{throw Error('Moodle 导入回执不可用')}if(result.ok!==true||result.name!==name||!Number.isSafeInteger(result.moodleId)||result.moodleId<1)throw Error('Moodle 导入回执无效');return {moodleId:result.moodleId}};
}
export function localMoodleInvoke(payload){
 const php=readFileSync(new URL('./workflows/import-moodle-question.php',import.meta.url),'utf8');
 return new Promise((resolve,reject)=>{const child=execFile(runtimeBin('docker'),['exec','-i','classroom_moodle_pilot-webserver-1','php','-r',php],{timeout:30000,maxBuffer:1048576},(error,out)=>error?reject(Error('Moodle 导入未确认')):resolve(out));child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload))});
}
