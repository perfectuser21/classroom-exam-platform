import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),roles=new Set(['admin','staff','examiner','class_teacher','instructor']);
const validName=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(x);
export class AccountStore {
 constructor({storage={load:()=>[],save:()=>{}},clock=Date.now}={}){this.storage=storage;this.clock=clock;this.accounts=storage.load();if(!Array.isArray(this.accounts))throw Error('账号记录无效')}
 async create({username,password,role,name,idNumber}){
  if(!validName(username)||typeof password!=='string'||password.length<12||password.length>128||!roles.has(role))throw Error('账号参数无效');
  if(['class_teacher','instructor'].includes(role)&&!/^1[3-9]\d{9}$/.test(username))throw Error('手机号无效');
  if(role==='examiner'&&(!/^1[3-9]\d{9}$/.test(username)||typeof name!=='string'||!name.trim()||name.length>100||typeof idNumber!=='string'||!/^\d{17}[\dXx]$/.test(idNumber)))throw Error('考评员身份无效');
  if(this.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))throw Error('账号已存在');
  const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');
  if(this.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))throw Error('账号已存在');
  const identitySalt=role==='examiner'?randomBytes(16).toString('hex'):undefined;
  const identityHash=identitySalt?(await scrypt(name.trim()+'\0'+idNumber.toUpperCase(),identitySalt,64)).toString('hex'):undefined;
  if(this.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))throw Error('账号已存在');
  const entry={username,role,salt,hash,...(identityHash?{identityHash,identitySalt}:{}),disabled:false,failures:0,lockedUntil:0};this.accounts.push(entry);try{this.storage.save(this.accounts)}catch(e){this.accounts.pop();throw e}return {username,role,disabled:false};
 }
 async authenticate(username,password,identity={}){
  const entry=validName(username)?this.accounts.find(a=>a.username.toLowerCase()===username.toLowerCase()):undefined;
  if(typeof password!=='string'||password.length>128)return null;
  const salt=entry?.salt||'00000000000000000000000000000000',expected=entry?.hash||'0'.repeat(128);
  const actual=await scrypt(password,salt,64);const ok=/^[0-9a-f]{128}$/.test(expected)&&timingSafeEqual(actual,Buffer.from(expected,'hex'));
  let identityOk=true;if(entry?.identityHash){const value=typeof identity?.name==='string'&&typeof identity?.idNumber==='string'?identity.name.trim()+'\0'+identity.idNumber.toUpperCase():'';const actualIdentity=await scrypt(value,entry.identitySalt,64);identityOk=/^[0-9a-f]{128}$/.test(entry.identityHash)&&timingSafeEqual(actualIdentity,Buffer.from(entry.identityHash,'hex'))}
  if(!entry||entry.disabled||entry.lockedUntil>this.clock()||entry.salt!==salt||entry.hash!==expected)return null;
  const old={failures:entry.failures,lockedUntil:entry.lockedUntil};if(ok&&identityOk){entry.failures=0;entry.lockedUntil=0}else{entry.failures=(entry.failures||0)+1;if(entry.failures>=5){entry.lockedUntil=this.clock()+900000;entry.failures=0}}
  try{this.storage.save(this.accounts)}catch(e){Object.assign(entry,old);throw e}
  return ok&&identityOk?{username:entry.username,role:entry.role}:null;
 }
 identity(username){const account=this.accounts.find(a=>a.username===username&&!a.disabled);return account?{username:account.username,role:account.role}:null}
 list(){return this.accounts.map(({username,role,disabled})=>({username,role,disabled}))}
 async resetPassword(username,password){if(typeof password!=='string'||password.length<12||password.length>128)throw Error('密码无效');const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex'),previous={salt:entry.salt,hash:entry.hash,failures:entry.failures,lockedUntil:entry.lockedUntil};Object.assign(entry,{salt,hash,failures:0,lockedUntil:0});try{this.storage.save(this.accounts)}catch(e){Object.assign(entry,previous);throw e}}
 setRole(username,role){if(['class_teacher','instructor'].includes(role)&&!/^1[3-9]\d{9}$/.test(username))throw Error('手机号无效');if(!roles.has(role))throw Error('角色无效');const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.role;entry.role=role;try{this.storage.save(this.accounts)}catch(e){entry.role=previous;throw e}}
 enable(username){const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.disabled;entry.disabled=false;try{this.storage.save(this.accounts)}catch(e){entry.disabled=previous;throw e}}
 disable(username){const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.disabled;entry.disabled=true;try{this.storage.save(this.accounts)}catch(e){entry.disabled=previous;throw e}}
}
