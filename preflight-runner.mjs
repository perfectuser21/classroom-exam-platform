import {meshTarget,localPreflight} from './mesh-target.mjs';
import {createLocalMeshInvoke} from './mesh-material-client.mjs';
import {runtimeBin} from './runtime-bins.mjs';
import {probeScript} from './software-probe.mjs';
import {normalizePreflight} from './preflight-result.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function inspect(env,selected) {
 if(meshTarget(env).kind==='mac'){
  const command='powershell.exe -NoProfile -EncodedCommand '+Buffer.from(probeScript,'utf16le').toString('base64');
  return (await localPreflight(createLocalMeshInvoke(env),selected,command)).map(normalizePreflight);
 }
 const {stdout}=await run(runtimeBin('op'),['item','get','MeshCentral 香港教学机房试点管理员','--vault','CS','--format','json','--reveal'],{env,timeout:10000});
 const f=JSON.parse(stdout).fields; const input=JSON.stringify({u:f.find(x=>x.label==='username').value,p:f.find(x=>x.label==='password').value,selected,command:"powershell.exe -NoProfile -EncodedCommand "+Buffer.from(probeScript,"utf16le").toString("base64")});
 const remote=`const cp=require("child_process");let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{let a=JSON.parse(s),env={...process.env,MESHCTRL_URL:"wss://mesh.zenjoymedia.media",MESHCTRL_LOGINUSER:a.u,MESHCTRL_LOGINPASS:a.p},bin="/opt/meshcentral/node_modules/meshcentral/meshctrl.js";let l=cp.spawnSync("node",[bin,"ListDevices","--json"],{env,encoding:"utf8",timeout:15000});let d=JSON.parse(l.stdout),out=[];for(let n of a.selected){let matches=d.filter(x=>x.name===n && x.groupname==="教学机房-5台试点");if(matches.length!==1){out.push({name:n,error:"设备无法唯一识别"});continue}let x=matches[0];if(!(x.conn&1)){out.push({name:n,error:"设备离线"});continue}let r=cp.spawnSync("node",[bin,"RunCommand","--id",x._id,"--run",a.command,"--reply"],{env,encoding:"utf8",timeout:18000});out.push({name:n,online:true,raw:(r.stdout||"").trim()})}console.log(JSON.stringify(out))})`;
 return await new Promise((resolve,reject)=>{const p=execFile('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8','hk-vps','node','-e',"'"+remote+"'"],{timeout:120000},(e,out)=>{if(e)return reject(e);try{resolve(JSON.parse(out).map(normalizePreflight))}catch(err){reject(err)}});p.stdin.end(input)});
}
