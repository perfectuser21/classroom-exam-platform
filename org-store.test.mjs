import test from 'node:test';
import assert from 'node:assert/strict';
import {OrgStore} from './org-store.mjs';
test('组织只允许公司下建部门，使用中的节点不能删除',()=>{
 let rows=[]; const storage={load:()=>structuredClone(rows),save:x=>{rows=structuredClone(x)}};
 const org=new OrgStore({storage,hasMembers:id=>id==='busy'});
 const company=org.create({type:'company',name:'公司'});
 const dept=org.create({type:'department',name:'部门',parentId:company.id});
 assert.throws(()=>org.create({type:'department',name:'错误',parentId:dept.id}));
 assert.throws(()=>org.delete(company.id));
 assert.equal(org.update(dept.id,{name:'新部门'}).name,'新部门');
 assert.equal(new OrgStore({storage}).list().length,2);
 org.delete(dept.id);org.delete(company.id);assert.deepEqual(org.list(),[]);
});
