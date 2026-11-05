import {randomInt} from 'node:crypto';
export function buildPapers({level,counts,versions,questions,published,randomIndex=randomInt,allowUnpublished=false}){
 if(![3,4,5].includes(level)||![1,2].includes(versions)||!counts||typeof counts!=='object'||Array.isArray(counts)||Object.keys(counts).some(k=>!['single','truefalse','multiple','fill','essay'].includes(k))||!Array.isArray(questions)||!Array.isArray(published))throw Error('组卷规则无效');
 const types=['single','truefalse','multiple','fill','essay'];let total=0;for(const type of types){const count=counts[type]??0;if(!Number.isInteger(count)||count<0||count>100)throw Error('题量无效');total+=count}if(total<1||total>100)throw Error('题量无效');
 if(new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('题目重复');
 const publishedMap=new Map();for(const item of published){if(item.status==='published'){if(typeof item.questionId!=='string'||!Number.isSafeInteger(item.moodleId)||item.moodleId<1||publishedMap.has(item.questionId))throw Error('题库发布记录无效');publishedMap.set(item.questionId,item.moodleId)}}
 const papers=Array.from({length:versions},(_,i)=>({version:i?'B':'A',questions:[],totalPoints:0,weights:{}}));
 for(const type of types){const count=counts[type]??0;if(!count)continue;const pool=questions.filter(q=>q.level===level&&q.type===type&&(type!=='multiple'||q.gradingPolicy==='partial_no_wrong')&&(allowUnpublished||publishedMap.has(q.id)));if(pool.length<count*versions)throw Error('可用题目不足，无法生成不重复试卷');
  for(let i=pool.length-1;i>0;i--){const j=randomIndex(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('随机选择失败');[pool[i],pool[j]]=[pool[j],pool[i]]}
  for(let v=0;v<versions;v++){let weight=0;for(const q of pool.slice(v*count,(v+1)*count)){if(typeof q.points!=='number'||!Number.isFinite(q.points)||q.points<=0||q.points>100)throw Error('题目分值无效');weight+=q.points;papers[v].questions.push({id:q.id,moodleId:publishedMap.get(q.id),type:q.type,points:q.points})}papers[v].weights[type]=Math.round(weight*100)/100;papers[v].totalPoints=Math.round((papers[v].totalPoints+weight)*100)/100}
  if(versions===2&&papers[0].weights[type]!==papers[1].weights[type])throw Error('AB 卷相同题型总分不一致');
 }
 return papers;
}
