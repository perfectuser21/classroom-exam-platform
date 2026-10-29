import {readdir,lstat,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
const required=['database.dump','moodledata.tar.gz','frontend-state.tar.gz','source-code.tar.gz','moodle-code.tar.gz','moodle-code-revision.txt','runtime-manifest.json'];
async function meshStatus(root,now){
 try{
  const data=JSON.parse(await readFile(join(dirname(root),'mesh-vault-backup-status.json'),'utf8'));
  const attempt=Date.parse(data.last_attempt),success=Date.parse(data.last_success);
  if(!Number.isFinite(attempt)||!['ok','failed'].includes(data.state))return {state:'missing',lastBackup:null};
  if(attempt>now+300000 || (Number.isFinite(success)&&success>now+300000))return {state:'clock_skew',lastBackup:null};
  if(data.state==='failed')return {state:'failed',lastBackup:Number.isFinite(success)?new Date(success).toISOString():null};
  if(!Number.isFinite(success))return {state:'missing',lastBackup:null};
  return {state:now-success>30*3600000?'stale':'ok',lastBackup:new Date(success).toISOString()};
 }catch{return {state:'missing',lastBackup:null}}
}
export async function backupStatus(root,now=Date.now()){
 const mesh=await meshStatus(root,now);
 let entries;try{entries=await readdir(root,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return {state:'missing',count:0,lastBackup:null,mesh};throw e}
 const times=[];
 for(const entry of entries){
  if(!entry.isDirectory()||!/^moodle-[a-zA-Z0-9-]+$/.test(entry.name))continue;
  try{const files=await Promise.all(required.map(name=>lstat(join(root,entry.name,name))));if(files.every(x=>x.isFile()&&x.size>0))times.push(Math.max(...files.map(file=>file.mtimeMs)))}catch(e){if(e.code!=='ENOENT')throw e}
 }
 if(!times.length)return {state:'missing',count:0,lastBackup:null,mesh};
 const latest=Math.max(...times),age=now-latest;
 return {state:age< -300000?'clock_skew':age>30*3600000?'stale':'ok',count:times.length,lastBackup:new Date(latest).toISOString(),mesh};
}
