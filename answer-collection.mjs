import {createHash} from 'node:crypto';
export async function collectAnswers(plans,{download,save}){
 const results=[];
 for(const plan of plans){
  try{const data=await download(plan);if(!Buffer.isBuffer(data)||data.length!==plan.size||createHash('sha256').update(data).digest('hex')!==plan.sha256){results.push({path:plan.path,status:'failed'});continue}const saved=await save(plan,data);if(!saved||typeof saved.id!=='string')throw Error('归档回执无效');results.push({path:plan.path,status:'collected',id:saved.id})}
  catch{results.push({path:plan.path,status:'unknown'})}
 }
 return results;
}
