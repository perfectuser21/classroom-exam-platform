import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleanup from './cleanup-preview.mjs';
import {CleanupPreviewJobs} from './cleanup-preview-jobs.mjs';
import {createCleanupPreviewApi} from './cleanup-preview-api.mjs';
import {routeAction,mayAccess} from './access-policy.mjs';
import {Readable} from 'node:stream';
const file={path:'exam-owned/1/answers/a.txt',size:4,sha256:'a'.repeat(64)};
const preview={status:'complete',fileCount:1,totalBytes:4,skipped:0,files:[file]};
const wrap=(tag,x)=>tag+':'+Buffer.from(JSON.stringify(x)).toString('base64');
test('cleanup accepts only a complete hashed snapshot with safe Windows paths',()=>{
 assert.equal(typeof cleanup.cleanupExecutionCommand,'function');
 assert.ok(cleanup.cleanupExecutionCommand(preview).length<8000);
 for(const bad of [{...preview,status:'partial'},{...preview,files:[{...file,sha256:undefined}]},...['../x','a./x','a /x','CON','a/*','a/$x:ads'].map(path=>({...preview,files:[{...file,path}]}))])assert.throws(()=>cleanup.cleanupExecutionCommand(bad));
});
test('cleanup success requires independent readback; absence of a receipt stays unknown',async()=>{
 assert.equal(typeof cleanup.runCleanupExecution,'function');
 let calls=0;
 const result=await cleanup.runCleanupExecution('A',preview,async()=>++calls===1?wrap('CLASSROOM_CLEANUP_EXECUTION',{status:'cleaned',deleted:1}):wrap('CLASSROOM_CLEANUP_PREVIEW',{status:'complete',fileCount:0,totalBytes:0,skipped:0,files:[]}));
 assert.equal(result.status,'cleaned');assert.equal(result.verified,true);assert.equal(calls,2);
 const retained=await cleanup.runCleanupExecution('A',preview,async()=>++calls===4?wrap('CLASSROOM_CLEANUP_PREVIEW',preview):wrap('CLASSROOM_CLEANUP_EXECUTION',{status:'cleaned',deleted:1}));assert.equal(retained.status,'unknown');
 assert.equal((await cleanup.runCleanupExecution('A',preview,async()=>{throw Error('timeout')})).status,'unknown');
});
test('cleanup job consumes fresh preview, holds locks, and persists unknown across restart',async()=>{
 let finish;let saved=[];
 const options={available:['A'],execute:async()=>preview,cleanup:()=>new Promise(r=>finish=r),storage:{load:()=>structuredClone(saved),save:x=>{saved=structuredClone(x)}}};
 const jobs=new CleanupPreviewJobs(options),p=jobs.create(['A']);await jobs.wait(p.id);
 assert.equal(typeof jobs.executeCleanup,'function');
 const j=jobs.executeCleanup(p.id);assert.equal(j.operation,'cleanup');assert.equal(jobs.locks.has('A'),true);assert.throws(()=>jobs.executeCleanup(p.id));
 const restarted=new CleanupPreviewJobs(options);assert.equal(restarted.get(j.id).state,'needs_review');assert.equal(restarted.locks.has('A'),true);
 finish({status:'unknown'});await jobs.wait(j.id);assert.equal(jobs.get(j.id).state,'needs_review');assert.equal(jobs.locks.has('A'),true);assert.throws(()=>jobs.create(['A']));
});
test('cleanup rejects unsafe, stale, active-exam and persistence-failed jobs before remote writes',async()=>{
 for(const result of [{...preview,status:'partial'},{...preview,files:[{path:file.path,size:4}]}]){let writes=0;const j=new CleanupPreviewJobs({available:['A'],execute:async()=>result,cleanup:async()=>{writes++}}),p=j.create(['A']);await j.wait(p.id);assert.throws(()=>j.executeCleanup(p.id));assert.equal(writes,0)}
 let busy=false,writes=0,failSave=false;
 const j=new CleanupPreviewJobs({available:['A'],isBusy:()=>busy,execute:async()=>preview,cleanup:async()=>{writes++},storage:{load:()=>[],save:()=>{if(failSave)throw Error('disk')}}}),p=j.create(['A']);await j.wait(p.id);
 busy=true;assert.throws(()=>j.executeCleanup(p.id));busy=false;
 j.jobs.get(p.id).createdAt='2000-01-01T00:00:00.000Z';assert.throws(()=>j.executeCleanup(p.id));j.jobs.get(p.id).createdAt=new Date().toISOString();
 failSave=true;assert.throws(()=>j.executeCleanup(p.id));assert.equal(writes,0);assert.equal(j.locks.size,0);assert.equal(j.list().length,1);
});
test('cleanup API accepts only confirmation and requires write permission',async()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let calls=0;
 const api=createCleanupPreviewApi({jobs:{executeCleanup:()=>{calls++;return {id}}}});
 for(const [data,header,status] of [[{confirmed:true},'cleanup-execute',202],[{confirmed:true,path:'C:\\'},'cleanup-execute',400],[{confirmed:true},'cleanup-preview',403],[{confirmed:false},'cleanup-execute',400]]){
 const req=Object.assign(Readable.from([JSON.stringify(data)]),{url:'/api/cleanup-previews/'+id+'/execute',method:'POST',headers:{'x-classroom-request':header}}),res={writeHead(x){this.status=x},end(){}};await api(req,res);assert.equal(res.status,status);
 }assert.equal(calls,1);assert.equal(routeAction('POST','/api/cleanup-previews/'+id+'/execute'),'software.run');assert.equal(mayAccess('class_teacher',routeAction('POST','/api/cleanup-previews/'+id+'/execute')),false);
});
test('cleanup restart keeps locks when final state persistence failed after device receipt saved',async()=>{
 let saved=[],failFinal=true;
 const options={available:['A'],execute:async()=>preview,cleanup:async()=>({status:'cleaned',deleted:1,verified:true}),storage:{load:()=>structuredClone(saved),save:rows=>{if(failFinal&&rows.some(j=>j.operation==='cleanup'&&j.state==='completed'))throw Error('final disk failure');saved=structuredClone(rows)}}};
 const jobs=new CleanupPreviewJobs(options),p=jobs.create(['A']);await jobs.wait(p.id);const j=jobs.executeCleanup(p.id);await jobs.wait(j.id);
 assert.equal(jobs.locks.has('A'),true);failFinal=false;const restarted=new CleanupPreviewJobs(options);assert.equal(restarted.locks.has('A'),true);assert.throws(()=>restarted.create(['A']));
});
