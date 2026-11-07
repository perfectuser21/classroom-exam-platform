import {randomUUID} from 'node:crypto';
import {buildPapers} from './paper-builder.mjs';
import {buildWeightedPapers} from './weighted-paper-builder.mjs';
export class PaperStore {
 constructor({questions,publications,standards=()=>[],storage={load:()=>[],save:()=>{}}}){Object.assign(this,{questions,publications,standards,storage});this.items=storage.load();if(!Array.isArray(this.items))throw Error('试卷记录无效')}
 create({name,level,counts,versions,duration,deadline=0,standardId,targetPoints}){
  if(typeof name!=='string'||!name.trim()||name.length>100||/[\x00-\x1f]/.test(name)||!Number.isInteger(duration)||duration<5||duration>240)throw Error('考试名称或时长无效');
  if(!Number.isSafeInteger(deadline)||deadline<0||(deadline!==0&&deadline<=Math.floor(Date.now()/1000)+60))throw Error('统一截止时间必须晚于当前时间至少一分钟');
  if(this.items.length>=1000)throw Error('试卷记录已满');
  let standard;if(standardId!==undefined){if(typeof standardId!=='string'||!standardId)throw Error('请选择职业标准');standard=this.standards().find(x=>x.id===standardId);if(!standard)throw Error('职业标准不存在')}else if(targetPoints!==undefined)throw Error('请先选择职业标准');
  const input={level,counts,versions,questions:this.questions(),published:this.publications(),allowUnpublished:true};const papers=standard?buildWeightedPapers({...input,standard,targetPoints}):buildPapers(input);
  const item={id:randomUUID(),name:name.trim(),level,duration,deadline,counts:structuredClone(counts),papers,...(standard?{standardSnapshot:structuredClone(standard),targetPoints}:{}),status:'draft',createdAt:new Date().toISOString()};this.items.push(item);try{this.storage.save(this.items)}catch(e){this.items.pop();throw e}return structuredClone(item);
 }
 list(){return this.items.map(x=>structuredClone(x))}
}
