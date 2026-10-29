import {randomUUID} from 'node:crypto';
export class CandidateAccountChanges{
 constructor({getAccount=()=>null,hasActiveExam=()=>true,blockedUser=()=>false,execute=async()=>{throw Error('不可用')},storage={load:()=>[],save:()=>{}}}={}){Object.assign(this,{getAccount,hasActiveExam,blockedUser,execute,storage});const rows=storage.load();if(!Array.isArray(rows))throw Error('账号操作记录无效');this.jobs=new Map();this.running=new Map();this.busy=false;let changed=false;for(const row of rows){if(row.status==='running'){row.status='unknown';changed=true}this.jobs.set(row.id,row)}if(changed)this.persist()}
 persist(){this.storage.save([...this.jobs.values()])}
 suspended(accountId){return [...this.jobs.values()].filter(x=>x.accountId===accountId&&x.status==='completed').at(-1)?.suspended===true}
 hasUnresolved(ids){return [...this.jobs.values()].some(x=>ids.includes(x.userId)&&['unknown','running'].includes(x.status))}
 isUnavailable(userId,accounts){return this.hasUnresolved([userId])||accounts.some(a=>a.userId===userId&&this.suspended(a.id))}
 create(accountId,suspended,actor){const account=this.getAccount(accountId);if(!account||account.status!=='completed'||!Number.isSafeInteger(account.userId)||account.userId<1||typeof account.username!=='string'||typeof suspended!=='boolean'||typeof actor!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(actor))throw Error('考生账号无效');if(this.busy||this.hasActiveExam())throw Error('有考试或账号操作进行中');if(this.blockedUser(account.userId)||this.hasUnresolved([account.userId]))throw Error('账号状态待核实');if(this.suspended(accountId)===suspended)throw Error('账号已处于所选状态');const id=randomUUID(),job={id,accountId,userId:account.userId,username:account.username,suspended,actor,status:'running',createdAt:new Date().toISOString()};this.jobs.set(id,job);this.busy=true;try{this.persist()}catch(e){this.jobs.delete(id);this.busy=false;throw e}this.running.set(id,this.run(job));return this.get(id)}
 async run(job){try{const result=await this.execute(structuredClone(job));job.status=result?.confirmed===true?'completed':'unknown'}catch{job.status='unknown'}job.finishedAt=new Date().toISOString();try{this.persist()}catch{job.status='unknown'}this.busy=false}
 get(id){const job=this.jobs.get(id);return job?structuredClone(job):null}
 list(){return [...this.jobs.values()].map(x=>structuredClone(x))}
 async wait(id){const pending=this.running.get(id);if(!pending)throw Error('任务不存在');await pending}
}
