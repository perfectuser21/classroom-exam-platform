const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
export function createClassApi({classes,org,standards,accounts}){return async(req,res,identity)=>{const path=new URL(req.url,'http://localhost').pathname,role=identity.role,visible=()=>classes.list(identity),account=accounts.list().find(x=>x.username===identity.username&&!x.disabled),canOrg=id=>role==='admin'||role==='staff'&&account?.departmentId===id;
 try{
 if(req.method==='GET'&&path==='/api/classes')return send(res,200,visible());
 if(req.method==='GET'&&path==='/api/classes/options'){if(role!=='admin'&&!(role==='staff'&&account?.departmentId))return send(res,403,{error:'无权限'});const nodes=org.list().filter(x=>canOrg(x.id));return send(res,200,{org:nodes,standards:standards.list(),accounts:accounts.list().filter(a=>!a.disabled&&(role==='admin'||a.departmentId===account?.departmentId)&&['student','class_teacher'].includes(a.role))})}
 if(req.method==='GET'&&path==='/api/classes/template'){res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="roster-template.csv"','X-Content-Type-Options':'nosniff'});return res.end('\ufeffusername\r\n')}
 const match=path.match(/^\/api\/classes\/([a-f0-9-]{36})(?:\/(roster|export))?$/),item=match&&visible().find(x=>x.id===match[1]);
 if(match&&!item)return send(res,404,{error:'班级不存在'});
 if(match&&req.method==='GET'&&match[2]==='roster')return send(res,200,classes.roster(item.id));
 if(match&&req.method==='GET'&&match[2]==='export'){res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="roster.csv"','X-Content-Type-Options':'nosniff'});return res.end('\ufeffusername\r\n'+classes.roster(item.id).map(x=>x.username).join('\r\n')+'\r\n')}
 if(role!=='admin'&&role!=='staff')return send(res,403,{error:'无权限'});
 if(req.headers['x-classroom-request']!=='class-management')return send(res,403,{error:'请求无效'});
 let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>100000)return send(res,413,{error:'名单过大'})}const body=JSON.parse(raw||'{}');if(role==='staff'&&body.teacher&&!accounts.list().some(a=>a.username===body.teacher&&a.departmentId===account?.departmentId))return send(res,403,{error:'班主任不在所属部门'});if(role==='staff'&&Array.isArray(body.usernames)&&body.usernames.some(u=>!accounts.list().some(a=>a.username===u&&a.departmentId===account?.departmentId)))return send(res,403,{error:'学生不在所属部门'});
 if(path==='/api/classes'&&req.method==='POST'){if(!canOrg(body.orgId))return send(res,403,{error:'无权限'});return send(res,201,classes.create(body))}
 if(match&&req.method==='PUT'&&!match[2]){if(!canOrg(item.orgId)||!canOrg(body.orgId))return send(res,403,{error:'无权限'});return send(res,200,classes.update(item.id,body))}
 if(match&&match[2]==='roster'&&req.method==='POST'){if(!canOrg(item.orgId))return send(res,403,{error:'无权限'});classes.add(item.id,body.usernames);return send(res,200,classes.roster(item.id))}
 if(match&&match[2]==='roster'&&req.method==='DELETE'){if(!canOrg(item.orgId))return send(res,403,{error:'无权限'});classes.remove(item.id,body.username);return send(res,200,{ok:true})}
 return send(res,404,{error:'功能不存在'});
 }catch(e){return send(res,400,{error:e.message||'班级操作失败'})}
}}
