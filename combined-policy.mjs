import {randomUUID} from 'node:crypto';
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cell=value=>{let x=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(x))x="'"+x;return '"'+x.replaceAll('"','""')+'"'};
export class CombinedPolicyStore{
 constructor({storage={load:()=>[],save:()=>{}}}={}){this.storage=storage;this.items=storage.load();if(!Array.isArray(this.items))throw Error('成绩权重记录不可用')}
 create({paperId,theoryWeight,practicalWeight,actor}){if(!id.test(paperId)||!Number.isInteger(theoryWeight)||!Number.isInteger(practicalWeight)||theoryWeight<1||practicalWeight<1||theoryWeight+practicalWeight!==100||typeof actor!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(actor))throw Error('成绩权重无效');if(this.items.some(x=>x.paperId===paperId))throw Error('成绩权重已保存');if(this.items.length>=1000)throw Error('成绩权重记录已满');const item={id:randomUUID(),paperId,theoryWeight,practicalWeight,actor,createdAt:new Date().toISOString()},next=[...this.items,item];this.storage.save(next);this.items=next;return structuredClone(item)}
 list(){return structuredClone(this.items)}
}
export function combinedResultsCsv(result){if(!result||!Number.isSafeInteger(result.id)||!Array.isArray(result.students)||!result.policy)throw Error('成绩数据无效');const rows=[['考生编号','姓名','理论成绩','理论满分','理论权重百分比','实操成绩','实操权重百分比','实操确认记录','综合成绩','状态']];for(const s of result.students)rows.push([s.id,s.name,s.theoryScore,s.theoryMax,result.policy.theoryWeight,s.practicalScore,result.policy.practicalWeight,s.practicalRecordId,s.total,s.status]);return '\uFEFF'+rows.map(x=>x.map(cell).join(',')).join('\r\n')+'\r\n'}
