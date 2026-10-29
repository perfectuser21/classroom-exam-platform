import {randomUUID} from 'node:crypto';
import {planDelivery} from './material-delivery.mjs';
const allowed=new Set(['delivered','failed','offline','unknown']);
export class MaterialJobs {
 constructor({available,read,execute,validate=()=>{},storage={load:()=>[],save:()=>{}}}){
  Object.assign(this,{available,read,execute,validate,storage});this.jobs=new Map();this.locks=new Set();this.running=new Map();
  const saved=storage.load();if(!Array.isArray(saved))throw Error('素材任务记录无效');
  let changed=false;
  for(const job of saved){if(job.state==='running'){job.state='needs_review';for(const d of job.devices)if(['queued','running'].includes(d.status))d.status='unknown';changed=true}for(const d of job.devices)if(d.status==='unknown')this.locks.add(d.device);this.jobs.set(job.id,job)}
  if(changed)this.persist();
 }
 persist(){this.storage.save([...this.jobs.values()])}
 async create({exam,artifactId,assignments}){
  const {record,data}=await this.read(artifactId),id=randomUUID();
  const plans=planDelivery({exam,record,assignments,available:this.available,deliveryId:id});this.validate({exam,assignments});
  if(plans.some(p=>this.locks.has(p.device)))throw Error('设备已有任务或结果待核实');
  if(this.jobs.size>=100)throw Error('素材任务记录已满');
  const job={id,exam,artifactId,state:'running',createdAt:new Date().toISOString(),devices:plans.map(p=>({...p,status:'queued'}))};
  for(const p of plans)this.locks.add(p.device);this.jobs.set(id,job);
  try{this.persist()}catch(e){this.jobs.delete(id);for(const p of plans)this.locks.delete(p.device);throw e}
  const running=this.run(job,data);this.running.set(id,running);return this.get(id);
 }
 async run(job,data){
  for(const d of job.devices){
   d.status='running';try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}
   try{const result=await this.execute(d,data);d.status=allowed.has(result?.status)?result.status:'unknown';if(d.status==='failed')d.stage='verify'}catch{d.status='unknown'}
   try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}
   if(d.status!=='unknown')this.locks.delete(d.device);
  }
  job.state=job.devices.some(d=>d.status==='unknown')?'needs_review':'completed';job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.state='needs_review'}
 }
 list(){return [...this.jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(j=>structuredClone(j))}
 get(id){const job=this.jobs.get(id);return job?structuredClone(job):null}
 async wait(id){const running=this.running.get(id);if(!running)throw Error('任务不存在');await running}
}
