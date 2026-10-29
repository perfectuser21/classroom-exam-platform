import {randomUUID,createHash} from 'node:crypto';import {answerFingerprint} from './essay-reviews.mjs';
const positive=n=>Number.isSafeInteger(n)&&n>0;
export class EssayFinalization{
 constructor({reviews,loadAnswer,grade,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{reviews,loadAnswer,grade,storage});const items=storage.load();if(!Array.isArray(items))throw Error('仲裁记录无效');this.jobs=new Map();this.running=new Map();let changed=false;for(const item of items){if(item.status==='running'){item.status='unknown';changed=true}this.jobs.set(item.id,item)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 async create({quizId,attemptId,slot,score,reason},actor){
  if(![quizId,attemptId,slot].every(positive)||typeof actor!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(actor)||typeof reason!=='string'||!reason.trim()||reason.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(reason))throw Error('仲裁信息无效');
  const reviews=this.reviews().filter(x=>x.quizId===quizId&&x.attemptId===attemptId&&x.slot===slot);if(reviews.length!==2||reviews[0].reviewer===reviews[1].reviewer||reviews.some(x=>x.reviewer===actor)||reviews[0].fingerprint!==reviews[1].fingerprint)throw Error('需要两名不同考评员及第三名仲裁人');
  const answer=await this.loadAnswer({quizId,attemptId,slot});if(!answer||answer.state!=='finished'||answer.graded!==false||answerFingerprint(answer)!==reviews[0].fingerprint)throw Error('答卷已变化，需核实');if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>answer.maxScore||Math.abs(Math.round(score*100)-score*100)>1e-7)throw Error('仲裁分数无效');
  if([...this.jobs.values()].some(j=>j.quizId===quizId&&j.attemptId===attemptId&&j.slot===slot))throw Error('已有成绩写入记录，不能重复执行');if(this.jobs.size>=20000)throw Error('仲裁记录已满');
  const id=randomUUID(),job={id,quizId,attemptId,slot,questionId:answer.questionId,studentId:answer.studentId,maxScore:answer.maxScore,fingerprint:reviews[0].fingerprint,responseHash:createHash('sha256').update(answer.answer).digest('hex'),score,reason:reason.trim(),actor,reviewIds:reviews.map(x=>x.id),status:'running',createdAt:new Date().toISOString()};this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);throw e}this.running.set(id,this.run(job));return this.get(id)
 }
 async run(job){try{const result=await this.grade(structuredClone(job));job.status=result?.confirmed===true?'completed':'unknown'}catch{job.status='unknown'}job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.status='unknown'}}
 get(id){const job=this.jobs.get(id);return job?structuredClone(job):null}
 list(){return [...this.jobs.values()].map(x=>structuredClone(x))}
 async wait(id){const pending=this.running.get(id);if(!pending)throw Error('任务不存在');await pending}
}
