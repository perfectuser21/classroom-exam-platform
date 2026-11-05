import {writeFileSync} from 'node:fs';
const base='http://127.0.0.1:18199',checks=[];
function check(ok,label){checks.push(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)throw Error(label)}
async function request(path,method='GET',body,cookie='',kind='question-draft'){
 const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),'content-type':'application/json','x-classroom-request':kind},...(body?{body:JSON.stringify(body)}:{})});let data={};try{data=await r.json()}catch{}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
try{
 const login=await request('/api/staff/login','POST',{username:'verify_admin',password:'Verify-only-admin-password-2026!'},'','staff-login');check(login.status===200,'bank admin login');const c=login.cookie;
 const standard=await request('/api/standards','POST',{occupation:'验证专业',level:5,modules:[{name:'基础',weight:100,knowledge:['安全']}]},c,'standard-draft');check(standard.status===201&&standard.data.id,'specialty and level');
 const input={level:5,type:'single',stem:'验证题目',options:['正确','错误'],answers:[0],points:1};
 const q=await request('/api/questions','POST',input,c);check(q.status===201&&q.data.id,'bank create');
 const edit=await request('/api/questions/'+q.data.id,'PUT',{...input,stem:'验证题目更新'},c);check(edit.status===200&&edit.data.id===q.data.id,'bank edit retains ID');
 const classification={standardId:standard.data.id,module:'基础',knowledge:'安全'};
 check((await request('/api/questions/'+q.data.id+'/classification','POST',{classification},c,'question-classification')).status===200,'bank classify');
 const list=await request('/api/questions?level=5&standardId='+standard.data.id,'GET',null,c);check(list.status===200&&list.data.some(x=>x.id===q.data.id&&x.stem==='验证题目更新'),'bank scoped list');
 const paper=await request('/api/papers','POST',{name:'验证试卷',level:5,counts:{single:1},versions:1,duration:30,standardId:standard.data.id,targetPoints:1},c,'paper-draft');check(paper.status===201&&paper.data.papers[0].questions[0].id===q.data.id,'weighted paper build with stable question ID');
 check((await request('/api/questions/'+q.data.id,'DELETE',null,c)).status===400,'paper question protected');
 const extra=await request('/api/questions','POST',{...input,stem:'待删除题目'},c);check(extra.status===201&&(await request('/api/questions/'+extra.data.id,'DELETE',null,c)).status===200,'bank delete draft');
}catch(e){if(!checks.at(-1)?.startsWith('FAIL'))checks.push('FAIL bank drive: '+e.message)}
writeFileSync(process.argv[2],checks.join('\n')+'\n');process.stdout.write(checks.join('\n')+'\n');if(checks.some(x=>x.startsWith('FAIL')))process.exitCode=1;
