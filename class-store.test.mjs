import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClassStore} from './class-store.mjs';
test('class ownership and atomic roster validation',()=>{
 const accounts={list:()=>[{username:'13800138001',role:'class_teacher',departmentId:'d'},{username:'13800138002',role:'student',departmentId:'d'}]};
 const store=new ClassStore({org:{list:()=>[{id:'d',type:'department'}]},standards:{list:()=>[{id:'s'}]},accounts});
 const c=store.create({name:'一班',orgId:'d',standardId:'s',teacher:'13800138001'});
 assert.equal(store.list({role:'class_teacher',username:'other'}).length,0);
 assert.equal(store.list({role:'class_teacher',username:'13800138001'}).length,1);
 assert.throws(()=>store.add(c.id,['13800138002','unknown']));
 assert.deepEqual(store.roster(c.id),[]);
 store.add(c.id,['13800138002']);assert.equal(store.roster(c.id)[0].username,'13800138002');
 store.remove(c.id,'13800138002');assert.deepEqual(store.roster(c.id),[]);
});
