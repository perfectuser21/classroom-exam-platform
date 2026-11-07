import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassExamPlans} from './class-exam-plans.mjs';
import {AssignmentJobs} from './assignment-jobs.mjs';
import {ReleaseJobs} from './release-jobs.mjs';
const identity={role:'admin'},teacher={username:'teacher',role:'class_teacher'};
function fixture(){
 let roster=[{username:'13800000001',role:'student'},{username:'13800000002',role:'student'}],visible=true,blocked=false;
 const paper={id:'paper',name:'理论',papers:[{version:'A',questions:[]},{version:'B',questions:[]}]},users=[{username:roster[0].username,id:11},{username:roster[1].username,id:12}];
 const assignmentJobs=new AssignmentJobs({getPaper:()=>paper,getPublication:()=>({paperId:'paper',status:'completed',papers:[{version:'A',status:'created',quizId:21,courseModuleId:31},{version:'B',status:'created',quizId:22,courseModuleId:32}]}),getEnrolled:async()=>[11,12],execute:async(id,gs)=>gs.map((g,i)=>({version:g.version,groupId:41+i,courseModuleId:g.courseModuleId,count:g.studentIds.length}))});
 const releaseJobs=new ReleaseJobs({getAssignment:()=>assignmentJobs.list()[0],execute:async p=>p.groups.map(g=>({version:g.version,quizId:g.quizId,courseModuleId:g.courseModuleId}))});
 const plans=new ClassExamPlans({classes:{list:()=>visible?[{id:'class'}]:[],roster:()=>structuredClone(roster)},papers:()=>[paper],resolveStudents:async()=>users,assignmentJobs,releaseJobs,release:paperId=>{if(blocked)throw Error('identity guard');return releaseJobs.create(paperId)},loadSummary:async(quizId,ids)=>({students:ids.map(id=>({id,state:'finished',score:quizId===21?1:2,maxScore:2}))})});
 const plan=plans.create({classId:'class',paperId:'paper'},identity);
 return {plans,plan,assignmentJobs,releaseJobs,setRoster:r=>roster=r,hide:()=>visible=false,block:()=>blocked=true};
}
async function assigned(f){const a=await f.plans.assign(f.plan.id,identity);await f.assignmentJobs.wait(a.id);return a}
test('class plan releases through the shared guard and aggregates A/B scores by bound roster',async()=>{const f=fixture();await assigned(f);const r=f.plans.release(f.plan.id,identity);await f.releaseJobs.wait(r.id);assert.equal(f.releaseJobs.get(r.id).status,'open');const scores=await f.plans.scores(f.plan.id,teacher);assert.deepEqual(scores.students.map(x=>[x.username,x.version,x.score]),[['13800000001','A',1],['13800000002','B',2]]);assert.equal(f.plans.list(teacher)[0].release.status,'open')});
test('class release cannot bypass identity guard, incomplete assignment or changed roster',async()=>{const f=fixture();assert.throws(()=>f.plans.release(f.plan.id,identity));await assigned(f);f.block();assert.throws(()=>f.plans.release(f.plan.id,identity),/identity guard/);f.setRoster([{username:'13800000001',role:'student'}]);assert.throws(()=>f.plans.release(f.plan.id,identity),/名单/);await assert.rejects(()=>f.plans.scores(f.plan.id,identity),/名单/);assert.equal(f.releaseJobs.list().length,0)});
test('class plans and scores are inaccessible outside the visible class',async()=>{const f=fixture();await assigned(f);f.hide();assert.deepEqual(f.plans.list(teacher),[]);assert.throws(()=>f.plans.release(f.plan.id,teacher),/不存在/);await assert.rejects(()=>f.plans.scores(f.plan.id,teacher),/不存在/)});
test('score reads recheck authorization and roster after asynchronous Moodle work',async()=>{const f=fixture();await assigned(f);f.plans.loadSummary=async(q,ids)=>{f.hide();return {students:ids.map(id=>({id,state:'finished',score:1,maxScore:2}))}};await assert.rejects(()=>f.plans.scores(f.plan.id,teacher),/不存在/)});
test('score reads reject missing or extra Moodle student rows',async()=>{const f=fixture();await assigned(f);f.plans.loadSummary=async()=>({students:[{id:999,state:'finished',score:100,maxScore:100}]});await assert.rejects(()=>f.plans.scores(f.plan.id,identity))});

test('plan HTTP routes enforce scope, request headers, release flag and read-only teacher access',async()=>{
 const {createServer}=await import('node:http'),{createClassExamPlanApi}=await import('./class-exam-plan-api.mjs'),{routeAction,mayAccess}=await import('./access-policy.mjs');
 const f=fixture();await assigned(f);const api=createClassExamPlanApi({plans:f.plans});let role='admin';
 const server=createServer((req,res)=>{const action=routeAction(req.method,new URL(req.url,'http://localhost').pathname);if(!mayAccess(role,action)){res.writeHead(403);res.end();return}api(req,res,{role,username:role==='class_teacher'?'teacher':'admin'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,path='/api/class-exam-plans/'+f.plan.id;
 const old=process.env.CLASSROOM_ENABLE_EXAM_RELEASE;
 try{
  const post=(header=true)=>fetch(base+path+'/release',{method:'POST',headers:header?{'x-classroom-request':'class-exam-plan'}:{}});
  delete process.env.CLASSROOM_ENABLE_EXAM_RELEASE;
  assert.equal((await post()).status,503);
  process.env.CLASSROOM_ENABLE_EXAM_RELEASE='1';assert.equal((await post(false)).status,403);
  role='class_teacher';assert.equal((await post()).status,403);assert.equal((await fetch(base+path+'/scores')).status,200);
  f.hide();assert.equal((await fetch(base+path+'/scores')).status,400);
  role='admin';f.plans.classes.list=()=>[{id:'class'}];assert.equal((await post()).status,202);
 }finally{if(old===undefined)delete process.env.CLASSROOM_ENABLE_EXAM_RELEASE;else process.env.CLASSROOM_ENABLE_EXAM_RELEASE=old;await new Promise(r=>server.close(r))}
});
