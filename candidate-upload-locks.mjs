export class UploadLocks{
 constructor({storage={load:()=>[],save:()=>{}}}={}){this.storage=storage;this.items=storage.load();if(!Array.isArray(this.items)||this.items.some(x=>!x||typeof x.exam!=='string'||!/^exam-[1-9]\d{0,9}$/.test(x.exam)))throw Error('上传记录无法读取')}
 mark(exam){if(typeof exam!=='string'||!/^exam-[1-9]\d{0,9}$/.test(exam))throw Error('考试标识无效');if(this.items.some(x=>x.exam===exam))return;const next=[...this.items,{exam,startedAt:new Date().toISOString()}];this.storage.save(next);this.items=next}
 hasAny(exams){return Array.isArray(exams)&&this.items.some(x=>exams.includes(x.exam))}
}
