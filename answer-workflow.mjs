import {examPaths} from './exam-paths.mjs';
import {answerScanCommand,parseAnswerScan} from './answer-scan.mjs';
import {planAnswerCollection} from './answer-manifest.mjs';
import {collectAnswers} from './answer-collection.mjs';
export async function runAnswerWorkflow({exam,student,device},{available,command,download,save}){
 examPaths(exam,student);
 if(typeof device!=='string'||!Array.isArray(available)||available.filter(x=>x===device).length!==1)throw Error('设备不属于试点');
 const output=await command(device,answerScanCommand(exam,student));
 const plans=planAnswerCollection({exam,student,device,available,files:parseAnswerScan(output)});
 return {exam,student,device,files:await collectAnswers(plans,{download,save})};
}
