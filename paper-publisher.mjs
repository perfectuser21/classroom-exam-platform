import {randomUUID} from 'node:crypto';
export class PaperPublisher {
 constructor({getPaper,execute,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{getPaper,execute,storage});this.jobs=new Map();this.running=new Map();const saved=storage.load();if(!Array.isArray(saved))throw Error('试卷发布记录无效');let changed=false;for(const job of saved){if(job.status==='running'){job.status='needs_review';for(const p of job.papers){if(p.status==='running')p.status='unknown';else if(p.status==='queued')p.status='not_started'}changed=true}this.jobs.set(job.id,job)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 create(paperId){
  const draft=this.getPaper(paperId);if(!draft||draft.id!==paperId||draft.status!=='draft'||!Array.isArray(draft.papers)||draft.papers.length<1||draft.papers.length>2||draft.papers.some(p=>!['A','B'].includes(p.version)||!Array.isArray(p.questions)||!p.questions.length))throw Error('试卷草稿无效');
  if([...this.jobs.values()].some(j=>j.paperId===paperId))throw Error('试卷已创建或结果待核实');if(this.jobs.size>=1000)throw Error('试卷记录已满');
  const id=randomUUID(),job={id,paperId,status:'running',createdAt:new Date().toISOString(),papers:draft.papers.map(p=>({version:p.version,status:'queued'}))};this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);throw e}const pending=this.run(job,draft);this.running.set(id,pending);return this.get(id);
 }
 async run(job,draft){
  for(let i=0;i<job.papers.length;i++){
   const entry=job.papers[i];entry.status='running';try{this.persist()}catch{entry.status='unknown';job.status='needs_review';return}
   try{const result=await this.execute(draft,draft.papers[i]);if(!Number.isSafeInteger(result?.quizId)||result.quizId<1||!Number.isSafeInteger(result?.courseModuleId)||result.courseModuleId<1)throw Error('试卷回执无效');entry.status='created';entry.quizId=result.quizId;entry.courseModuleId=result.courseModuleId}catch{entry.status='unknown';for(const p of job.papers.slice(i+1))p.status='not_started'}
   try{this.persist()}catch{entry.status='unknown';job.status='needs_review';return}if(entry.status==='unknown')break;
  }
  job.status=job.papers.every(p=>p.status==='created')?'completed':'needs_review';job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.status='needs_review'}
 }
 get(id){const job=this.jobs.get(id);return job?structuredClone(job):null}
 list(){return [...this.jobs.values()].map(j=>structuredClone(j))}
 async wait(id){const p=this.running.get(id);if(!p)throw Error('任务不存在');await p}
}
