import {createHash,randomUUID} from 'node:crypto';
const positive=n=>Number.isSafeInteger(n)&&n>0;
const validActor=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(x);
export function answerFingerprint(answer){return createHash('sha256').update(JSON.stringify([answer.quizId,answer.attemptId,answer.slot,answer.questionId,answer.studentId,answer.maxScore,answer.answer])).digest('hex')}
export class EssayReviews{
 constructor({loadAnswer,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{loadAnswer,storage});this.items=storage.load();if(!Array.isArray(this.items))throw Error('评分记录无法读取')}
 async create({quizId,attemptId,slot,score,comment},reviewer){
  if(!validActor(reviewer)||![quizId,attemptId,slot].every(positive)||typeof comment!=='string'||comment.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(comment))throw Error('评分信息无效');
  const a=await this.loadAnswer({quizId,attemptId,slot});if(!a||a.quizId!==quizId||a.attemptId!==attemptId||a.slot!==slot||!positive(a.questionId)||!positive(a.studentId)||a.state!=='finished'||a.graded!==false||typeof a.answer!=='string'||a.answer.length>10000||typeof a.maxScore!=='number'||!Number.isFinite(a.maxScore)||a.maxScore<=0||a.maxScore>100)throw Error('答卷不可评分');
  if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>a.maxScore||Math.abs(Math.round(score*100)-score*100)>1e-7)throw Error('分数无效');
  const fingerprint=answerFingerprint(a),existing=this.items.filter(x=>x.quizId===quizId&&x.attemptId===attemptId&&x.slot===slot);if(existing.some(x=>x.reviewer===reviewer))throw Error('该考评员已评分');if(existing.length>=2)throw Error('已有两份评分');if(existing.some(x=>x.fingerprint!==fingerprint))throw Error('答卷已变化，需重新核实');if(this.items.length>=20000)throw Error('评分记录已满');
  const record={id:randomUUID(),quizId,attemptId,slot,questionId:a.questionId,studentId:a.studentId,maxScore:a.maxScore,fingerprint,reviewer,score,comment:comment.trim(),status:'submitted',createdAt:new Date().toISOString()};this.items.push(record);try{this.storage.save(this.items)}catch(e){this.items.pop();throw e}return structuredClone(record)
 }
 list({reviewer}={}){return structuredClone(reviewer?this.items.filter(x=>x.reviewer===reviewer):this.items)}
}
