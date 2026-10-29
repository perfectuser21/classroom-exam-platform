import {randomUUID} from 'node:crypto';
export class PracticalReviews{
 constructor({getTask,getAnswer,validateAssignment=async()=>{},storage={load:()=>[],save:()=>{}}}){Object.assign(this,{getTask,getAnswer,validateAssignment,storage});this.items=storage.load();if(!Array.isArray(this.items))throw Error('评分记录无法读取')}
 async create({taskId,answerId,scores,comment},reviewer){
  if(typeof reviewer!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(reviewer)||typeof taskId!=='string'||typeof answerId!=='string')throw Error('评分身份无效');
  const task=this.getTask(taskId);let answer;try{answer=await this.getAnswer(answerId)}catch{throw Error('题目或答案不可用')}if(!task||!answer?.record||answer.record.id!==answerId)throw Error('题目或答案不可用');await this.validateAssignment(task,answer.record);
  if(!Array.isArray(scores)||scores.length!==task.rubric.length||scores.some((v,i)=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>task.rubric[i].points||Math.abs(Math.round(v*100)-v*100)>1e-7))throw Error('评分不符合细则');
  if(typeof comment!=='string'||comment.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(comment))throw Error('评语无效');
  const existing=this.items.filter(x=>x.taskId===taskId&&x.answerId===answerId);if(existing.some(x=>x.reviewer===reviewer))throw Error('该评分人已提交');if(existing.length>=2)throw Error('该答案已有两份评分');if(this.items.length>=20000)throw Error('评分记录已满');
  const record={id:randomUUID(),taskId,answerId,exam:answer.record.exam,student:answer.record.student,answerSha256:answer.record.sha256,reviewer,rubric:structuredClone(task.rubric),scores:[...scores],total:Math.round(scores.reduce((a,b)=>a+b,0)*100)/100,comment:comment.trim(),status:'submitted',createdAt:new Date().toISOString()};this.items.push(record);try{this.storage.save(this.items)}catch(e){this.items.pop();throw e}return structuredClone(record)
 }
 list({reviewer}={}){return structuredClone(reviewer?this.items.filter(x=>x.reviewer===reviewer):this.items)}
}
