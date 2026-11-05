import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {AccountStore} from './account-store.mjs';
import {mayAccess} from './access-policy.mjs';

test('phone staff roles fail closed until scoped access exists',async()=>{
 const a=new AccountStore();
 for(const [role,username] of [['class_teacher','13800138001'],['instructor','13800138002']]){
  await a.create({role,username,password:'A-strong-password-2026'});
  assert.equal((await a.authenticate(username,'A-strong-password-2026')).role,role);
  assert.equal(mayAccess(role,'exam.read'),false);
  await assert.rejects(a.create({role,username:'bad-phone',password:'A-strong-password-2026'}));
 }
});
test('examiner requires identity and survives password reset without storing identity in clear',async()=>{
 let data=[];const a=new AccountStore({storage:{load:()=>data,save:x=>data=structuredClone(x)}});
 const username='13800138003',identity={name:'测试考评员',idNumber:'110101199001010011'};
 await a.create({username,role:'examiner',password:'A-strong-password-2026',...identity});
 assert.equal(JSON.stringify(data).includes(identity.idNumber),false);
 assert.equal(await a.authenticate(username,'A-strong-password-2026'),null);
 assert.equal(await a.authenticate(username,'A-strong-password-2026',{...identity,name:'错误'}),null);
 await a.resetPassword(username,'Another-strong-password');
 assert.equal((await a.authenticate(username,'Another-strong-password',identity)).role,'examiner');
});
