import {randomUUID} from 'node:crypto';
import {questionXml} from './moodle-question-xml.mjs';
export class QuestionPublisher{
 constructor({getQuestion,execute,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{getQuestion,execute,storage});this.jobs=new Map();this.running=new Map();const saved=storage.load();if(!Array.isArray(saved))throw Error('题目发布记录无效');let changed=false;for(const job of saved){if(job.status==='running'){job.status='unknown';changed=true}this.jobs.set(job.id,job)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 create(questionId){
  const question=this.getQuestion(questionId);if(!question||question.id!==questionId)throw Error('草稿不存在');const {image,...core}=question;questionXml([core]);if(image!==undefined&&(!image||typeof image.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(image.id)||!/^[a-f0-9]{64}$/.test(image.sha256)))throw Error('图片记录无效');
  if([...this.jobs.values()].some(j=>j.questionId===questionId))throw Error('该题已发布或结果待核实');if(this.jobs.size>=10000)throw Error('发布记录已满');
  const id=randomUUID(),job={id,questionId,status:'running',createdAt:new Date().toISOString()};this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);throw e}const pending=this.run(job,question);this.running.set(id,pending);return this.get(id);
 }
 async run(job,question){try{const result=await this.execute(question);if(!Number.isSafeInteger(result?.moodleId)||result.moodleId<1)throw Error('Moodle 回执无效');job.moodleId=result.moodleId;job.status='published'}catch{job.status='unknown'}job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.status='unknown'}}
 get(id){const j=this.jobs.get(id);return j?structuredClone(j):null}
 list(){return [...this.jobs.values()].map(j=>structuredClone(j))}
 async wait(id){const p=this.running.get(id);if(!p)throw Error('任务不存在');await p}
}
