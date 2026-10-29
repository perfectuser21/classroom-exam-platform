import {filename} from './artifact-store.mjs';
export function materialDisposition(name){filename(name);return "attachment; filename*=UTF-8''"+encodeURIComponent(name).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}
import {CandidateSessions,validateQuizId,allowedAnswers} from './candidate-session.mjs';
const allowed=new Set(['login','logout','courses','quizzes','start','data','save','submit','attempt-status','tasks','media','upload','upload-config','upload-history','upload-bundle','materials','material','materials-config','profile','seat']);
export function createCandidateHandler({call,loadMedia=async()=>{throw Error('图片不可用')},uploadEnabled=()=>false,uploader=null,materialsEnabled=()=>false,materials=null,taskList=async()=>{throw Error('任务不可用')},seatLookup=async()=>{throw Error('工位不可用')},sessions=new CandidateSessions()}){
 const failures=new Map();
 return async function(req,res){
  let refreshCookie=null;function send(status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(refreshCookie?{'Set-Cookie':refreshCookie}:{}),...headers});res.end(JSON.stringify(data))}
  const action=(req.url||'').split('?')[0].replace('/api/candidate/','');
  if(!allowed.has(action))return send(404,{error:'功能不存在'});
  if(action==='media'){if(req.method!=='GET')return send(403,{error:'请求无效'});const matches=(req.headers.cookie||'').match(/(?:^|;\s*)classroom_candidate=([a-f0-9]{64})(?:;|$)/),id=matches?.[1],token=id?sessions.get(id):null;if(!token)return send(401,{error:'请登录后继续'});try{const src=new URL(req.url,'http://localhost').searchParams.get('src'),image=await loadMedia(src,token);if(!image||!Buffer.isBuffer(image.data)||!['image/png','image/jpeg','image/gif','image/webp'].includes(image.type))throw Error('图片无效');res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Set-Cookie':`classroom_candidate=${id}; Path=/api/candidate/; HttpOnly; Secure; SameSite=Strict; Max-Age=18000`});res.end(image.data)}catch{return send(404,{error:'图片不可用'})}return}
  if(action==='materials-config'){if(req.method!=='GET')return send(403,{error:'请求无效'});return send(200,{enabled:Boolean(materialsEnabled()&&materials)})}
  if(action==='materials'||action==='material'){
   if(!materialsEnabled()||!materials)return send(503,{error:'考生素材尚未启用'});if(req.method!=='GET')return send(403,{error:'请求无效'});const match=(req.headers.cookie||'').match(/(?:^|;\s*)classroom_candidate=([a-f0-9]{64})(?:;|$)/),id=match?.[1],token=id?sessions.get(id):null;if(!token)return send(401,{error:'请登录后继续'});refreshCookie=`classroom_candidate=${id}; Path=/api/candidate/; HttpOnly; Secure; SameSite=Strict; Max-Age=18000`;try{const p=new URL(req.url,'http://localhost').searchParams,raw=p.get('quiz');if(!/^[1-9]\d{0,9}$/.test(raw||''))throw Error('invalid');const quiz=Number(raw);if(action==='materials')return send(200,await materials.list(quiz,token));const result=await materials.read(quiz,p.get('id'),token);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':materialDisposition(result.record.name),'Content-Length':result.data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Set-Cookie':refreshCookie});res.end(result.data);return}catch{return send(404,{error:'素材不可用或考试已结束'})}
  }
  if(action==='upload-config'){if(req.method!=='GET')return send(403,{error:'请求无效'});const enabled=Boolean(uploadEnabled()&&uploader);return send(200,enabled?{enabled,maxFileBytes:uploader.maxFileBytes,maxVersions:uploader.maxVersions}:{enabled:false})}
  if(action==='upload'){
   if(!uploadEnabled()||!uploader)return send(503,{error:'实操答案上传尚未启用'});if(req.method!=='POST'||req.headers['x-classroom-request']!=='candidate')return send(403,{error:'请求无效'});
   const match=(req.headers.cookie||'').match(/(?:^|;\s*)classroom_candidate=([a-f0-9]{64})(?:;|$)/),id=match?.[1],token=id?sessions.get(id):null;if(!token)return send(401,{error:'请登录后继续'});refreshCookie=`classroom_candidate=${id}; Path=/api/candidate/; HttpOnly; Secure; SameSite=Strict; Max-Age=18000`;
   try{return send(201,await uploader.upload(req,token))}catch{return send(400,{error:'上传未完成，请检查考试状态、文件格式及大小'})}
  }
  if(req.method!=='POST'||req.headers['x-classroom-request']!=='candidate')return send(403,{error:'请求无效'});
  try{
   let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>1048576)return send(413,{error:'数据过大'})}const body=JSON.parse(raw||'{}');
   const match=(req.headers.cookie||'').match(/(?:^|;\s*)classroom_candidate=([a-f0-9]{64})(?:;|$)/);const id=match?.[1],token=id?sessions.get(id):null;
   if(action==='login'){
    const ip=req.socket?.remoteAddress||'unknown',now=Date.now(),f=failures.get(ip);if(f&&f.count>=10&&now-f.since<600000)return send(429,{error:'登录次数过多，请稍后重试'});
    if(typeof body.username!=='string'||body.username.length>100||typeof body.password!=='string'||body.password.length>200)return send(400,{error:'账号或密码格式错误'});
    const result=await call('login',{username:body.username,password:body.password});if(!result?.token){const x=f&&now-f.since<600000?f:{count:0,since:now};x.count++;failures.set(ip,x);return send(401,{error:'账号或密码不正确'})}
    failures.delete(ip);const sid=sessions.create(result.token);return send(200,{ok:true},{'Set-Cookie':`classroom_candidate=${sid}; Path=/api/candidate/; HttpOnly; Secure; SameSite=Strict; Max-Age=18000`});
   }
   if(!token)return send(401,{error:'请登录后继续'});
   refreshCookie=`classroom_candidate=${id}; Path=/api/candidate/; HttpOnly; Secure; SameSite=Strict; Max-Age=18000`;
   if(action==='logout'){sessions.delete(id);return send(200,{ok:true},{'Set-Cookie':'classroom_candidate=; Path=/api/candidate/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'})}
   if(action==='seat')return send(200,await seatLookup(validateQuizId(body.quiz),token));
   if(action==='upload-history'){if(!uploadEnabled()||!uploader)throw Error('实操上传不可用');return send(200,await uploader.history(validateQuizId(body.quiz),token))}
   if(action==='upload-bundle'){if(!uploadEnabled()||!uploader)throw Error('实操上传不可用');return send(200,await uploader.bundle({quiz:validateQuizId(body.quiz),task:body.task,ids:body.ids},token))}
   if(action==='tasks'){if(!uploadEnabled())throw Error('实操上传不可用');return send(200,await taskList(validateQuizId(body.quiz),token))}
   if(action==='attempt-status'){const quizid=validateQuizId(body.quiz),attemptid=validateQuizId(body.attempt),me=await call('core_webservice_get_site_info',{},token),userid=Number(me?.userid);if(!Number.isSafeInteger(userid)||userid<1)throw Error('考生身份无效');const list=await call('mod_quiz_get_user_quiz_attempts',{quizid,userid,status:'all'},token);if(!Array.isArray(list?.attempts))throw Error('答卷不可用');const attempts=list.attempts.filter(a=>Number(a.id)===attemptid);if(attempts.length!==1||!['inprogress','overdue','finished','abandoned'].includes(attempts[0].state))throw Error('答卷不可用');return send(200,{state:attempts[0].state})}
   if(action==='profile'){const me=await call('core_webservice_get_site_info',{},token),id=Number(me?.userid);if(!Number.isSafeInteger(id)||id<1||typeof me.fullname!=='string'||!me.fullname.trim()||me.fullname.length>200)throw Error('考生身份无效');return send(200,{id,name:me.fullname.trim()})}
   if(action==='courses'){const me=await call('core_webservice_get_site_info',{},token);if(!me||!Number.isInteger(Number(me.userid))||Number(me.userid)<1)throw Error('考生身份无效');const courses=await call('core_enrol_get_users_courses',{userid:me.userid},token);if(!Array.isArray(courses))throw Error('课程读取失败');return send(200,{courses:courses.map(c=>({id:c.id,name:c.fullname}))})}
   let fn,params={};
   if(action==='quizzes'){fn='mod_quiz_get_quizzes_by_courses';params['courseids[0]']=validateQuizId(body.course)}
   if(action==='start'){const quizid=validateQuizId(body.quiz);const me=await call('core_webservice_get_site_info',{},token);if(!me||!Number.isInteger(Number(me.userid))||Number(me.userid)<1)throw Error('考生身份无效');const list=await call('mod_quiz_get_user_quiz_attempts',{quizid,userid:me.userid,status:'all'},token);if(!Array.isArray(list?.attempts))throw Error('无法读取答卷');const ongoing=list.attempts.filter(a=>a.state==='inprogress').sort((a,b)=>Number(b.attempt)-Number(a.attempt))[0];if(ongoing)return send(200,{attempt:ongoing,resumed:true,serverNow:Math.floor(Date.now()/1000)});fn='mod_quiz_start_attempt';params.quizid=quizid}
   if(action==='data'){fn='mod_quiz_get_attempt_data';params.attemptid=validateQuizId(body.attempt);params.page=Number(body.page);if(!Number.isInteger(params.page)||params.page<0||params.page>1000)throw Error('页码无效')}
   if(action==='save'||action==='submit'){fn=action==='save'?'mod_quiz_save_attempt':'mod_quiz_process_attempt';params.attemptid=validateQuizId(body.attempt);const answers=allowedAnswers(body.answers);Object.entries(answers).forEach(([k,v],i)=>{params[`data[${i}][name]`]=k;params[`data[${i}][value]`]=v});if(action==='submit')params.finishattempt=1}
   const result=await call(fn,params,token);if(result?.exception||result?.errorcode)throw Error('考试服务拒绝操作');if(action==='start')return send(200,{...result,serverNow:Math.floor(Date.now()/1000)});return send(200,result);
  }catch(e){return send(400,{error:'请求失败，请检查登录与考试状态'})}
 }
}
