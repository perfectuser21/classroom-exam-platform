import {meshTarget} from './mesh-target.mjs';
import {createLocalMeshInvoke} from './mesh-material-client.mjs';
import {runtimeBin} from './runtime-bins.mjs';
import {parseSoftwareResult} from './software-job.mjs';
export async function runOne(name,{list,cmd}){
 const devices=await list();if(!Array.isArray(devices))throw Error('设备列表不可用');
 const found=devices.filter(x=>x.name===name&&x.groupname==='教学机房-5台试点');
 if(found.length!==1||typeof found[0]._id!=='string')return {status:'unknown'};
 if(!(found[0].conn&1))return {status:'offline'};
 try{return parseSoftwareResult(await cmd(found[0]._id))}catch{return {status:'unknown'}}
}
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const exec=promisify(execFile);
const remote=`const cp=require("child_process");let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{let a=JSON.parse(s),env={...process.env,MESHCTRL_URL:"wss://mesh.zenjoymedia.media",MESHCTRL_LOGINUSER:a.u,MESHCTRL_LOGINPASS:a.p},bin="/opt/meshcentral/node_modules/meshcentral/meshctrl.js";let args=a.mode==="list"?[bin,"ListDevices","--json"]:[bin,"RunCommand","--id",a.id,"--run",a.command,"--reply"];let r=cp.spawnSync("node",args,{env,encoding:"utf8",timeout:180000,maxBuffer:1048576});if(r.status!==0||r.error)process.exit(1);if(a.mode==="list")console.log(JSON.stringify(JSON.parse(r.stdout)));else console.log(JSON.stringify({output:r.stdout}))}catch(e){process.exit(1)}})`;
export function softwarePresetCommand(preset){if(!['opencv','onnx'].includes(preset))throw Error('软件不在清单中');const template=readFileSync(new URL('./workflows/prepare-'+preset+'.ps1',import.meta.url),'utf8'),helper=readFileSync(new URL('./workflows/software-env-check.py',import.meta.url),'utf8'),marker='__CLASSROOM_ENV_CHECK__',other=preset==='onnx'?'opencv':'onnx',lines=helper.split('\n'),prefix="    '"+other+"':";if(template.split(marker).length!==2||lines.filter(line=>line.startsWith(prefix)).length!==1)throw Error('软件预设无效');const selectedHelper=lines.filter(line=>!line.startsWith(prefix)).join('\n'),script=template.replace(marker,gzipSync(Buffer.from(selectedHelper,'utf8'),{level:9}).toString('base64')).replace(/^[ \t]+/gm,''),compressed=gzipSync(Buffer.from(script,'utf8'),{level:9}).toString('base64'),wrapper="$b=[Convert]::FromBase64String('"+compressed+"');$g=[IO.Compression.GZipStream]::new([IO.MemoryStream]::new($b),[IO.Compression.CompressionMode]::Decompress);&([ScriptBlock]::Create([IO.StreamReader]::new($g).ReadToEnd()))",command='powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(wrapper,'utf16le').toString('base64');if(command.length>=8000)throw Error('软件预设命令过长');return command}
async function executePreset(name,env,preset){
 if(!['opencv','onnx'].includes(preset))throw Error('软件不在清单中');
 if(meshTarget(env).kind==='mac'){
  const invoke=createLocalMeshInvoke(env),command=softwarePresetCommand(preset);
  return runOne(name,{list:async()=>JSON.parse(await invoke(['ListDevices','--json'])),cmd:id=>invoke(['RunCommand','--id',id,'--run',command,'--reply'])});
 }
 const {stdout}=await exec(runtimeBin('op'),['item','get','MeshCentral 香港教学机房试点管理员','--vault','CS','--format','json','--reveal'],{env,timeout:10000});
 const fields=JSON.parse(stdout).fields,u=fields.find(f=>f.label==='username')?.value,p=fields.find(f=>f.label==='password')?.value;
 if(!u||!p)throw Error('管理凭据不可用');
 const command=softwarePresetCommand(preset);
 const call=payload=>new Promise((resolve,reject)=>{
  const child=execFile('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8','hk-vps','node','-e',"'"+remote+"'"],{timeout:210000,maxBuffer:1048576},(error,out)=>{if(error)return reject(Error('设备通道无响应'));try{resolve(JSON.parse(out))}catch{reject(Error('设备回执无效'))}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({u,p,...payload}));
 });
 return runOne(name,{list:()=>call({mode:'list'}),cmd:async id=>(await call({mode:'command',id,command})).output});
}

export function executeOpenCv(name,env){return executePreset(name,env,'opencv')}
export function executeOnnx(name,env){return executePreset(name,env,'onnx')}
