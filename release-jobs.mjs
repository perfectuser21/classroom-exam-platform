import {randomUUID} from 'node:crypto';
import {prepareExamRelease} from './exam-release.mjs';
export class ReleaseJobs {
 constructor({getAssignment,execute,canReopen=()=>false,storage={load:()=>[],save:()=>{}}}){Object.assign(this,{getAssignment,execute,canReopen,storage});this.jobs=new Map();this.running=new Map();const rows=storage.load();if(!Array.isArray(rows))throw Error('考试开放记录无效');let changed=false;for(const job of rows){if(job.status==='running'){job.status='unknown';changed=true}this.jobs.set(job.id,job)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 create(paperId){const assignment=this.getAssignment(paperId),plan=prepareExamRelease(assignment);if(plan.paperId!==paperId)throw Error('试卷身份不匹配');const latest=[...this.jobs.values()].filter(j=>j.paperId===paperId).at(-1);if(latest&&!(latest.status==='open'&&this.canReopen(latest.id)))throw Error('考试已开放或结果待核实');if(this.jobs.size>=1000)throw Error('开放记录已满');const id=randomUUID(),job={id,paperId,status:'running',createdAt:new Date().toISOString()};this.jobs.set(id,job);try{this.persist()}catch(e){this.jobs.delete(id);throw e}const pending=this.run(job,plan);this.running.set(id,pending);return this.get(id)}
 async run(job,plan){try{const result=await this.execute(plan);if(!Array.isArray(result)||result.length!==plan.groups.length)throw Error('开放回执无效');for(const g of plan.groups){const rows=result.filter(x=>x.version===g.version);if(rows.length!==1||rows[0].quizId!==g.quizId||rows[0].courseModuleId!==g.courseModuleId)throw Error('开放回执无效')}job.modules=result.map(({version,quizId,courseModuleId})=>({version,quizId,courseModuleId}));job.status='open'}catch{job.status='unknown'}job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.status='unknown'}}
 get(id){const job=this.jobs.get(id);return job?structuredClone(job):null}
 list(){return [...this.jobs.values()].map(j=>structuredClone(j))}
 async wait(id){const p=this.running.get(id);if(!p)throw Error('任务不存在');await p}
}
