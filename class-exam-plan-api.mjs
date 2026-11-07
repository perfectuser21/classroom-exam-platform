const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
export function createClassExamPlanApi({plans}){
 return async(req,res,identity)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  try{
   if(req.method==='GET'&&path==='/api/class-exam-plans')return send(res,200,plans.list(identity));
   if(req.method==='GET'&&path==='/api/class-exam-plans/options')return send(res,200,plans.options(identity));
   const m=path.match(/^\/api\/class-exam-plans\/([a-f0-9-]{36})\/(assign|release|scores)$/);
   if(req.method==='GET'&&m?.[2]==='scores')return send(res,200,await plans.scores(m[1],identity));
   if(req.method!=='POST')return send(res,404,{error:'功能不存在'});
   if(req.headers['x-classroom-request']!=='class-exam-plan')return send(res,403,{error:'请求无效'});
   let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>4096)return send(res,413,{error:'请求过大'})}
   if(m?.[2]==='assign'){
    if(process.env.CLASSROOM_ENABLE_ASSIGNMENT!=='1')return send(res,503,{error:'考生分配尚未启用'});
    return send(res,202,await plans.assign(m[1],identity));
   }
   if(m?.[2]==='release'){
    if(process.env.CLASSROOM_ENABLE_EXAM_RELEASE!=='1')return send(res,503,{error:'考试开放尚未通过完整验证'});
    return send(res,202,plans.release(m[1],identity));
   }
   if(path==='/api/class-exam-plans')return send(res,201,plans.create(JSON.parse(raw||'{}'),identity));
   return send(res,404,{error:'功能不存在'});
  }catch(e){return send(res,400,{error:e.message||'考试计划操作失败'})}
 };
}
