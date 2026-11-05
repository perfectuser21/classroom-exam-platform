#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../../../../account-store.mjs';
import {FileJobStorage} from '../../../../job-storage.mjs';

const root=new URL('../../../..',import.meta.url);
const repo=fileUrlToPath(root);
const command=process.argv[2];
const evidenceRoot='/tmp/verify-classroom-evidence';
const stateRoot='/tmp/verify-classroom';
const pointer=join(stateRoot,'current-run');
const fixtures={
 admin:{username:'verify_admin',password:'Verify!Admin12345',role:'admin',scope:'all'},
 student:{username:'13900139000',password:'Verify!Student123',next:'Verify!Student456',role:'student',scope:'self'},
 teacher:{username:'13700137000',password:'Verify!Teacher123',role:'class_teacher',scope:'own-classes'},
 instructor:{username:'13600136000',password:'Verify!Lecture123',role:'instructor',scope:'own-classes'},
 examiner:{username:'13800138000',name:'李考评',idNumber:'110101199003078670',role:'examiner',scope:'unfinished-scoring'}
};
const secretValues=[fixtures.admin.password,fixtures.student.password,fixtures.student.next,fixtures.teacher.password,fixtures.instructor.password,fixtures.examiner.idNumber,fixtures.examiner.name,'Verify!Basic123456'];

function fileUrlToPath(url){return new URL(url).pathname}
function fail(message,code=1){console.error(message);process.exit(code)}
function runId(){return process.env.VERIFY_RUN_ID||(existsSync(pointer)?readFileSync(pointer,'utf8').trim():'')}
function paths(id){const state=join(stateRoot,id),evidence=join(evidenceRoot,id);return {id,state,evidence,pid:join(state,'gateway.pid'),log:join(state,'gateway.log'),scaffolding:join(state,'scaffolding.json')}}
function current(){const id=runId();if(!id)fail('没有验证实例。先运行 launch。');return paths(id)}
function writeJson(path,value){writeFileSync(path,JSON.stringify(value,null,2)+'\n')}
function assertClean(text,label){for(const secret of secretValues)if(text.includes(secret))fail(label+' 包含了不应留下的口令或证件号')}

function ensureCredentials(recordPath){
 const dir=join(homedir(),'.credentials');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const created=[];
 const envFile=join(dir,'1password.env');
 const front=join(dir,'classroom-frontend.json');
 if(!existsSync(envFile)){writeFileSync(envFile,'# verify-classroom scaffolding\n',{mode:0o600});created.push(envFile)}
 if(!existsSync(front)){writeFileSync(front,JSON.stringify({username:'verify-basic',password:'Verify!Basic123456'}),{mode:0o600});created.push(front)}
 writeFileSync(recordPath,JSON.stringify(created));
 return {envFile,front,created};
}

async function portFree(port){
 const net=await import('node:net');
 return new Promise(resolve=>{const socket=net.createConnection({port,host:'127.0.0.1'},()=>{socket.end();resolve(false)});socket.on('error',()=>resolve(true))});
}
function alive(pid){try{process.kill(pid,0);return true}catch{return false}}
function readPid(file){if(!existsSync(file))return null;const pid=Number(readFileSync(file,'utf8'));return Number.isInteger(pid)&&pid>0?pid:null}
function ownsGateway(pid,state){
 try{
  const cmdline=readFileSync(`/proc/${pid}/cmdline`,'utf8');
  const environ=readFileSync(`/proc/${pid}/environ`,'utf8');
  return cmdline.includes('gateway.mjs')&&environ.includes('CLASSROOM_STATE_DIR='+state);
 }catch{return false}
}

async function sharpReady(){
 const child=spawn(process.execPath,['--input-type=module','-e','await import("sharp")'],{cwd:repo,stdio:'ignore'});
 const code=await new Promise(resolve=>child.on('exit',resolve));
 return code===0;
}

