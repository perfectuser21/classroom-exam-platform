import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

// R5 shares the disposable R4 quiz and identity so cleanup has a single owner.
export function practicalDrive({run,req,api,browser}) {
 const checks=[]; let task,exam,answer;
 function check(ok,label){checks.push(`${ok?'PASS':'FAIL'} R5 ${label}`); if(!ok)throw Error(label)}
 function save(){writeFileSync(join(run,'practical-drive.txt'),checks.join('\n')+'\n')}
 async function phase(fn){try{await fn()}catch(e){if(!checks.at(-1)?.startsWith('FAIL'))checks.push('FAIL R5 '+String(e.message).split('\n')[0]);save();throw e}save()}
 return {
  prepare: ({quiz,department})=>phase(async()=>{
   exam='exam-'+quiz;
   task=await req('/api/practical-questions','POST',{level:5,title:'R5 实操任务',description:'下载素材并提交处理结果',durationMinutes:30,formats:['csv'],rubric:[{criterion:'结果',points:100}],reference:'核对结果'},'practical-draft',201);
   await req('/api/practical-taskbooks','POST',{taskId:task.id,exam:quiz},'practical-taskbook');
   const upload=await api.post('http://127.0.0.1:18199/api/materials?'+new URLSearchParams({exam:task.id,name:'input.csv'}),{headers:{'x-classroom-request':'material-upload','content-type':'application/octet-stream'},data:Buffer.from('value\n42\n')});
   if(upload.status()!==201)throw Error('素材上传 HTTP '+upload.status());const source=await upload.json();
   await req('/api/practical-plans','POST',{exam,weights:[{taskId:task.id,weight:100}]},'practical-plan',201);
   const delivery=await req('/api/practical-delivery','POST',{exam,sources:[{taskId:task.id,id:source.id}]},'practical-delivery');
   check(delivery.taskbooks===1&&delivery.materials===1,'任务书、组卷和素材发放');
   for(const username of ['13800138441','13800138442'])await req('/api/org/users','POST',{username,role:'examiner',departmentId:department,name:'验证考评员',idNumber:'110101199001010011',password:'Verify-only-password-2026!'},'org-management',201);
  }),
  candidate: ({page})=>phase(async()=>{
   const link=page.locator('#candidate-material-list a').filter({hasText:'input.csv'});await link.waitFor();
   const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);check(download.suggestedFilename()==='input.csv'&&readFileSync(await download.path(),'utf8')==='value\n42\n','考生下载素材并核对内容');
   const book=page.locator('#candidate-material-list a').filter({hasText:'task-'});check(await book.count()===1,'考生可见实操任务书');
   await page.locator('#candidate-task').selectOption(task.id);
   await page.locator('#candidate-file').setInputFiles({name:'answer.csv',mimeType:'text/csv',buffer:Buffer.from('result\n42\n')});
   await page.locator('#candidate-upload-button').click();await page.locator('#candidate-upload-status').getByText('已保存：answer.csv',{exact:false}).waitFor();
   const rows=await req('/api/exam-answers?exam='+exam);answer=rows.find(x=>x.taskId===task.id&&x.path==='answer.csv');check(!!answer,'考生上传答案并持久保存');
   await page.screenshot({path:join(run,'r5-candidate-upload.png'),fullPage:true});
  }),
  score: ()=>phase(async()=>{
   for(const username of ['13800138441','13800138442']){
    const ctx=await browser.newContext(),r=ctx.request;
    let response=await r.post('http://127.0.0.1:18199/api/staff/login',{headers:{'x-classroom-request':'staff-login'},data:{username,password:'Verify-only-password-2026!',name:'验证考评员',idNumber:'110101199001010011'}});if(response.status()!==200)throw Error('考评员登录 HTTP '+response.status());
    response=await r.post('http://127.0.0.1:18199/api/practical-reviews',{headers:{'x-classroom-request':'practical-review'},data:{taskId:task.id,answerId:answer.id,scores:[90],comment:'核验通过'}});if(response.status()!==201)throw Error('考评员评分 HTTP '+response.status()+' '+JSON.stringify(await response.json()));await ctx.close();
   }
   check(true,'两位考评员对考生答案评分');
   const arb=await req('/api/practical-arbitrations','POST',{taskId:task.id,answerId:answer.id,total:90,reason:'评分一致'},'practical-arbitration',201);
   await req('/api/practical-arbitrations/finalize','POST',{id:arb.id},'practical-arbitration');
   const score=await req('/api/practical-score-records','POST',{exam,student:answer.student},'practical-score-confirm',201);
   const saved=await req('/api/practical-score-records?exam='+exam);check(score.total===90&&saved.some(x=>x.id===score.id&&x.total===90),'仲裁及实操总分确认并读回');
  })
 };
}
