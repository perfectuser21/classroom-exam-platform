export function meshTarget(env){
 const value=env.CLASSROOM_MESH_BACKEND||'hk';
 if(value==='hk')return {kind:'hk',url:'wss://mesh.zenjoymedia.media'};
 if(value==='mac')return {kind:'mac',url:'wss://127.0.0.1:18443'};
 throw Error('设备管理服务器配置无效');
}
export async function localPreflight(invoke,selected,command){
 const devices=JSON.parse(await invoke(['ListDevices','--json']));
 if(!Array.isArray(devices))throw Error('设备列表无效');
 const out=[];
 for(const name of selected){
  const matches=devices.filter(x=>x.name===name&&x.groupname==='教学机房-5台试点');
  if(matches.length!==1||typeof matches[0]._id!=='string'){out.push({name,error:'设备无法唯一识别'});continue}
  const device=matches[0];if(!(device.conn&1)){out.push({name,error:'设备离线'});continue}
  try{out.push({name,online:true,raw:(await invoke(['RunCommand','--id',device._id,'--run',command,'--reply'])).trim()})}catch{out.push({name,online:true,error:'环境检查未返回完整结果'})}
 }
 return out;
}
export async function pilotDeviceSummary(invoke,disposableSeat=null){
 const devices=JSON.parse(await invoke(['ListDevices','--json']));
 if(!Array.isArray(devices))throw Error('设备列表无效');
 return devices.filter(x=>(disposableSeat?(x.name===disposableSeat.name&&x.groupname===disposableSeat.group&&x._id===disposableSeat.id):x.groupname==='教学机房-5台试点')&&typeof x.name==='string').map(x=>({name:x.name,online:!!(x.conn&1)}));
}
