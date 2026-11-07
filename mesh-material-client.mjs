import {meshTarget} from './mesh-target.mjs';
import {runtimeBin} from './runtime-bins.mjs';
import {mkdtemp,writeFile,readFile,stat,lstat,rm} from 'node:fs/promises';
import {statSync,readFileSync,appendFileSync} from 'node:fs';
import {disposableSeatScope} from './seat-map.mjs';
import {planAnswerCollection} from './answer-manifest.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {filename} from './artifact-store.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
export function createMeshMaterialClient({invoke,disposableSeat=null}) {
 async function deviceId(name){
  if(disposableSeat&&name!==disposableSeat.name)throw Error('临时验证仅允许指定工位');
  const devices=JSON.parse(await invoke(['ListDevices','--json']));
  if(!Array.isArray(devices))throw Error('设备列表无效');
  const found=devices.filter(d=>d.name===name);
  const expected=disposableSeat?.name===name?disposableSeat:null;
  if(found.length!==1||(expected?(found[0].groupname!==expected.group||found[0]._id!==expected.id):found[0].groupname!=='教学机房-5台试点'))throw Error('设备身份不唯一');
  if(found.length!==1||typeof found[0]._id!=='string')throw Error('设备身份不唯一');
  if(!(found[0].conn&1))throw Object.assign(Error('设备离线'),{code:'DEVICE_OFFLINE'});
  return found[0]._id;
 }
 return {
  async command(name,cmd,options={}){const id=await deviceId(name);return invoke(['RunCommand','--id',id,'--run',cmd,'--reply'],options)},
  async download(plan){
   const expected=planAnswerCollection({exam:plan.exam,student:plan.student,device:plan.device,available:[plan.device],files:[{path:plan.path,size:plan.size,sha256:plan.sha256}]})[0];
   if(expected.source!==plan.source)throw Error('答案路径不匹配');
   const id=await deviceId(plan.device),temp=await mkdtemp(join(tmpdir(),'classroom-answer-'));
   try{const path=join(temp,'download');const output=await invoke(['download','--id',id,'--file',expected.source,'--target',path],{limitPath:path,maxBytes:plan.size});if(!String(output).split(/\r?\n/).includes('Download completed, '+plan.size+' bytes written.'))throw Error('文件通道未确认接收');if((await stat(path)).size!==plan.size)throw Error('下载文件大小不符');return await readFile(path)}
   finally{await rm(temp,{recursive:true,force:true})}
  },
  async uploadPath(name,target,path,size){
   if(typeof path!=='string'||typeof target!=='string'||!Number.isSafeInteger(size)||size<1||size>2000000000)throw Error('安装包参数无效');
   const info=await lstat(path);if(!info.isFile()||info.size!==size)throw Error('安装包大小无效');const id=await deviceId(name);
   const output=await invoke(['upload','--id',id,'--file',path,'--target',target],{timeout:1800000});
   if(!String(output).split(/\r?\n/).includes('Upload done, '+size+' bytes sent.'))throw Error('文件通道未确认发送');
  },
  async upload(name,target,file,data){
   filename(file);if(!Buffer.isBuffer(data))throw Error('素材无效');
   const id=await deviceId(name),temp=await mkdtemp(join(tmpdir(),'classroom-material-'));
   try{const path=join(temp,file);await writeFile(path,data,{flag:'wx',mode:0o600});const output=await invoke(['upload','--id',id,'--file',path,'--target',target]);if(!String(output).split(/\r?\n/).includes(`Upload done, ${data.length} bytes sent.`))throw Error('文件通道未确认发送')}
   finally{await rm(temp,{recursive:true,force:true})}
  }
 };
}
export function verificationMeshCredentials(env){
 if(!env.CLASSROOM_VERIFY_MESH_CREDENTIAL_FILE)return null;
 if(env.CLASSROOM_MESH_BACKEND!=='mac'||!disposableSeatScope(env))throw Error('临时 Mesh 凭据仅限回环服务和独立工位');
 const value=JSON.parse(readFileSync(env.CLASSROOM_VERIFY_MESH_CREDENTIAL_FILE,'utf8'));
 if(!value||typeof value.username!=='string'||!value.username||typeof value.password!=='string'||!value.password)throw Error('临时 Mesh 凭据不可用');
 return value;
}
export function createLocalMeshInvoke(env){
 const binary=fileURLToPath(new URL('./node_modules/meshcentral/meshctrl.js',import.meta.url));
 return async (args,options={})=>{
  const local=verificationMeshCredentials(env);
  let u=local?.username,p=local?.password;
  if(!local){
  const {stdout}=await exec(runtimeBin('op'),['item','get','MeshCentral 香港教学机房试点管理员','--vault','CS','--format','json','--reveal'],{env,timeout:10000,maxBuffer:1048576});
  const fields=JSON.parse(stdout).fields;u=fields.find(x=>x.label==='username')?.value;p=fields.find(x=>x.label==='password')?.value;
  }
  if(!u||!p)throw Error('设备管理凭据不可用');
  return await new Promise((resolve,reject)=>{
   let exceeded=false,timer;
   const child=execFile(process.execPath,[binary,...args],{env:{...env,MESHCTRL_URL:meshTarget(env).url,MESHCTRL_LOGINUSER:u,MESHCTRL_LOGINPASS:p},timeout:Math.min(options.timeout||180000,1800000),maxBuffer:1048576},(error,out,stderr)=>{if(timer)clearInterval(timer);if(local&&env.CLASSROOM_VERIFY_MESH_TRACE_FILE&&['RunCommand','upload'].includes(args[0])){const redact=value=>String(value||'').replaceAll(p,'[redacted]').slice(-8000);appendFileSync(env.CLASSROOM_VERIFY_MESH_TRACE_FILE,JSON.stringify({action:args[0],code:error?.code||null,stdout:redact(out),stderr:redact(stderr)})+'\n',{mode:0o600})}if(error||exceeded)return reject(Error('设备文件通道异常'));resolve(out)});
   if(options.limitPath){timer=setInterval(()=>{try{if(statSync(options.limitPath).size>options.maxBytes){exceeded=true;child.kill()}}catch(e){if(e.code!=='ENOENT'){exceeded=true;child.kill()}}},50);timer.unref()}
  });
 };
}
