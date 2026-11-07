import {randomUUID} from 'node:crypto';
export class ClassStore {
 constructor({storage={load:()=>[],save:()=>{}},org,standards,accounts}){Object.assign(this,{storage,org,standards,accounts});this.items=storage.load();if(!Array.isArray(this.items))throw Error('班级数据无效')}
 list(identity={role:'admin'}){const a=this.accounts.list().find(x=>x.username===identity.username&&!x.disabled);return structuredClone(this.items.filter(c=>identity.role==='admin'||identity.role==='class_teacher'&&c.teacher===identity.username||identity.role==='staff'&&a?.departmentId===c.orgId))}
 validate({name,orgId,standardId,teacher}){if(typeof name!=='string'||!name.trim()||name.length>100||/[\x00-\x1f]/.test(name)||!this.org.list().some(x=>x.id===orgId)||standardId&&!this.standards.list().some(x=>x.id===standardId))throw Error('班级信息无效');if(teacher&&!this.accounts.list().some(x=>x.username===teacher&&x.role==='class_teacher'&&!x.disabled))throw Error('班主任账号无效');return {name:name.trim(),orgId,standardId:standardId||null,teacher:teacher||null}}
 save(items){this.storage.save(items);this.items=items}
 create(input){const c={id:randomUUID(),...this.validate(input),students:[]};this.save([...this.items,c]);return structuredClone(c)}
 update(id,input){const c=this.items.find(x=>x.id===id);if(!c)throw Error('班级不存在');const updated={...c,...this.validate(input)};this.save(this.items.map(x=>x.id===id?updated:x));return structuredClone(updated)}
 roster(id){const c=this.items.find(x=>x.id===id);if(!c)throw Error('班级不存在');const accounts=this.accounts.list();return c.students.map(username=>accounts.find(x=>x.username===username)||{username,disabled:true})}
 add(id,usernames){const c=this.items.find(x=>x.id===id);if(!c||!Array.isArray(usernames)||!usernames.length||usernames.length>1000||new Set(usernames).size!==usernames.length)throw Error('名单无效');const accounts=this.accounts.list();if(usernames.some(u=>!accounts.some(a=>a.username===u&&a.role==='student'&&!a.disabled)||c.students.includes(u)))throw Error('名单包含不存在、停用或重复的学生账号');this.save(this.items.map(x=>x.id===id?{...x,students:[...x.students,...usernames]}:x))}
 remove(id,username){const c=this.items.find(x=>x.id===id);if(!c||!c.students.includes(username))throw Error('学生不在班级');this.save(this.items.map(x=>x.id===id?{...x,students:x.students.filter(u=>u!==username)}:x))}
}
