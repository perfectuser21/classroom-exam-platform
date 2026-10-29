import {randomUUID} from 'node:crypto';
const formats=new Set(['csv','json','coco','png','py','ipynb','zip']);
function text(value,max){if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw Error('题目文字无效');return value.trim()}
const normalized=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export class PracticalBank{
 constructor({storage={load:()=>[],save:()=>{}}}={}){this.storage=storage;this.items=storage.load();if(!Array.isArray(this.items))throw Error('实操题库无法读取')}
 create({level,title,description,durationMinutes,formats:requested,rubric,reference}){
  if(![3,4,5].includes(level))throw Error('等级无效');title=text(title,200);description=text(description,10000);reference=text(reference,10000);
  if(this.items.some(q=>q.level===level&&normalized(q.title)===normalized(title)))throw Error('题目重复');
  if(!Number.isInteger(durationMinutes)||durationMinutes<5||durationMinutes>480)throw Error('考试时长无效');
  if(!Array.isArray(requested)||!requested.length||requested.length>formats.size||new Set(requested).size!==requested.length||requested.some(x=>!formats.has(x)))throw Error('交付格式无效');
  if(!Array.isArray(rubric)||!rubric.length||rubric.length>30)throw Error('评分细则无效');rubric=rubric.map(r=>({criterion:text(r?.criterion,1000),points:r.points}));if(rubric.some(r=>!Number.isInteger(r.points)||r.points<1||r.points>100)||rubric.reduce((n,r)=>n+r.points,0)!==100)throw Error('评分细则须为整数且总分为 100');
  if(this.items.length>=10000)throw Error('题库已满');const item={id:randomUUID(),level,title,description,durationMinutes,formats:[...requested],rubric,reference,status:'draft',createdAt:new Date().toISOString()};this.items.push(item);try{this.storage.save(this.items)}catch(e){this.items.pop();throw e}return structuredClone(item)
 }
 list(){return structuredClone(this.items)}
}
