import {randomUUID} from 'node:crypto';
import {planExamRelease} from './exam-assignment.mjs';
export class AssignmentJobs {
 constructor({getPaper,getPublication,getEnrolled,execute,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{getPaper,getPublication,getEnrolled,execute,storage});this.jobs=new Map();this.running=new Map();const saved=storage.load();if(!Array.isArray(saved))throw Error('分配记录无效');let changed=false;for(const job of saved){if(job.status==='running'){job.status='unknown';changed=true}this.jobs.set(job.id,job)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 async create(paperId,assignments){
  const paper=this.getPaper(paperId),publication=this.getPublication(paperId),enrolled=await this.getEnrolled(),groups=planExamRelease({paper,job:publication,enrolled,assignments});
  if([...this.jobs.values()].some(j=>j.paperId===paperId))throw Error('试卷已分配或结果待核实');if(this.jobs.size>=1000)throw Error('分配记录已满');
  const id=randomUUID(),job={id,paperId,status:'running',createdAt:new Date().toISOString(),groups:structuredClone(groups)};this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);throw e}const pending=this.run(job,groups);this.running.set(id,pending);return this.get(id);
 }
 async run(job,groups){try{const receipt=await this.execute(job.paperId,groups);if(!Array.isArray(receipt)||receipt.length!==groups.length)throw Error('分配回执无效');for(const expected of groups){const rows=receipt.filter(x=>x.version===expected.version);if(rows.length!==1||!Number.isSafeInteger(rows[0].groupId)||rows[0].groupId<1||rows[0].courseModuleId!==expected.courseModuleId||rows[0].count!==expected.studentIds.length)throw Error('分配回执无效')}job.receipt=receipt.map(({version,groupId,courseModuleId,count})=>({version,groupId,courseModuleId,count}));job.status='prepared'}catch{job.status='unknown'}job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.status='unknown'}}
 get(id){const job=this.jobs.get(id);return job?structuredClone(job):null}
 list(){return [...this.jobs.values()].map(j=>structuredClone(j))}
 async wait(id){const p=this.running.get(id);if(!p)throw Error('任务不存在');await p}
}
