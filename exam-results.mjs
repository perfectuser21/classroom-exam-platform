export function summarizeExam(exam,users,attempts,grades){
 if(!exam||!Number.isInteger(Number(exam.id))||!Array.isArray(users))throw Error('考试结果不完整');
 return {id:exam.id,name:exam.name,students:users.map(u=>{
  const list=attempts[u.id];if(!Array.isArray(list))throw Error('考生答卷读取失败');
  const latest=[...list].sort((a,b)=>(Number(b.attempt)||0)-(Number(a.attempt)||0))[0];
  const items=grades[u.id]?.gradeitems??[];if(!Array.isArray(items))throw Error('成绩读取失败');
  const item=items.find(x=>x.itemmodule==='quiz'&&Number(x.iteminstance)===Number(exam.id));
  return {id:u.id,name:u.fullname||u.username||'未命名考生',state:latest?.state??'not_started',score:latest?.state==='finished'&&typeof item?.graderaw==='number'?item.graderaw:null,maxScore:latest?.state==='finished'&&typeof item?.grademax==='number'?item.grademax:null};
 })};
}
export async function loadExamSummary(exam,call,{studentIds}={}){
 if(!Number.isInteger(Number(exam?.id))||!Number.isInteger(Number(exam?.course)))throw Error('考试信息无效');
 const enrolled=await call('core_enrol_get_enrolled_users',{courseid:exam.course});
 if(!Array.isArray(enrolled)||enrolled.some(u=>!Array.isArray(u.roles)))throw Error('考生列表读取失败');
 let users=enrolled.filter(u=>u.roles.some(r=>r.shortname==='student'));if(studentIds!==undefined){if(!Array.isArray(studentIds)||new Set(studentIds).size!==studentIds.length||studentIds.some(id=>!Number.isSafeInteger(id)||id<1||users.filter(u=>Number(u.id)===id).length!==1))throw Error('考试考生名单不一致');users=users.filter(u=>studentIds.includes(Number(u.id)))}
 if(users.length>50)throw Error('考生数量超出试点范围');
 const attempts={},grades={};
 await Promise.all(users.map(async u=>{
  const [a,g]=await Promise.all([call('mod_quiz_get_user_quiz_attempts',{quizid:exam.id,userid:u.id,status:'all'}),call('gradereport_user_get_grade_items',{courseid:exam.course,userid:u.id})]);
  if(!Array.isArray(a?.attempts)||!Array.isArray(g?.usergrades)||!g.usergrades[0]||!Array.isArray(g.usergrades[0].gradeitems))throw Error('答卷或成绩读取失败');
  attempts[u.id]=a.attempts;grades[u.id]=g.usergrades[0];
 }));
 return summarizeExam(exam,users,attempts,grades);
}