async function launch(){
 const id=process.env.VERIFY_RUN_ID||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
 const run=paths(id);
 if(existsSync(run.pid)){const pid=readPid(run.pid);if(pid&&ownsGateway(pid,run.state)){console.log('already running '+run.evidence);return}}
 mkdirSync(run.state,{recursive:true,mode:0o700});
 mkdirSync(run.evidence,{recursive:true,mode:0o700});
 mkdirSync(stateRoot,{recursive:true,mode:0o700});
 writeFileSync(pointer,id);
 const port=Number(process.env.VERIFY_PORT||18111);
 if(!Number.isInteger(port)||port<1||port>65535)fail('VERIFY_PORT 无效');
 if(!await portFree(port))fail('端口 '+port+' 已被占用。换 VERIFY_PORT，不要停掉别人的进程。');
 if(!await sharpReady()){const blocker={result:'FAIL',reason:'gateway 无法加载 sharp。在仓库根目录运行 npm ci 后再 launch。'};writeJson(join(run.evidence,'launch.json'),blocker);fail(blocker.reason)}
 const creds=ensureCredentials(run.scaffolding);
 if(!existsSync(creds.envFile))fail('缺少 '+creds.envFile);
 const store=new AccountStore({storage:new FileJobStorage(join(run.state,'staff-accounts.json'))});
 await store.create({username:fixtures.admin.username,password:fixtures.admin.password,role:'admin'});
 await store.create({username:fixtures.student.username,password:fixtures.student.password,role:'student'});
 await store.create({username:fixtures.teacher.username,password:fixtures.teacher.password,role:'class_teacher'});
 await store.create({username:fixtures.instructor.username,password:fixtures.instructor.password,role:'instructor'});
 await store.create({username:fixtures.examiner.username,role:'examiner',name:fixtures.examiner.name,idNumber:fixtures.examiner.idNumber});
 const logFd=openSync(run.log,'a');
 const child=spawn(process.execPath,[join(repo,'gateway.mjs')],{cwd:repo,detached:true,env:{...process.env,CLASSROOM_STATE_DIR:run.state,CLASSROOM_PORT:String(port),CLASSROOM_ENABLE_STAFF_AUTH:'1'},stdio:['ignore',logFd,logFd]});
 closeSync(logFd);
 const ready=await new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(false),20000);
  const poll=setInterval(()=>{
   if(!alive(child.pid)){clearInterval(poll);clearTimeout(timer);resolve(false);return}
   if(existsSync(run.log)&&readFileSync(run.log,'utf8').includes('本地管理页面已启动')){clearInterval(poll);clearTimeout(timer);resolve(true)}
  },100);
 });
 if(!ready){const tail=existsSync(run.log)?readFileSync(run.log,'utf8').slice(-2000):'';writeJson(join(run.evidence,'launch.json'),{result:'FAIL',reason:'gateway 未打印 本地管理页面已启动',log:tail});if(child.pid&&alive(child.pid))process.kill(child.pid,'SIGTERM');fail('gateway 没有启动。日志在 '+run.log)}
 writeFileSync(run.pid,String(child.pid));
 child.unref();
 writeJson(join(run.evidence,'run.json'),{id,port,pid:child.pid,state:run.state,evidence:run.evidence,scaffoldingCreated:creds.created});
 console.log(run.evidence);
}

async function doctor(){
 const run=current();
 const pid=readPid(run.pid);
 const report={pid,state:run.state};
 if(!pid||!alive(pid)||!ownsGateway(pid,run.state)){report.result='FAIL';report.reason='验证进程不在，或端口不是这次 launch 启动的 gateway';writeJson(join(run.evidence,'doctor.json'),report);fail(report.reason)}
 const meta=JSON.parse(readFileSync(join(run.evidence,'run.json'),'utf8'));
 const base='http://127.0.0.1:'+meta.port;
 const staff=await fetch(base+'/staff');
 const candidate=await fetch(base+'/candidate');
 const staffHtml=await staff.text();
 const candidateHtml=await candidate.text();
 report.staff=staff.status;report.candidate=candidate.status;
 report.staffLogin=staffHtml.includes('id="login"')&&staffHtml.includes('id="examiner-login"');
 report.candidateLogin=candidateHtml.includes('id="login-form"')&&candidateHtml.includes('id="student-login-form"');
 report.result=staff.status===200&&candidate.status===200&&report.staffLogin&&report.candidateLogin?'PASS':'FAIL';
 writeJson(join(run.evidence,'doctor.json'),report);
 if(report.result!=='PASS')fail('Doctor 失败 '+JSON.stringify(report));
 console.log('PASS '+join(run.evidence,'doctor.json'));
}

function cookieOf(response){const raw=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];const line=raw.find(item=>item.startsWith('__Host-classroom='));if(!line)return '';return line.split(';')[0]}
async function login(base,body){
 const response=await fetch(base+'/api/staff/login',{method:'POST',headers:{'content-type':'application/json','x-classroom-request':'staff-login'},body:JSON.stringify(body)});
 const data=await response.json();
 return {status:response.status,data,cookie:cookieOf(response)};
}
async function authed(base,path,cookie,options={}){
 const response=await fetch(base+path,{...options,headers:{...options.headers,cookie}});
 const text=await response.text();
 let data=text;try{data=JSON.parse(text)}catch{}
 return {status:response.status,data};
}
function expectIdentity(result,fixture,label){
 if(result.status!==200||result.data.role!==fixture.role||result.data.scope!==fixture.scope||!result.cookie)fail(label+' 登录结果不符合矩阵');
 if(JSON.stringify(result.data).includes(fixtures.examiner.idNumber))fail(label+' 回传了身份证号');
}

