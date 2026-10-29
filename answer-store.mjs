import {mkdir,open,link,unlink,readdir,readFile,stat} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {planAnswerCollection} from './answer-manifest.mjs';
import {examPaths} from './exam-paths.mjs';
const idValid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
function validate(record){if(!record||!idValid(record.id)||(record.taskId!==undefined&&!idValid(record.taskId)))throw Error('答案记录无效');planAnswerCollection({exam:record.exam,student:record.student,device:record.device,available:[record.device],files:[{path:record.path,size:record.size,sha256:record.sha256}]})}
export class AnswerStore {
 constructor(root){this.root=root}
 async save(plan,data){
  if(!Buffer.isBuffer(data)||data.length!==plan.size||createHash('sha256').update(data).digest('hex')!==plan.sha256)throw Error('答案校验失败');
  const id=randomUUID(),record={id,exam:plan.exam,student:plan.student,device:plan.device,path:plan.path,size:plan.size,sha256:plan.sha256,collectedAt:new Date().toISOString(),...(plan.taskId?{taskId:plan.taskId}:{})};validate(record);
  await mkdir(this.root,{recursive:true,mode:0o700});const dt=join(this.root,id+'.data.part'),mt=join(this.root,id+'.meta.part'),df=join(this.root,id+'.data'),mf=join(this.root,id+'.json');let dtmp=false,mtmp=false,dfinal=false,mfinal=false;
  try{let fd=await open(dt,'wx',0o600);dtmp=true;try{await fd.writeFile(data);await fd.sync()}finally{await fd.close()}await link(dt,df);dfinal=true;await unlink(dt);dtmp=false;fd=await open(mt,'wx',0o600);mtmp=true;try{await fd.writeFile(JSON.stringify(record));await fd.sync()}finally{await fd.close()}await link(mt,mf);mfinal=true;await unlink(mt);mtmp=false;return record}
  catch(e){for(const [owned,path] of [[dtmp,dt],[mtmp,mt],[dfinal,df],[mfinal,mf]])if(owned)await unlink(path).catch(()=>{});throw e}
 }
 async list(exam,student){examPaths(exam,student);return (await this.listExam(exam)).filter(record=>record.student===student)}
 async listExam(exam){examPaths(exam,'student');let entries;try{entries=await readdir(this.root)}catch(e){if(e.code==='ENOENT')return [];throw e}const files=entries.filter(x=>x.endsWith('.json'));if(files.length>100000)throw Error('答案记录过多');const records=[];for(const entry of files){const record=JSON.parse(await readFile(join(this.root,entry),'utf8'));validate(record);if(entry!==record.id+'.json')throw Error('答案记录损坏');if(record.exam===exam)records.push(record)}return records.sort((a,b)=>b.collectedAt.localeCompare(a.collectedAt))}
 async read(id){if(!idValid(id))throw Error('答案标识无效');const record=JSON.parse(await readFile(join(this.root,id+'.json'),'utf8'));validate(record);if(record.id!==id)throw Error('答案记录不匹配');const path=join(this.root,id+'.data'),info=await stat(path);if(info.size!==record.size)throw Error('答案大小不匹配');const data=await readFile(path);if(createHash('sha256').update(data).digest('hex')!==record.sha256)throw Error('答案校验失败');return {record,data}}
}
