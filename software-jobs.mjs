import {randomUUID} from 'node:crypto';
import {validateSelection} from './preflight.mjs';
const valid=new Set(['already_ready','installed','failed','offline','unknown']);
export class SoftwareJobs {
 constructor({available,execute,externalBusy=()=>false,storage={load:()=>[],save:()=>{}}}){
  this.available=available;this.execute=execute;this.externalBusy=externalBusy;this.storage=storage;this.jobs=new Map();this.locks=new Set();this.running=new Map();
  const saved=storage.load();if(!Array.isArray(saved))throw Error('任务记录无法读取');
  for(const j of saved){if(j.state==='running'){j.state='needs_review';for(const d of j.devices)if(['queued','running'].includes(d.status))d.status='unknown'}for(const d of j.devices)if(d.status==='unknown')this.locks.add(d.name);this.jobs.set(j.id,j)}
  if(saved.some(j=>j.state==='needs_review'))this.persist();
 }
 persist(){this.storage.save([...this.jobs.values()])}
 create(names){const selected=validateSelection(names,this.available);if(selected.some(n=>this.locks.has(n)||this.externalBusy(n)))throw Error('设备已有任务或结果待核实');if(this.jobs.size>=100)throw Error('任务记录已满');const id=randomUUID(),job={id,state:'running',createdAt:new Date().toISOString(),devices:selected.map(name=>({name,status:'queued'}))};for(const n of selected)this.locks.add(n);this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);for(const n of selected)this.locks.delete(n);throw e}const flight=this.run(job);this.running.set(id,flight);return this.get(id)}
 async run(job){for(const d of job.devices){d.status='running';try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}try{const r=await this.execute(d.name);if(!r||!valid.has(r.status))throw Error('回执无效');d.status=r.status;if(['already_ready','installed'].includes(r.status)){if(typeof r.version!=='string'||!/^\d+(\.\d+){1,3}$/.test(r.version))throw Error('版本无效');d.version=r.version}if(r.status==='failed'){if(!['python','probe','pip','import','version','dependencies','platform','package'].includes(r.stage))throw Error('失败阶段无效');d.stage=r.stage}}catch{d.status='unknown'}try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}if(d.status!=='unknown')this.locks.delete(d.name)}job.state=job.devices.some(x=>x.status==='unknown')?'needs_review':'completed';job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.state='needs_review'}}
 list(){return [...this.jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(j=>structuredClone(j))}
 get(id){const job=this.jobs.get(id);return job?structuredClone(job):null}
 async wait(id){const p=this.running.get(id);if(!p)throw Error('任务不存在');await p}
}
