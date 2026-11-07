import {randomUUID} from 'node:crypto';
import {validateSelection} from './preflight.mjs';
import {parseCleanupPreview,cleanupSnapshot} from './cleanup-preview.mjs';
function validResult(result){if(result?.status==='offline'||result?.status==='unknown')return {status:result.status};return parseCleanupPreview('CLASSROOM_CLEANUP_PREVIEW:'+Buffer.from(JSON.stringify(result)).toString('base64'))}
export class CleanupPreviewJobs{
 constructor({available,execute,cleanup,isBusy=()=>false,storage={load:()=>[],save:()=>{}}}){
  Object.assign(this,{available,execute,cleanup,isBusy,storage});const items=storage.load();if(!Array.isArray(items))throw Error('清理预览记录不可用');
  this.jobs=new Map();this.running=new Map();this.locks=new Set();let changed=false;
  for(const j of items){
   if(j.state==='running'){j.state='needs_review';for(const d of j.devices)if(j.operation==='cleanup'||['running','queued'].includes(d.status)){d.status=j.operation==='cleanup'?'unknown':'done';d.result={status:'unknown'}}changed=true}
   if(j.operation==='cleanup')for(const d of j.devices)if(d.status==='unknown')this.locks.add(d.name);
   this.jobs.set(j.id,j);
  }if(changed)this.persist();
 }
 persist(){this.storage.save([...this.jobs.values()])}
 checkAvailable(names){const selected=validateSelection(names,this.available);if(selected.some(name=>this.locks.has(name)||this.isBusy(name)))throw Error('设备正忙、结果待核实或考试进行中，不能清理或扫描');if([...this.jobs.values()].some(j=>j.state==='running'))throw Error('已有清理或预览正在进行');if(this.jobs.size>=100)throw Error('清理记录已满');return selected}
 create(names){const selected=this.checkAvailable(names),id=randomUUID(),job={id,operation:'preview',state:'running',createdAt:new Date().toISOString(),devices:selected.map(name=>({name,status:'running'}))};return this.start(job)}
 executeCleanup(previewId){
  const preview=this.jobs.get(previewId),age=Date.now()-Date.parse(preview?.createdAt);
  if(typeof this.cleanup!=='function'||!preview||preview.operation==='cleanup'||preview.state!=='completed'||!Number.isFinite(age)||age<0||age>10*60*1000||[...this.jobs.values()].some(j=>j.previewId===previewId))throw Error('预览过期、已使用或不可清理，请重新预览');
  const names=this.checkAvailable(preview.devices.map(d=>d.name));for(const d of preview.devices)cleanupSnapshot(d.result);
  const job={id:randomUUID(),operation:'cleanup',previewId,state:'running',createdAt:new Date().toISOString(),devices:names.map(name=>({name,status:'running'}))};return this.start(job);
 }
 start(job){this.jobs.set(job.id,job);for(const d of job.devices)this.locks.add(d.name);try{this.persist()}catch(e){this.jobs.delete(job.id);for(const d of job.devices)this.locks.delete(d.name);throw e}this.running.set(job.id,this.run(job));return this.get(job.id)}
 async run(job){
  let failed=false;
  await Promise.all(job.devices.map(async d=>{
   try{
    if(job.operation==='cleanup'){
     const snapshot=this.jobs.get(job.previewId).devices.find(x=>x.name===d.name).result;
     const result=await this.cleanup(d.name,snapshot);
     if(['cleaned','already_clean'].includes(result?.status)&&result.verified===true&&result.deleted===snapshot.fileCount&&(result.status==='already_clean')===(result.deleted===0))d.result={status:result.status,verified:true,deleted:result.deleted};
     else if(result?.status==='blocked'&&['unsafe','changed','no_drive'].includes(result.reason))d.result={status:'blocked',reason:result.reason};
     else d.result={status:'unknown'};
    }else d.result=validResult(await this.execute(d.name));
   }catch{d.result={status:'unknown'}}
   d.status=job.operation==='cleanup'&&d.result.status==='unknown'?'unknown':'done';
   try{this.persist()}catch{failed=true;if(job.operation==='cleanup'){d.status='unknown';d.result={status:'unknown'}}}
   if(d.status!=='unknown')this.locks.delete(d.name);
  }));
  job.state=failed||job.devices.some(d=>d.status==='unknown')?'needs_review':'completed';job.finishedAt=new Date().toISOString();
  try{this.persist()}catch{job.state='needs_review';if(job.operation==='cleanup')for(const d of job.devices){d.status='unknown';d.result={status:'unknown'};this.locks.add(d.name)}}
 }
 get(id){const x=this.jobs.get(id);return x?structuredClone(x):null}
 list(){return [...this.jobs.values()].map(x=>structuredClone(x))}
 async wait(id){const pending=this.running.get(id);if(!pending)throw Error('任务不存在');await pending}
}
