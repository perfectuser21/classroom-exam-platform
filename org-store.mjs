import {randomUUID} from 'node:crypto';
const validName=x=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=100&&!/[\x00-\x1f]/.test(x);
export class OrgStore {
 constructor({storage={load:()=>[],save:()=>{}},hasMembers=()=>false}={}){this.storage=storage;this.hasMembers=hasMembers;this.nodes=storage.load();if(!Array.isArray(this.nodes))throw Error('组织记录无效')}
 list(){return structuredClone(this.nodes)}
 department(id){return this.nodes.some(x=>x.id===id&&x.type==='department')}
 create({type,name,parentId=null}){if(!validName(name)||!['company','department'].includes(type)||(type==='company'?parentId!==null:!this.nodes.some(x=>x.id===parentId&&x.type==='company')))throw Error('组织信息无效');const node={id:randomUUID(),type,name:name.trim(),parentId};this.nodes.push(node);try{this.storage.save(this.nodes)}catch(e){this.nodes.pop();throw e}return structuredClone(node)}
 update(id,{name}){const node=this.nodes.find(x=>x.id===id);if(!node||!validName(name))throw Error('组织信息无效');const old=node.name;node.name=name.trim();try{this.storage.save(this.nodes)}catch(e){node.name=old;throw e}return structuredClone(node)}
 delete(id){const i=this.nodes.findIndex(x=>x.id===id);if(i<0||this.nodes.some(x=>x.parentId===id)||this.hasMembers(id))throw Error('组织不存在或仍有下级');const [node]=this.nodes.splice(i,1);try{this.storage.save(this.nodes)}catch(e){this.nodes.splice(i,0,node);throw e}}
}
