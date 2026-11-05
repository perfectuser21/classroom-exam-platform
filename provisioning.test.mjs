import test from 'node:test';import assert from 'node:assert/strict';import {AccountStore} from './account-store.mjs';
test('scoped accounts validate role transitions and persist membership atomically',async()=>{
 const a=new AccountStore();
 await a.create({username:'13800138011',password:'Strong!Password123',role:'student',departmentId:'department'});
 assert.equal(a.list()[0].departmentId,'department');
 await assert.rejects(a.updateProvisioning('13800138011',{role:'examiner',departmentId:'department'}));
 assert.equal(a.identity('13800138011').role,'student');
 await a.updateProvisioning('13800138011',{role:'examiner',departmentId:'other',name:'测试',idNumber:'110101199001010011'});
 assert.equal(await a.authenticate('13800138011','Strong!Password123'),null);
 assert.equal((await a.authenticate('13800138011','Strong!Password123',{name:'测试',idNumber:'110101199001010011'})).role,'examiner');
 assert.equal(a.list()[0].departmentId,'other');
});

test('candidate sessions stop when managed identity is disabled or changes role',async()=>{
 const {CandidateSessions}=await import('./candidate-session.mjs');let allowed=true;const sessions=new CandidateSessions({allowed:()=>allowed});const id=sessions.create('moodle-token','13800138011');assert.equal(sessions.get(id),'moodle-token');allowed=false;assert.equal(sessions.get(id),null);
});
