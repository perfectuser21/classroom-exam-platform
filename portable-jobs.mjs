import {randomUUID} from 'node:crypto';
import {validateSelection} from './preflight.mjs';
const states=new Set(['deployed','blocked','offline','unknown']);
export class PortableJobs {
 constructor({available,execute,externalBusy=()=>false,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{available,execute,externalBusy,storage});this.jobs=new Map();this.locks=new Set();this.running=new Map();const saved=storage.load();if(!Array.isArray(saved))throw Error('安装任务记录无效');let changed=false;for(const j of saved){if(j.state==='running'){j.state='needs_review';for(const d of j.devices)if(['queued','running'].includes(d.status))d.status='unknown';changed=true}for(const d of j.devices)if(d.status==='unknown')this.locks.add(d.name);this.jobs.set(j.id,j)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 create(software,names){if(!['praat','sqlite'].includes(software))throw Error('软件不在清单中');const selected=validateSelection(names,this.available);if(selected.some(n=>this.locks.has(n)||this.externalBusy(n)))throw Error('设备已有安装任务或结果待核实');if(this.jobs.size>=100)throw Error('安装记录已满');const id=randomUUID(),job={id,software,state:'running',createdAt:new Date().toISOString(),devices:selected.map(name=>({name,status:'queued'}))};for(const n of selected)this.locks.add(n);this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);for(const n of selected)this.locks.delete(n);throw e}const pending=this.run(job);this.running.set(id,pending);return this.get(id)}
 async run(job){
  for(const d of job.devices){d.status='running';try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}
   try{const stage=async phase=>{if(!['probe','transfer','install'].includes(phase))throw Error('阶段无效');d.phase=phase;this.persist()};const result=await this.execute(job.software,d.name,job.id,stage);if(!states.has(result?.status))throw Error('安装回执无效');d.status=result.status;if(d.status==='deployed'){if(typeof result.version!=='string'||!/^\d+(\.\d+){1,3}$/.test(result.version))throw Error('版本无效');d.version=result.version}if(d.status==='blocked'){if(!['existing','target','space','installer','permissions','verify'].includes(result.reason))throw Error('阻止原因无效');d.reason=result.reason}if(d.status==='failed'){if(!['installer','verify'].includes(result.stage))throw Error('失败阶段无效');d.failureStage=result.stage}}catch{d.status='unknown'}
   try{this.persist()}catch{d.status='unknown';job.state='needs_review';return}if(d.status!=='unknown')this.locks.delete(d.name)
  }
  job.state=job.devices.some(d=>d.status==='unknown')?'needs_review':'completed';job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.state='needs_review'}
 }
 get(id){const j=this.jobs.get(id);return j?structuredClone(j):null}
 list(){return [...this.jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(j=>structuredClone(j))}
 async wait(id){const p=this.running.get(id);if(!p)throw Error('任务不存在');await p}
}
