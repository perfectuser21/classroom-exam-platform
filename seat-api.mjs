const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
export function createSeatApi({maps,loadStudents}){return async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'){const raw=url.searchParams.get('quiz');if(!/^[1-9]\d{0,9}$/.test(raw||''))return send(res,400,{error:'考试标识无效'});const plan=maps.forQuiz(Number(raw)),people=await loadStudents();if(!Array.isArray(people)||plan.studentIds.some(id=>people.filter(x=>x.id===id).length!==1))throw Error('考生名单已变化');const students=plan.studentIds.map(id=>({id,name:people.find(x=>x.id===id).name,device:plan.allAssignments.find(x=>x.studentId===id)?.device||null}));return send(res,200,{paperId:plan.paperId,students,groupStudentIds:plan.groupStudentIds,assignments:plan.assignments})}
 if(req.method==='POST'){if(req.headers['x-classroom-request']!=='seat-map')return send(res,403,{error:'请求无效'});let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)return send(res,413,{error:'请求过大'})}const input=JSON.parse(body);return send(res,200,maps.save(input.paperId,input.assignments))}
 return send(res,405,{error:'请求无效'});
 }catch(e){return send(res,400,{error:e.message||'工位安排不可用'})}}}
