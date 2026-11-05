const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
const matrix=new Set(['admin','student','class_teacher','instructor','examiner']);
export function createOrgApi({org,accounts,revoke}){let busy=false;return async(req,res,identity)=>{
 if(identity?.role!=='admin')return send(res,403,{error:'无权限'});
 const path=new URL(req.url,'http://localhost').pathname;
 const write=req.method!=='GET';if(write&&busy)return send(res,409,{error:'组织操作正在进行，请重试'});if(write)busy=true;
 try{
  if(req.method==='GET'&&path==='/api/org')return send(res,200,org.list());
  if(req.method==='GET'&&path==='/api/org/users')return send(res,200,accounts.list().filter(x=>x.departmentId));
  if(req.headers['x-classroom-request']!=='org-management')return send(res,403,{error:'请求无效'});
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)return send(res,413,{error:'请求过大'})}const body=JSON.parse(raw||'{}');
  if(req.method==='POST'&&path==='/api/org')return send(res,201,org.create(body));
  if(req.method==='POST'&&path==='/api/org/users'){if(!org.department(body.departmentId)||!matrix.has(body.role))throw Error('部门或角色无效');return send(res,201,await accounts.create(body))}
  const user=path.match(/^\/api\/org\/users\/([a-zA-Z0-9_-]+)$/);
  if(user&&req.method==='PUT'){if(!org.department(body.departmentId)||!matrix.has(body.role))throw Error('部门或角色无效');const result=await accounts.updateProvisioning(user[1],body);revoke(user[1]);return send(res,200,result)}
  if(user&&req.method==='DELETE'){if(!accounts.list().some(x=>x.username===user[1]&&x.departmentId))throw Error('账号不存在');accounts.disable(user[1]);revoke(user[1]);return send(res,200,{ok:true})}
  const node=path.match(/^\/api\/org\/([a-f0-9-]{36})$/);
  if(node&&req.method==='PUT')return send(res,200,org.update(node[1],body));
  if(node&&req.method==='DELETE'){org.delete(node[1]);return send(res,200,{ok:true})}
  return send(res,404,{error:'功能不存在'});
 }catch{return send(res,400,{error:'组织或账号操作失败，请检查信息'})}finally{if(write)busy=false}
}}
