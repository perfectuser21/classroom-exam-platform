import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),roles=new Set(['admin','staff','examiner']);
const validName=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(x);
export class AccountStore {
 constructor({storage={load:()=>[],save:()=>{}},clock=Date.now}={}){this.storage=storage;this.clock=clock;this.accounts=storage.load();if(!Array.isArray(this.accounts))throw Error('账号记录无效')}
 async create({username,password,role}){
  if(!validName(username)||typeof password!=='string'||password.length<12||password.length>128||!roles.has(role))throw Error('账号参数无效');
  if(this.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))throw Error('账号已存在');
  const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');
  if(this.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))throw Error('账号已存在');
  const entry={username,role,salt,hash,disabled:false,failures:0,lockedUntil:0};this.accounts.push(entry);try{this.storage.save(this.accounts)}catch(e){this.accounts.pop();throw e}return {username,role,disabled:false};
 }
 async authenticate(username,password){
  const entry=validName(username)?this.accounts.find(a=>a.username.toLowerCase()===username.toLowerCase()):undefined;
  if(typeof password!=='string'||password.length>128)return null;
  const salt=entry?.salt||'00000000000000000000000000000000',expected=entry?.hash||'0'.repeat(128);
  const actual=await scrypt(password,salt,64);const ok=/^[0-9a-f]{128}$/.test(expected)&&timingSafeEqual(actual,Buffer.from(expected,'hex'));
  if(!entry||entry.disabled||entry.lockedUntil>this.clock()||entry.salt!==salt||entry.hash!==expected)return null;
  const old={failures:entry.failures,lockedUntil:entry.lockedUntil};if(ok){entry.failures=0;entry.lockedUntil=0}else{entry.failures=(entry.failures||0)+1;if(entry.failures>=5){entry.lockedUntil=this.clock()+900000;entry.failures=0}}
  try{this.storage.save(this.accounts)}catch(e){Object.assign(entry,old);throw e}
  return ok?{username:entry.username,role:entry.role}:null;
 }
 identity(username){const account=this.accounts.find(a=>a.username===username&&!a.disabled);return account?{username:account.username,role:account.role}:null}
 list(){return this.accounts.map(({username,role,disabled})=>({username,role,disabled}))}
 async resetPassword(username,password){if(typeof password!=='string'||password.length<12||password.length>128)throw Error('密码无效');const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex'),previous={salt:entry.salt,hash:entry.hash,failures:entry.failures,lockedUntil:entry.lockedUntil};Object.assign(entry,{salt,hash,failures:0,lockedUntil:0});try{this.storage.save(this.accounts)}catch(e){Object.assign(entry,previous);throw e}}
 setRole(username,role){if(!roles.has(role))throw Error('角色无效');const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.role;entry.role=role;try{this.storage.save(this.accounts)}catch(e){entry.role=previous;throw e}}
 enable(username){const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.disabled;entry.disabled=false;try{this.storage.save(this.accounts)}catch(e){entry.disabled=previous;throw e}}
 disable(username){const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.disabled;entry.disabled=true;try{this.storage.save(this.accounts)}catch(e){entry.disabled=previous;throw e}}
}
