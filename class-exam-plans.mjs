import {randomUUID} from 'node:crypto';
import {prepareExamRelease} from './exam-release.mjs';
export class ClassExamPlans {
 constructor({classes,papers,resolveStudents,assignmentJobs,releaseJobs,release,loadSummary,storage={load:()=>[],save:()=>{}}}){
  Object.assign(this,{classes,papers,resolveStudents,assignmentJobs,releaseJobs,releasePaper:release,loadSummary,storage});
  this.items=storage.load();this.assigning=new Set();if(!Array.isArray(this.items))throw Error('考试计划数据无效');
 }
 list(identity){
  const allowed=new Set(this.classes.list(identity).map(c=>c.id));
  return structuredClone(this.items.filter(p=>allowed.has(p.classId)).map(p=>({...p,
   name:this.papers().find(x=>x.id===p.paperId)?.name||'理论考试',
   assignment:this.assignmentJobs?.list?.().find(a=>a.paperId===p.paperId)||null,
   release:this.releaseJobs?.list?.().filter(r=>r.paperId===p.paperId).at(-1)||null
  })));
 }
 get(id,identity){const p=this.list(identity).find(x=>x.id===id);if(!p)throw Error('考试计划不存在');return p}
 options(identity){if(!this.classes.list(identity).length)return [];return this.papers().filter(p=>!this.items.some(x=>x.paperId===p.id)).map(({id,name})=>({id,name}))}
 create({classId,paperId},identity){
  const c=this.classes.list(identity).find(x=>x.id===classId),paper=this.papers().find(x=>x.id===paperId);
  if(!c||!paper)throw Error('班级或试卷不存在');if(this.items.some(x=>x.paperId===paperId))throw Error('试卷已有考试计划');if(this.items.length>=1000)throw Error('考试计划已满');
  const p={id:randomUUID(),classId,paperId,createdAt:new Date().toISOString()},next=[...this.items,p];this.storage.save(next);this.items=next;return structuredClone(p);
 }
 roster(plan){
  const rows=this.classes.roster(plan.classId);
  if(!Array.isArray(rows)||!rows.length||rows.length>50||rows.some(r=>r.role!=='student'||r.disabled)||new Set(rows.map(r=>r.username)).size!==rows.length)throw Error('班级名单无效');
  return rows;
 }
 sameRoster(plan,expected){
  const rows=this.roster(plan);
  if(rows.length!==expected.length||rows.some((r,i)=>r.username!==expected[i].username))throw Error('班级名单已变化，请核对考试计划');
 }
 async assign(id,identity){
  const p=this.get(id,identity),roster=this.roster(p),paper=this.papers().find(x=>x.id===p.paperId);
  if(!paper||p.roster||this.assigning.has(id))throw Error('考试计划已分配或状态待核实');
  this.assigning.add(id);
  try{
   const users=await this.resolveStudents();this.get(id,identity);this.sameRoster(p,roster);
   const ids=roster.map(r=>{const matches=users.filter(u=>u.username===r.username&&Number.isSafeInteger(u.id)&&u.id>0);if(matches.length!==1)throw Error('名单中的学生尚未关联 Moodle 考生');return matches[0].id});
   if(new Set(ids).size!==ids.length)throw Error('Moodle 考生重复');const versions=paper.papers.map(x=>x.version);if(!versions.length||ids.length<versions.length)throw Error('考生不足以分配试卷版本');
   const job=await this.assignmentJobs.create(p.paperId,ids.map((studentId,i)=>({studentId,version:versions[i%versions.length]})));
   // The binding is immutable. A failed save leaves release blocked for review.
   const next=this.items.map(x=>x.id===id?{...x,assignmentId:job.id,roster:roster.map((r,i)=>({username:r.username,studentId:ids[i],version:versions[i%versions.length]}))}:x);
   this.storage.save(next);this.items=next;return job;
  }finally{this.assigning.delete(id)}
 }
 bound(id,identity){
  const p=this.get(id,identity);if(!Array.isArray(p.roster)||!p.roster.length)throw Error('考试计划尚未绑定名单');this.sameRoster(p,p.roster);
  const a=this.assignmentJobs.get(p.assignmentId);const release=prepareExamRelease(a);
  if(release.paperId!==p.paperId||p.roster.length!==release.groups.reduce((n,g)=>n+g.studentIds.length,0)||p.roster.some(r=>!release.groups.some(g=>g.version===r.version&&g.studentIds.includes(r.studentId))))throw Error('考试分配与班级名单不一致');
  return {plan:p,groups:release.groups};
 }
 release(id,identity){const {plan}=this.bound(id,identity);return this.releasePaper(plan.paperId)}
 async scores(id,identity){
  const {plan,groups}=this.bound(id,identity),students=[];
  for(const group of groups){
   const summary=await this.loadSummary(group.quizId,group.studentIds,plan.name);
   if(!Array.isArray(summary?.students)||summary.students.length!==group.studentIds.length||group.studentIds.some(id=>summary.students.filter(r=>r.id===id).length!==1))throw Error('班级成绩名单不一致');
   students.push(...summary.students.map(row=>({...row,username:plan.roster.find(r=>r.studentId===row.id).username,version:group.version,quizId:group.quizId})));
  }
  this.bound(id,identity);
  return {planId:id,classId:plan.classId,paperId:plan.paperId,name:plan.name,students};
 }
}
