import {randomUUID} from 'node:crypto';
export class PracticalArbitration{
 constructor({reviews,verifyAnswer=async()=>{},storage={load:()=>[],save:()=>{}}}){this.reviews=reviews;this.verifyAnswer=verifyAnswer;this.storage=storage;this.items=storage.load();if(!Array.isArray(this.items))throw Error('仲裁记录无法读取')}
 create({taskId,answerId,total,reason},actor){
  if(typeof actor!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(actor)||typeof taskId!=='string'||typeof answerId!=='string')throw Error('仲裁信息无效');
  if(typeof total!=='number'||!Number.isFinite(total)||total<0||total>100||Math.abs(Math.round(total*100)-total*100)>1e-7)throw Error('仲裁分数无效');
  if(typeof reason!=='string'||!reason.trim()||reason.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(reason))throw Error('请填写仲裁理由');
  const reviews=this.reviews().filter(x=>x.taskId===taskId&&x.answerId===answerId);if(reviews.length!==2||reviews[0].reviewer===reviews[1].reviewer)throw Error('需要两位考评员的评分');if(reviews.some(x=>x.reviewer===actor))throw Error('仲裁人不能是原评分人');if(this.items.some(x=>x.taskId===taskId&&x.answerId===answerId))throw Error('该答案已有仲裁记录');
  const item={id:randomUUID(),taskId,answerId,total,reason:reason.trim(),actor,reviewIds:reviews.map(x=>x.id),status:'draft',createdAt:new Date().toISOString()};this.items.push(item);try{this.storage.save(this.items)}catch(e){this.items.pop();throw e}return structuredClone(item)
 }
 async finalize(id,actor){if(typeof actor!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(actor))throw Error('确认人无效');const index=this.items.findIndex(x=>x.id===id);if(index<0||this.items[index].status!=='draft')throw Error('仲裁草稿不可确认');const current=this.items[index],reviews=this.reviews().filter(x=>x.taskId===current.taskId&&x.answerId===current.answerId);if(reviews.length!==2||reviews[0].reviewer===reviews[1].reviewer||reviews.some(x=>x.reviewer===actor)||!Array.isArray(current.reviewIds)||current.reviewIds.length!==2||!reviews.every(x=>current.reviewIds.includes(x.id)))throw Error('评分人或评分记录已变化');await this.verifyAnswer(current,reviews);if(this.items[index]!==current||current.status!=='draft')throw Error('仲裁状态已变化');const item={...current,status:'finalized',finalizedBy:actor,finalizedAt:new Date().toISOString()},next=this.items.map((x,i)=>i===index?item:x);this.storage.save(next);this.items=next;return structuredClone(item)}
 list(){return structuredClone(this.items)}
}
