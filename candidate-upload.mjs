import {MAX_BUNDLE_BYTES} from './submission-bundle.mjs';
import {createCandidateBundle} from './candidate-bundle.mjs';
import {createHash} from 'node:crypto';import {planAnswerCollection} from './answer-manifest.mjs';
const extensions=new Set(['csv','json','png','py','ipynb','zip']);
export class CandidateUploads{
 constructor({authorize,list,read,save,validateTask=async()=>null,markStarted=()=>{},clock=Date.now,maxFileBytes=50*1024*1024,maxBundleBytes=MAX_BUNDLE_BYTES,maxTotalBytes=500*1024*1024,maxVersions=20,maxConcurrent=5}){Object.assign(this,{authorize,list,read,save,validateTask,markStarted,clock,maxFileBytes,maxBundleBytes,maxTotalBytes,maxVersions,maxConcurrent});this.active=0;this.locks=new Set()}
 async bundle(input,token){return createCandidateBundle(this,input,token)}
 async history(quizId,token){
  if(!Number.isSafeInteger(quizId)||quizId<1||typeof token!=='string'||!token)throw Error('考试不可用');
  const first=await this.authorize(quizId,token);if(!first||!Number.isSafeInteger(first.studentId)||first.studentId<1||!Number.isSafeInteger(first.attemptId)||first.attemptId<1||!Number.isFinite(first.deadline)||typeof first.device!=='string'||!first.device||this.clock()>=first.deadline)throw Error('考试不可用');
  const exam='exam-'+quizId,student=String(first.studentId),records=await this.list(exam,student);if(!Array.isArray(records))throw Error('答案记录不可用');
  const second=await this.authorize(quizId,token);if(!second||second.studentId!==first.studentId||second.attemptId!==first.attemptId||second.deadline!==first.deadline||second.device!==first.device||this.clock()>=second.deadline)throw Error('考试状态已变化');
  return records.filter(x=>x.exam===exam&&x.student===student).map(({id,path,size,collectedAt,taskId})=>({id,name:path,size,collectedAt,...(taskId?{taskId}:{})}));
 }
 async upload(req,token){
  if(typeof token!=='string'||!token||req.headers['x-classroom-request']!=='candidate'||req.headers['content-type']!=='application/octet-stream')throw Error('请求无效');
  const url=new URL(req.url,'http://localhost'),quizValues=url.searchParams.getAll('quiz'),names=url.searchParams.getAll('name'),tasks=url.searchParams.getAll('task');if(quizValues.length!==1||names.length!==1||tasks.length>1||!/^[1-9]\d{0,9}$/.test(quizValues[0]))throw Error('考试或文件无效');const quizId=Number(quizValues[0]),name=names[0],taskId=tasks[0]||'',ext=name.split('.').at(-1).toLowerCase();if(!extensions.has(ext)||name.includes('/')||name.includes('\\'))throw Error('文件格式不允许');planAnswerCollection({exam:'exam-'+quizId,student:'1',device:'candidate-web',available:['candidate-web'],files:[{path:name,size:1,sha256:'0'.repeat(64)}]});
  if(this.active>=this.maxConcurrent)throw Error('上传繁忙，请稍后重试');this.active++;let lock,owned=false;
  try{const first=await this.authorize(quizId,token);if(!first||!Number.isSafeInteger(first.studentId)||first.studentId<1||!Number.isSafeInteger(first.attemptId)||first.attemptId<1||!Number.isFinite(first.deadline)||typeof first.device!=='string'||!first.device||this.clock()>=first.deadline)throw Error('考试不可提交');const selectedTask=await this.validateTask(quizId,taskId,ext);lock=quizId+':'+first.studentId;if(this.locks.has(lock))throw Error('该考生已有上传进行中');this.locks.add(lock);owned=true;
   const chunks=[];let size=0;for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>this.maxFileBytes)throw Error('文件超过大小限制');chunks.push(b)}if(!size)throw Error('文件为空');const data=Buffer.concat(chunks,size),exam='exam-'+quizId,student=String(first.studentId),existing=await this.list(exam,student);if(!Array.isArray(existing)||existing.length>=this.maxVersions||existing.reduce((n,x)=>n+(Number.isSafeInteger(x.size)?x.size:this.maxTotalBytes),0)+size>this.maxTotalBytes)throw Error('答案版本或容量已满');
   const second=await this.authorize(quizId,token);if(!second||second.studentId!==first.studentId||second.attemptId!==first.attemptId||second.deadline!==first.deadline||second.device!==first.device||this.clock()>=second.deadline||await this.validateTask(quizId,taskId,ext)!==selectedTask)throw Error('考试状态已变化');const sha256=createHash('sha256').update(data).digest('hex'),plans=planAnswerCollection({exam,student,device:'candidate-web',available:['candidate-web'],files:[{path:name,size,sha256}]});if(selectedTask)plans[0].taskId=selectedTask;this.markStarted(exam);const result=await this.save(plans[0],data);if(!result||typeof result.id!=='string'||result.exam!==exam||result.student!==student||(selectedTask&&result.taskId!==selectedTask))throw Error('答案保存未确认');return {id:result.id,exam,student,name,size,sha256,...(selectedTask?{taskId:selectedTask}:{})};
  }finally{if(owned)this.locks.delete(lock);this.active--}
 }
}
