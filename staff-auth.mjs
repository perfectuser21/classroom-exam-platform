const cookieName='__Host-classroom';
function tokenFrom(cookie){const parts=String(cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));return parts.length===1?parts[0].slice(cookieName.length+1):null}
function respond(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
export function createStaffAuth({accounts,sessions,audit=()=>()=>{},clock=Date.now,maxAttempts=30,windowMs=60000}){
 let attempts=[];
 return {
  async login(req,res){
   if(req.headers['x-classroom-request']!=='staff-login'){respond(res,403,{error:'请求无效'});return}
   const now=clock();attempts=attempts.filter(t=>now-t>=0&&now-t<windowMs);if(attempts.length>=maxAttempts){respond(res,429,{error:'登录请求过多，请稍后重试'});return}attempts.push(now);
   try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){respond(res,413,{error:'请求过大'});return}}const input=JSON.parse(body);const user=await accounts.authenticate(input.username,input.password,{name:input.name,idNumber:input.idNumber}),finishAudit=audit(user?.username||null);if(!user){finishAudit(401);respond(res,401,{error:'账号或密码错误'});return}const old=tokenFrom(req.headers.cookie);if(old)sessions.delete(old);const token=sessions.create(user.username);finishAudit(200);respond(res,200,user,{'Set-Cookie':`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`})}catch{respond(res,400,{error:'登录失败'})}
  },
  user(cookie){const token=tokenFrom(cookie);return token?sessions.get(token):null},
  logout(cookie,res){const token=tokenFrom(cookie);if(token)sessions.delete(token);respond(res,200,{ok:true},{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`})}
 };
}
