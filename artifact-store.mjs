import {open,readFile,link,unlink,mkdir,readdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {examPaths} from './exam-paths.mjs';
const safeExt=new Set(['csv','json','png','jpg','jpeg','py','ipynb','zip','txt','pdf','docx','xlsx']);
export function filename(name){if(typeof name!=='string'||!name||name.length>128||/[\\/\x00-\x1f<>:"|?*]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw Error('文件名无效');const ext=name.split('.').pop().toLowerCase();if(!name.includes('.')||!safeExt.has(ext))throw Error('文件类型不允许');return name}
export class ArtifactStore {
 constructor(root,{maxBytes=268435456,idFactory=randomUUID}={}){this.root=root;this.maxBytes=maxBytes;this.idFactory=idFactory;this.copyLocks=new Map()}
 async save({exam,name,stream,sourceId,taskbookId}){
  if(taskbookId!==undefined&&(typeof taskbookId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskbookId)))throw Error('任务书标识无效');
  if(sourceId!==undefined&&(typeof sourceId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId)))throw Error('来源标识无效');
  examPaths(exam,'student');filename(name);if(!stream||typeof stream[Symbol.asyncIterator]!=='function')throw Error('文件流无效');
  const id=this.idFactory();if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('文件标识无效');const tmp=join(this.root,id+'.part'),data=join(this.root,id+'.data'),meta=join(this.root,id+'.json'),metaTmp=join(this.root,id+'.meta.part');let fd,createdTemp=false,createdData=false,createdMeta=false,createdMetaTemp=false;
  await mkdir(this.root,{recursive:true,mode:0o700});
  try{fd=await open(tmp,'wx',0o600);createdTemp=true;const hash=createHash('sha256');let size=0;for await(const part of stream){const bytes=Buffer.isBuffer(part)?part:Buffer.from(part);size+=bytes.length;if(size>this.maxBytes)throw Error('文件超过大小限制');hash.update(bytes);await fd.writeFile(bytes)}if(!size)throw Error('文件为空');await fd.sync();await fd.close();fd=null;await link(tmp,data);createdData=true;await unlink(tmp);createdTemp=false;const record={id,exam,name,size,sha256:hash.digest('hex'),createdAt:new Date().toISOString(),...(sourceId?{sourceId}:{}),...(taskbookId?{taskbookId}:{})};const mf=await open(metaTmp,'wx',0o600);createdMetaTemp=true;try{await mf.writeFile(JSON.stringify(record));await mf.sync()}finally{await mf.close()}await link(metaTmp,meta);createdMeta=true;await unlink(metaTmp);createdMetaTemp=false;return record}
  catch(e){if(fd)await fd.close().catch(()=>{});if(createdTemp)await unlink(tmp).catch(()=>{});if(createdData)await unlink(data).catch(()=>{});if(createdMeta)await unlink(meta).catch(()=>{});if(createdMetaTemp)await unlink(metaTmp).catch(()=>{});throw e}
 }
 async copyToExam(id,exam){
  examPaths(exam,'student');if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('素材标识无效');const key=exam+':'+id;if(this.copyLocks.has(key))return this.copyLocks.get(key);
  const operation=(async()=>{const existing=(await this.list(exam)).find(r=>r.sourceId===id);if(existing){await this.read(existing.id);return existing}const {record,data}=await this.read(id);if(record.exam===exam)throw Error('素材已属于该考试');return this.save({exam,name:record.name,stream:Readable.from([data]),sourceId:id})})();this.copyLocks.set(key,operation);try{return await operation}finally{this.copyLocks.delete(key)}
 }
 async list(exam){
  examPaths(exam,'student');let entries;try{entries=await readdir(this.root)}catch(e){if(e.code==='ENOENT')return [];throw e}
  const rows=[];for(const file of entries.filter(x=>x.endsWith('.json'))){const record=JSON.parse(await readFile(join(this.root,file),'utf8'));if(!record||typeof record.id!=='string'||file!==record.id+'.json'||typeof record.exam!=='string'||typeof record.name!=='string'||!Number.isInteger(record.size)||record.size<1||record.size>this.maxBytes||typeof record.sha256!=='string'||! /^[a-f0-9]{64}$/.test(record.sha256))throw Error('素材记录损坏');examPaths(record.exam,'student');filename(record.name);if(record.exam===exam)rows.push(record)}return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 }
 async read(id){if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('文件标识无效');const record=JSON.parse(await readFile(join(this.root,id+'.json'),'utf8'));if(record.id!==id||!Number.isInteger(record.size)||record.size<1||record.size>this.maxBytes)throw Error('文件记录无效');const data=await readFile(join(this.root,id+'.data'));if(data.length!==record.size||createHash('sha256').update(data).digest('hex')!==record.sha256)throw Error('文件校验失败');return {record,data}}
}