async function drive(){
 if(process.argv[3]!=='login')fail('只实现了 drive login');
 const run=current();
 const doctorFile=join(run.evidence,'doctor.json');
 if(!existsSync(doctorFile)||JSON.parse(readFileSync(doctorFile,'utf8')).result!=='PASS')fail('先让 doctor 通过，再 drive');
 const meta=JSON.parse(readFileSync(join(run.evidence,'run.json'),'utf8'));
 const base='http://127.0.0.1:'+meta.port;
 const dir=join(run.evidence,'login');
 mkdirSync(dir,{recursive:true});
 const staffPage=await fetch(base+'/staff');
 const candidatePage=await fetch(base+'/candidate');
 writeFileSync(join(dir,'staff.html'),await staffPage.text());
 writeFileSync(join(dir,'candidate.html'),await candidatePage.text());
 const admin=await login(base,{username:fixtures.admin.username,password:fixtures.admin.password});
 expectIdentity(admin,fixtures.admin,'管理员');
 const adminMe=await authed(base,'/api/staff/me',admin.cookie);
 if(adminMe.status!==200||adminMe.data.role!=='admin'||adminMe.data.scope!=='all')fail('管理员会话没有保留');
 const teacher=await login(base,{username:fixtures.teacher.username,password:fixtures.teacher.password});
 expectIdentity(teacher,fixtures.teacher,'班主任');
 const teacherExam=await authed(base,'/api/exams',teacher.cookie);
 if(teacherExam.status!==403)fail('班主任不应读到全局考试接口');
 const instructor=await login(base,{username:fixtures.instructor.username,password:fixtures.instructor.password});
 expectIdentity(instructor,fixtures.instructor,'讲师');
 const instructorExam=await authed(base,'/api/exams',instructor.cookie);
 if(instructorExam.status!==403)fail('讲师不应读到全局考试接口');
 const examiner=await login(base,{name:fixtures.examiner.name,idNumber:fixtures.examiner.idNumber,phone:fixtures.examiner.username});
 expectIdentity(examiner,fixtures.examiner,'考评员');
 const examinerPassword=await login(base,{username:fixtures.examiner.username,password:fixtures.examiner.idNumber});
 if(examinerPassword.status!==401)fail('考评员身份账号不能用密码字段登录');
 const student=await login(base,{phone:fixtures.student.username,password:fixtures.student.password});
 expectIdentity(student,fixtures.student,'学员');
 const studentExam=await authed(base,'/api/exams',student.cookie);
 if(studentExam.status!==403)fail('学员不应读到管理接口');
 const changed=await authed(base,'/api/staff/password',student.cookie,{method:'POST',headers:{'content-type':'application/json','x-classroom-request':'staff-password'},body:JSON.stringify({password:fixtures.student.next})});
 if(changed.status!==200||changed.data.ok!==true)fail('学员没有改成自己的密码');
 const oldLogin=await login(base,{phone:fixtures.student.username,password:fixtures.student.password});
 if(oldLogin.status!==401)fail('学员旧密码仍然可用');
 const again=await login(base,{phone:fixtures.student.username,password:fixtures.student.next});
 expectIdentity(again,fixtures.student,'学员新密码');
 const proof={
  result:'PASS',
  feature:'login',
  pages:['/staff','/candidate'],
  actions:[
   {page:'staff.html',form:'login',fields:['username','password'],role:'admin',scope:'all',me:adminMe.status},
   {page:'staff.html',form:'login',fields:['username','password'],role:'class_teacher',scope:'own-classes',exams:teacherExam.status},
   {page:'staff.html',form:'login',fields:['username','password'],role:'instructor',scope:'own-classes',exams:instructorExam.status},
   {page:'staff.html',form:'examiner-login',fields:['name','idNumber','phone'],role:'examiner',scope:'unfinished-scoring',passwordForm:examinerPassword.status},
   {page:'candidate.html',form:'student-login-form',fields:['phone','password'],role:'student',scope:'self',passwordChanged:changed.status,oldPassword:oldLogin.status,relogin:again.status,exams:studentExam.status}
  ]
 };
 const encoded=JSON.stringify(proof);
 assertClean(encoded,'login proof');
 assertClean(readFileSync(join(dir,'staff.html'),'utf8'),'staff.html');
 writeJson(join(dir,'proof.json'),proof);
 writeJson(join(run.evidence,'report.json'),proof);
 console.log('PASS '+join(dir,'proof.json'));
}

function evidence(){
 const run=current();
 const file=join(run.evidence,'report.json');
 if(!existsSync(file))fail('没有 '+file);
 const report=JSON.parse(readFileSync(file,'utf8'));
 if(report.result!=='PASS'||!existsSync(join(run.evidence,'login','proof.json'))||!existsSync(join(run.evidence,'doctor.json')))fail('证据不完整');
 console.log('PASS '+run.evidence);
}

async function cleanup(){
 const run=current();
 const pid=readPid(run.pid);
 if(pid&&ownsGateway(pid,run.state)){
  process.kill(pid,'SIGTERM');
  for(let i=0;i<30&&alive(pid);i++)await new Promise(resolve=>setTimeout(resolve,100));
  if(alive(pid)&&ownsGateway(pid,run.state))process.kill(pid,'SIGKILL');
 }
 if(existsSync(run.scaffolding)){
  for(const file of JSON.parse(readFileSync(run.scaffolding,'utf8')))if(typeof file==='string'&&file.startsWith(join(homedir(),'.credentials')+'/'))rmSync(file,{force:true});
 }
 rmSync(run.state,{recursive:true,force:true});
 console.log('cleaned '+run.state);
 console.log('kept '+run.evidence);
}

const commands={launch,doctor,drive,evidence,cleanup};
if(!commands[command])fail('用法: verify-classroom.mjs launch|doctor|drive login|evidence|cleanup');
await commands[command]();
