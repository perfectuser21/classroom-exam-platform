import {reviewUnknownTask} from './device-task-review.mjs';
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createDeviceTaskReviewApi({stores,available}){return async(req,res,identity)=>{
 if(identity?.role!=='admin')return send(res,403,{error:'仅管理员可核实设备任务'});
 try{
  const all=stores();
  if(req.method==='GET'){
   const out=[];for(const [kind,store] of Object.entries(all))for(const job of store.jobs.values())if(job.state==='needs_review'&&uuid.test(job.id))for(const d of job.devices||[]){const device=d.name||d.device;if(d.status==='unknown'&&available.includes(device)&&store.locks.has(device))out.push({kind,id:job.id,device,phase:d.phase||d.currentStep||null,createdAt:job.createdAt||null})}
   return send(res,200,out);
  }
  if(req.method!=='POST'||req.headers['x-classroom-request']!=='device-task-review')return send(res,403,{error:'请求无效'});
  let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096)return send(res,413,{error:'请求过大'});chunks.push(chunk)}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='confirmed,device,id,kind,note'||!uuid.test(input.id)||!available.includes(input.device)||!Object.hasOwn(all,input.kind))throw Error('核实请求无效');
  const result=reviewUnknownTask(all[input.kind],{...input,actor:identity.username});
  result.stillLocked=result.stillLocked||Object.entries(all).some(([kind,store])=>kind!==input.kind&&store.locks.has(input.device));return send(res,200,result);
 }catch(e){return send(res,400,{error:e.message||'核实失败'})}
}}
