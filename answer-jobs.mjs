import {randomUUID} from 'node:crypto';
import {examPaths} from './exam-paths.mjs';
export class AnswerJobs {
 constructor({available,execute,externalBusy=()=>false,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{available,execute,externalBusy,storage});this.jobs=new Map();this.locks=new Set();this.running=new Map();const saved=storage.load();if(!Array.isArray(saved))throw Error('答案任务记录无效');let changed=false;for(const job of saved){if(job.state==='running'){job.state='needs_review';for(const d of job.devices)if(['queued','running'].includes(d.status))d.status='unknown';changed=true}for(const d of job.devices)if(d.status==='unknown')this.locks.add(d.device);this.jobs.set(job.id,job)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 create(exam,assignments){
  examPaths(exam,'student');if(!Array.isArray(assignments)||assignments.length<1||assignments.length>5)throw Error('工位选择无效');const devices=new Set(),students=new Set();
  for(const {device,student} of assignments){examPaths(exam,student);if(typeof device!=='string'||this.available.filter(x=>x===device).length!==1||devices.has(device)||students.has(student)||this.locks.has(device)||this.externalBusy(device))throw Error('工位或考生无效');devices.add(device);students.add(student)}
  if(this.jobs.size>=100)throw Error('答案任务记录已满');const id=randomUUID(),job={id,exam,state:'running',createdAt:new Date().toISOString(),devices:assignments.map(({device,student})=>({device,student,status:'queued'}))};
  for(const d of devices)this.locks.add(d);this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);for(const d of devices)this.locks.delete(d);throw e}const running=this.run(job);this.running.set(id,running);return this.get(id);
 }
 async run(job){
  for(const d of job.devices){d.status='running';try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}
   try{const result=await this.execute({exam:job.exam,student:d.student,device:d.device});if(!Array.isArray(result?.files)||result.files.length>20)throw Error('答案回执无效');d.files=result.files.map(f=>{if(typeof f.path!=='string'||!['collected','failed','unknown'].includes(f.status)||(f.status==='collected'&&typeof f.id!=='string'))throw Error('答案回执无效');return f.status==='collected'?{path:f.path,status:f.status,id:f.id}:{path:f.path,status:f.status}});d.status=d.files.some(f=>f.status==='unknown')?'unknown':d.files.some(f=>f.status==='failed')?'failed':d.files.length?'collected':'empty'}catch(e){d.status=e?.code==='DEVICE_OFFLINE'?'offline':'unknown'}
   try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}if(d.status!=='unknown')this.locks.delete(d.device)
  }
  job.state=job.devices.some(d=>d.status==='unknown')?'needs_review':'completed';job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.state='needs_review'}
 }
 list(){return [...this.jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(j=>structuredClone(j))}
 get(id){const j=this.jobs.get(id);return j?structuredClone(j):null}
 async wait(id){const p=this.running.get(id);if(!p)throw Error('任务不存在');await p}
}
