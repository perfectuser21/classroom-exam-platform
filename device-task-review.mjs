export function reviewUnknownTask(store,{id,device,actor,note,confirmed},clock=()=>new Date()){
 if(!store?.jobs||!store?.locks||typeof store.persist!=='function'||typeof id!=='string'||!id||typeof device!=='string'||!device||typeof actor!=='string'||!actor||actor.length>100||typeof note!=='string'||note.trim().length<2||note.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(note)||confirmed!==true)throw Error('核实信息无效');
 const job=store.jobs.get(id);if(!job||job.state!=='needs_review'||!Array.isArray(job.devices)||job.devices.some(d=>['running','queued'].includes(d.status)))throw Error('任务尚不能核实');
 const rows=job.devices.filter(d=>(d.name||d.device)===device);if(rows.length!==1||rows[0].status!=='unknown'||!store.locks.has(device))throw Error('设备没有待核实任务');
 const row=rows[0],previousState=job.state,previousReview=row.review;
 row.status='reviewed';row.review={previousStatus:'unknown',actor,note:note.trim(),at:clock().toISOString()};if(!job.devices.some(d=>d.status==='unknown'))job.state='reviewed';
 try{store.persist()}catch(error){row.status='unknown';if(previousReview===undefined)delete row.review;else row.review=previousReview;job.state=previousState;throw error}
 const stillLocked=[...store.jobs.values()].some(j=>j.devices?.some(d=>(d.name||d.device)===device&&d.status==='unknown'));
 if(!stillLocked)store.locks.delete(device);
 return {id,device,state:job.state,stillLocked};
}
