import {createHash} from 'node:crypto';
import {examPaths} from './exam-paths.mjs';
import {filename} from './artifact-store.mjs';

export function planDelivery({exam,record,assignments,available,deliveryId}) {
  examPaths(exam,deliveryId);
  if (!record || record.exam!==exam || typeof record.id!=='string' || !Number.isSafeInteger(record.size) || record.size<1 || !/^[a-f0-9]{64}$/.test(record.sha256)) throw Error('素材记录无效');
  filename(record.name);
  if (!Array.isArray(available) || !Array.isArray(assignments) || assignments.length<1 || assignments.length>5) throw Error('设备或考生选择无效');
  const devices=new Set(), students=new Set();
  return assignments.map(({device,student})=>{
    if (typeof device!=='string' || available.filter(x=>x===device).length!==1 || devices.has(device) || students.has(student)) throw Error('设备和考生必须唯一且属于试点');
    const paths=examPaths(exam,student);
    devices.add(device); students.add(student);
    return {device,student,exam,deliveryId,artifactId:record.id,name:record.name,size:record.size,sha256:record.sha256,directory:`${paths.materials}\\${deliveryId}`};
  });
}

export async function deliverMaterial(plan,data,transport) {
  if (!Buffer.isBuffer(data) || data.length!==plan.size || createHash('sha256').update(data).digest('hex')!==plan.sha256) throw Error('素材内容校验失败');
  let prepared=false;
  try {
    await transport.prepare(plan);
    prepared=true;
    await transport.upload(plan,data);
    const result=await transport.verify(plan);
    if (!result || result.size!==plan.size || result.sha256!==plan.sha256) return {status:'failed',stage:'verify'};
    return {status:'delivered'};
  } catch (error) { return {status:!prepared && error?.code==='DEVICE_OFFLINE'?'offline':'unknown'}; }
}
