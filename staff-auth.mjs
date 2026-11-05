const cookieName='__Host-classroom';
function tokenFrom(cookie){const parts=String(cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));return parts.length===1?parts[0].slice(cookieName.length+1):null}
function respond(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
function loginMode(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const {username,password,phone,name,idNumber}=input;
 if(name!==undefined||idNumber!==undefined){
  if(username!==undefined||password!==undefined||typeof name!=='string'||typeof idNumber!=='string'||typeof phone!=='string')return null;
  return {kind:'identity',phone,name,idNumber};
 }
 if(phone!==undefined&&username!==undefined)return null;
 const account=phone!==undefined?phone:username;
 if(typeof account!=='string'||typeof password!=='string')return null;
 return {kind:'password',username:account,password};
}
async function readBody(req,res){
 let body='';
 for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){respond(res,413,{error:'请求过大'});return null}}
 return JSON.parse(body);
}
export function createStaffAuth({accounts,sessions,audit=()=>()=>{},clock=Date.now,maxAttempts=30,windowMs=60000}){
 let attempts=[];
 function user(cookie){const token=tokenFrom(cookie);return token?sessions.get(token):null}
 return {
  async login(req,res){
   if(req.headers['x-classroom-request']!=='staff-login'){respond(res,403,{error:'请求无效'});return}
   const now=clock();attempts=attempts.filter(t=>now-t>=0&&now-t<windowMs);if(attempts.length>=maxAttempts){respond(res,429,{error:'登录请求过多，请稍后重试'});return}attempts.push(now);
   try{
    const input=await readBody(req,res);if(input===null)return;
    const mode=loginMode(input);if(!mode){respond(res,400,{error:'登录失败'});return}
    const found=mode.kind==='identity'?await accounts.authenticateIdentity(mode):await accounts.authenticate(mode.username,mode.password);
    const finishAudit=audit(found?.username||null);
    if(!found){finishAudit(401);respond(res,401,{error:'账号或密码错误'});return}
    const old=tokenFrom(req.headers.cookie);if(old)sessions.delete(old);
    const token=sessions.create(found.username);finishAudit(200);
    respond(res,200,found,{'Set-Cookie':`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`});
   }catch{respond(res,400,{error:'登录失败'})}
  },
  user,
  logout(cookie,res){const token=tokenFrom(cookie);if(token)sessions.delete(token);respond(res,200,{ok:true},{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`})},
  async password(req,res){
   if(req.headers['x-classroom-request']!=='staff-password'){respond(res,403,{error:'请求无效'});return}
   const current=user(req.headers.cookie);
   if(!current||current.role!=='student'){respond(res,403,{error:'无权限'});return}
   try{
    const input=await readBody(req,res);if(input===null)return;
    if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.password!=='string'||Object.keys(input).some(key=>key!=='password')){respond(res,400,{error:'密码无效'});return}
    await accounts.resetPassword(current.username,input.password);
    respond(res,200,{ok:true});
   }catch{respond(res,400,{error:'密码无效'})}
  }
 };
}
