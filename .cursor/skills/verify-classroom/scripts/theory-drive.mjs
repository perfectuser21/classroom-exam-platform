import {readFileSync,writeFileSync,existsSync,unlinkSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {chromium} from 'playwright';
import {runtimeBin} from '../../../../runtime-bins.mjs';
import {moodleCandidateCall} from '../../../../moodle-candidate.mjs';
const mode=process.argv[2],run=resolve(process.argv[3]||'.classroom-evidence/current'),base='http://127.0.0.1:18199';
mkdirSync(run,{recursive:true,mode:0o700});
const privateFile=join(run,'theory-private.json'),checks=[];
function record(ok,label){const line=`${ok?'PASS':'FAIL'} ${label}`;checks.push(line);console.log(line);if(!ok)throw Error(label)}
function savePrivate(m){writeFileSync(privateFile,JSON.stringify(m),{mode:0o600})}
function moodle(payload){
 const php=readFileSync(new URL('./theory-moodle.php',import.meta.url),'utf8');
 return new Promise((resolve,reject)=>{const p=execFile(runtimeBin('docker'),['exec','-i','classroom_moodle_pilot-webserver-1','php','-r',php],{timeout:60000,maxBuffer:1048576},(e,out)=>{if(e)return reject(Error('Moodle verification '+payload.action+' failed'));try{resolve(JSON.parse(out))}catch{reject(Error('Moodle verification receipt invalid'))}});p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(payload))});
}
let browser;
try{
 if(mode==='doctor'){
  record(existsSync(chromium.executablePath()),'R4 browser runtime available');
  const m=await moodle({action:'doctor'});record(m.ok,'R4 Moodle provisioning, availability and cleanup prerequisites');
  const token=JSON.parse(readFileSync(process.env.HOME+'/.credentials/moodle-pilot-api.json','utf8')).token;
  const users=await moodleCandidateCall('core_enrol_get_enrolled_users',{courseid:2},token);
  record(Array.isArray(users),'R4 Moodle roster API reachable');
 }else if(mode==='cleanup'){
  if(!existsSync(privateFile)){
   // Idempotent cleanup keeps the original deletion receipt; missing Drive is never PASS.
   if(existsSync(join(run,'theory-cleanup.txt')))process.exit(0);
   record(false,'R4 cleanup manifest missing');
  }
  const m=JSON.parse(readFileSync(privateFile,'utf8'));
  const result=await moodle({...m,action:'cleanup'});
  record(result.ok&&result.deletedUser&&result.sharedAccountsUnchanged,'R4 disposable Moodle identity, enrolment, tokens, attempts, grades, quiz, group and question cleanup; shared pilots unchanged');
  writeFileSync(join(run,'theory-cleanup.json'),JSON.stringify(result,null,2)+'\n');
  unlinkSync(privateFile);
 }else if(mode==='drive'){
  if(existsSync(privateFile))throw Error('R4 previous cleanup is pending');
  const before=await moodle({action:'doctor'});
  const m={runId:randomUUID(),username:'139'+String(randomBytes(4).readUInt32BE()%100000000).padStart(8,'0'),password:randomBytes(24).toString('base64url')+'Aa1!',paperIds:[],questionIds:[],sharedFingerprint:before.sharedFingerprint};savePrivate(m);
  const person=await moodle({...m,action:'provision'});m.userId=person.userId;savePrivate(m);
  record(person.ok&&Number.isSafeInteger(m.userId),'R4 disposable phone-username Moodle student provisioned');
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext(),api=ctx.request;
  async function req(path,method='GET',body,kind='class-exam-plan',status=200){
   const r=await api.fetch(base+path,{method,headers:{'x-classroom-request':kind},...(body!==undefined?{data:body}:{})});
   if(r.status()!==status)throw Error(`R4 HTTP ${method} ${path}: expected ${status}, got ${r.status()}`);
   return r.json();
  }
  async function poll(path,field,want){for(let i=0;i<80;i++){const row=await req(path);if(row[field]===want)return row;if(['unknown','needs_review'].includes(row[field]))throw Error('R4 external job needs review');await new Promise(r=>setTimeout(r,250))}throw Error('R4 job timed out')}
  await req('/api/staff/login','POST',{username:'verify_admin',password:'Verify-only-admin-password-2026!'},'staff-login');
  const company=await req('/api/org','POST',{type:'company',name:'R4 Verify '+m.runId},'org-management',201);
  const dept=await req('/api/org','POST',{type:'department',name:'R4 Department',parentId:company.id},'org-management',201);
  await req('/api/org/users','POST',{username:m.username,role:'student',departmentId:dept.id,password:m.password},'org-management',201);
  const standard=await req('/api/standards','POST',{occupation:'R4 '+m.runId,level:5,modules:[{name:'基础',weight:100,knowledge:['理论']}]},'standard-draft',201);
  const cl=await req('/api/classes','POST',{name:'R4 '+m.runId,orgId:dept.id,standardId:standard.id,teacher:'13800138001'},'class-management',201);
  const roster=await req('/api/classes/'+cl.id+'/roster','POST',{usernames:[m.username]},'class-management');
  record(roster.length===1&&roster[0].username===m.username,'R4 disposable identity joins the R3 class roster');
  const q=await req('/api/questions','POST',{level:5,type:'single',stem:'R4 '+m.runId+' 理论：选择正确答案',options:['正确答案','错误答案'],answers:[0],points:1},'question-draft',201);
  m.questionIds.push(q.id);savePrivate(m);
  await req('/api/questions/'+q.id+'/classification','POST',{classification:{standardId:standard.id,module:'基础',knowledge:'理论'}},'question-classification');
  const qp=await req('/api/question-publications','POST',{questionId:q.id},'question-publish',202);await poll('/api/question-publications/'+qp.id,'status','published');
  const paper=await req('/api/papers','POST',{name:'R4 '+m.runId,level:5,counts:{single:1},versions:1,duration:30,standardId:standard.id,targetPoints:1},'paper-draft',201);
  m.paperIds.push(paper.id);savePrivate(m);
  const pub=await req('/api/paper-publications','POST',{paperId:paper.id},'paper-publish',202),publication=await poll('/api/paper-publications/'+pub.id,'status','completed');
  record(publication.papers.length===1&&publication.papers[0].status==='created','R4 real Moodle question and hidden quiz published');
  const page=await ctx.newPage();page.setDefaultTimeout(25000);
  await page.goto(base+'/classes');await page.getByRole('button',{name:cl.name,exact:true}).click();
  await page.locator('#planPaper').selectOption(paper.id);await page.getByRole('button',{name:'创建考试计划',exact:true}).click();
  const row=page.locator('#plans li').filter({hasText:paper.name});await row.getByRole('button',{name:'分配试卷',exact:true}).waitFor();
  let plans=await req('/api/class-exam-plans'),plan=plans.find(p=>p.classId===cl.id&&p.paperId===paper.id);record(!!plan,'R4 class UI creates the class/paper plan');
  await row.getByRole('button',{name:'分配试卷',exact:true}).click();
  for(let i=0;i<80;i++){plan=(await req('/api/class-exam-plans')).find(p=>p.id===plan.id);if(plan.assignment?.status==='prepared')break;if(plan.assignment?.status==='unknown')throw Error('R4 assignment needs review');await new Promise(r=>setTimeout(r,250))}
  record(plan.assignment?.status==='prepared'&&plan.roster[0].studentId===m.userId,'R4 class plan assigns the complete roster to Moodle');
  // This must fail with identity verification enabled; no release job may be created.
  const denied=await api.post(base+'/api/class-exam-plans/'+plan.id+'/release',{headers:{'x-classroom-request':'class-exam-plan'}});
  record(denied.status()===400&&(await denied.json()).error.includes('工位'),'R4 release blocks missing seat and identity checks');
  await req('/api/seat-maps','POST',{paperId:paper.id,assignments:[{studentId:m.userId,device:'WIN-20230823FUQ'}]},'seat-map');
  const unchecked=await api.post(base+'/api/class-exam-plans/'+plan.id+'/release',{headers:{'x-classroom-request':'class-exam-plan'}});
  record(unchecked.status()===400&&(await unchecked.json()).error.includes('身份'),'R4 release blocks unconfirmed candidate identity');
  await req('/api/identity-checks','POST',{paperId:paper.id,studentId:m.userId,confirmed:true},'identity-check');
  await page.getByRole('button',{name:'刷新计划与成绩'}).click();await row.getByRole('button',{name:'放卷',exact:true}).click();
  for(let i=0;i<80;i++){plan=(await req('/api/class-exam-plans')).find(p=>p.id===plan.id);if(plan.release?.status==='open')break;if(plan.release?.status==='unknown')throw Error('R4 release needs review');await new Promise(r=>setTimeout(r,250))}
  record(plan.release?.status==='open','R4 class UI guarded release opens the roster-restricted Moodle quiz');
  await page.getByRole('button',{name:'刷新计划与成绩'}).click();await page.screenshot({path:join(run,'r4-class-release.png'),fullPage:true});
  const candidateCtx=await browser.newContext(),candidate=await candidateCtx.newPage();candidate.setDefaultTimeout(25000);candidate.on('dialog',d=>d.accept());
  await candidate.goto(base+'/candidate');await candidate.locator('[name=username]').fill(m.username);await candidate.locator('[name=password]').fill(m.password);
  const loginResponse=candidate.waitForResponse(r=>r.url()===base+'/api/candidate/login');await candidate.locator('#login-form button').click();const logged=await loginResponse;
  const loggedBody=await logged.json();record(logged.status()===200&&loggedBody.ok===true,'R4 disposable candidate Moodle login through real gateway');
  writeFileSync(join(run,'candidate-login.json'),JSON.stringify(loggedBody)+'\n');writeFileSync(join(run,'candidate-drive.txt'),'PASS candidate Moodle login (disposable R4 student)\n');
  const quizName='试点草稿 '+paper.name+' [A]';const examRow=candidate.locator('#exam-list > div').filter({hasText:quizName});await examRow.getByRole('button',{name:'开始或继续'}).click();
  await candidate.locator('#questions input[type=radio]').first().check();
  record(await candidate.locator('#question-nav button').count()>0,'R4 candidate answer card rendered from real Moodle attempt');
  await candidate.screenshot({path:join(run,'r4-answer-card.png'),fullPage:true});
  await candidate.locator('#answers button[type=submit]').click();await candidate.waitForFunction(()=>document.querySelector('#notice').textContent.startsWith('交卷成功'));
  record(true,'R4 candidate submits the answer card and Moodle confirms finished');
  await candidate.screenshot({path:join(run,'r4-submitted.png'),fullPage:true});
  let scores;for(let i=0;i<40;i++){scores=await req('/api/class-exam-plans/'+plan.id+'/scores');if(scores.students[0]?.state==='finished'&&scores.students[0]?.score===1)break;await new Promise(r=>setTimeout(r,250))}
  record(scores.students.length===1&&scores.students[0].id===m.userId&&scores.students[0].username===m.username&&scores.students[0].state==='finished'&&scores.students[0].score===1&&scores.students[0].maxScore===1,'R4 class-scoped theory score is 1 / 1 for the submitted roster student');
  writeFileSync(join(run,'r4-class-scores.json'),JSON.stringify(scores,null,2)+'\n');
  await row.getByRole('button',{name:'班级成绩',exact:true}).click();await page.locator('#classScores table').waitFor();
  record((await page.locator('#classScores').innerText()).includes('1 / 1'),'R4 class UI displays the submitted theory score');
  await page.screenshot({path:join(run,'r4-class-scores.png'),fullPage:true});
  // Assigned teacher can read these scores, while an unassigned teacher cannot.
  const teacherCtx=await browser.newContext(),tr=teacherCtx.request;
  await tr.post(base+'/api/staff/login',{headers:{'x-classroom-request':'staff-login'},data:{username:'13800138001',password:'Verify-only-password-2026!'}});
  record((await tr.get(base+'/api/class-exam-plans/'+plan.id+'/scores')).status()===200,'R4 assigned class teacher can read class theory scores');
  const other='13800138333';await req('/api/org/users','POST',{username:other,role:'class_teacher',departmentId:dept.id,password:'Verify-only-password-2026!'},'org-management',201);
  const otherCtx=await browser.newContext(),or=otherCtx.request;await or.post(base+'/api/staff/login',{headers:{'x-classroom-request':'staff-login'},data:{username:other,password:'Verify-only-password-2026!'}});
  record((await or.get(base+'/api/class-exam-plans/'+plan.id+'/scores')).status()===400,'R4 unassigned teacher cannot read another class score');
  await req('/api/classes/'+cl.id+'/roster','DELETE',{username:m.username},'class-management');
  record((await api.get(base+'/api/class-exam-plans/'+plan.id+'/scores')).status()===400,'R4 changed class roster blocks stale score aggregation');
  const legacy=await api.post(base+'/api/release-jobs',{headers:{'x-classroom-request':'exam-release'},data:{paperId:paper.id}});
  record(legacy.status()===400&&(await legacy.json()).error.includes('名单'),'R4 legacy release entry cannot bypass the class roster guard');
  await req('/api/classes/'+cl.id+'/roster','POST',{usernames:[m.username]},'class-management');
  record(true,'R4 theory E2E plan → class UI release → submit answer card → class scores');
 }else throw Error('Unknown theory verification mode');
}catch(e){let error=String(e.message).split('\n')[0];if(existsSync(privateFile)){const secret=JSON.parse(readFileSync(privateFile,'utf8')).password;if(secret)error=error.replaceAll(secret,'[redacted]')}if(!checks.at(-1)?.startsWith('FAIL')){checks.push('FAIL '+error);console.log(checks.at(-1))}if(mode==='drive'&&!existsSync(join(run,'candidate-drive.txt')))writeFileSync(join(run,'candidate-drive.txt'),'FAIL candidate login not reached by R4 Drive\n');process.exitCode=1}
finally{
 await browser?.close();
 const file={doctor:'theory-doctor.txt',drive:'theory-drive.txt',cleanup:'theory-cleanup.txt'}[mode];if(file&&checks.length)writeFileSync(join(run,file),checks.join('\n')+'\n');
}
