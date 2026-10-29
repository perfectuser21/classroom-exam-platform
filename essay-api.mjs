const write=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
const same=(row,x)=>row.quizId===x.quizId&&row.attemptId===x.attemptId&&row.slot===x.slot;
export function createEssayApi({enabled,ownsQuiz,listAnswers,getQuestion,reviews,finalizations}){
 return async(req,res,identity)=>{
  if(!enabled())return write(res,503,{error:'简答考试及评分尚未启用'});
  const path=new URL(req.url,'http://localhost');
  try{
   if(req.method==='GET'&&path.pathname==='/api/essay-answers'){
    if(!['admin','staff','examiner'].includes(identity.role))return write(res,403,{error:'无权限'});
    const raw=path.searchParams.get('quiz');if(!/^[1-9]\d{0,9}$/.test(raw||''))return write(res,400,{error:'考试标识无效'});const quizId=Number(raw);if(!ownsQuiz(quizId))return write(res,404,{error:'考试不存在'});
    const answers=await listAnswers(quizId),visibleReviews=reviews.list().filter(x=>identity.role==='admin'||x.reviewer===identity.username),jobs=identity.role==='admin'?finalizations.list():[];
    const result=answers.map(a=>{const question=getQuestion(a.questionId);if(!question)throw Error('题目记录不可用');return {...a,stem:question.stem,reference:question.reference,reviews:visibleReviews.filter(x=>same(x,a)),finalizations:jobs.filter(x=>same(x,a))}});return write(res,200,result)
   }
   if(req.method==='GET'&&/^\/api\/essay-finalizations\/[a-f0-9-]{36}$/.test(path.pathname)){if(identity.role!=='admin')return write(res,403,{error:'无权限'});const job=finalizations.get(path.pathname.split('/').at(-1));return write(res,job?200:404,job||{error:'记录不存在'})}
   if(req.method==='POST'&&['/api/essay-reviews','/api/essay-finalizations'].includes(path.pathname)){
    const finalize=path.pathname.endsWith('finalizations');if(finalize?identity.role!=='admin':!['admin','examiner'].includes(identity.role))return write(res,403,{error:'无权限'});
    if(req.headers['x-classroom-request']!==(finalize?'essay-finalize':'essay-review'))return write(res,403,{error:'请求无效'});
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return write(res,413,{error:'请求过大'})}const input=JSON.parse(raw);if(!ownsQuiz(input.quizId))return write(res,404,{error:'考试不存在'});
    const value=finalize?await finalizations.create(input,identity.username):await reviews.create(input,identity.username);return write(res,finalize?202:201,value)
   }
   return write(res,404,{error:'功能不存在'});
  }catch{return write(res,400,{error:'操作未完成，请核对答卷、评分和权限'})}
 }
}
