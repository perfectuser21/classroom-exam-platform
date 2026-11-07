import {writeFileSync} from 'node:fs';
const base='http://127.0.0.1:18199',out=process.argv[2],checks=[];
function check(ok,label){checks.push(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)throw Error(label)}
async function request(path,method='GET',body,cookie=''){
 const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),'content-type':'application/json','x-classroom-request':path==='/api/staff/login'?'staff-login':'org-management'},...(body?{body:JSON.stringify(body)}:{})});let data={};try{data=await r.json()}catch{}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
try{
 const login=await request('/api/staff/login','POST',{username:'verify_admin',password:'Verify-only-admin-password-2026!'});check(login.status===200&&login.data.role==='admin','admin login');const c=login.cookie;
 const company=await request('/api/org','POST',{type:'company',name:'验证公司'},c);check(company.status===201,'create company');
 const department=await request('/api/org','POST',{type:'department',name:'验证部门',parentId:company.data.id},c);check(department.status===201,'create department');
 check((await request('/api/org/'+company.data.id,'PUT',{name:'验证公司更新'},c)).status===200,'edit company');
 check((await request('/api/org/'+department.data.id,'PUT',{name:'验证部门更新'},c)).status===200,'edit department');
 for(const [i,role] of ['admin','student','class_teacher','instructor','examiner'].entries()){
  const username='13800138'+String(100+i).padStart(3,'0');const identity=role==='examiner'?{name:'验证考评员',idNumber:'110101199001010011'}:{};
  const r=await request('/api/org/users','POST',{username,password:'Verify-only-password-2026!',role,departmentId:department.data.id,...identity},c);check(r.status===201&&r.data.role===role,'create '+role);
 }
 const users=await request('/api/org/users','GET',null,c);check(users.status===200&&users.data.length===5&&users.data.every(x=>x.departmentId===department.data.id),'list scoped users');
 const username='13800138101';let r=await request('/api/org/users/'+username,'PUT',{role:'instructor',departmentId:department.data.id,disabled:true},c);check(r.status===200&&r.data.role==='instructor'&&r.data.disabled,'change role and disable');
 r=await request('/api/org/users/'+username,'PUT',{role:'student',departmentId:department.data.id,disabled:false},c);check(r.status===200&&r.data.role==='student'&&!r.data.disabled,'enable and restore role');
 check((await request('/api/org/users/'+username,'DELETE',null,c)).status===200,'delete user (disable)');
 const tree=await request('/api/org','GET',null,c);check(tree.data.some(x=>x.id===department.data.id&&x.parentId===company.data.id),'list hierarchy');
 check((await request('/api/org/'+company.data.id,'DELETE',null,c)).status===400,'reject deleting populated company');
 const empty=await request('/api/org','POST',{type:'company',name:'待删除'},c);check((await request('/api/org/'+empty.data.id,'DELETE',null,c)).status===200,'delete empty company');
 const teacher=await request('/api/staff/login','POST',{username:'13800138001',password:'Verify-only-password-2026!'});check((await request('/api/org','GET',null,teacher.cookie)).status===403,'non-admin denied');
}catch(e){if(!checks.at(-1)?.startsWith('FAIL'))checks.push('FAIL org drive: '+e.message)}
writeFileSync(out,checks.join('\n')+'\n');process.stdout.write(checks.join('\n')+'\n');if(checks.some(x=>x.startsWith('FAIL')))process.exitCode=1;
