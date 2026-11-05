import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {presentIdentity,roleMatrix} from './role-matrix.mjs';
const scrypt=promisify(scryptCallback);
const validName=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(x);
const phoneRe=/^1[3-9]\d{9}$/;
const nameRe=/^[\u4e00-\u9fa5·]{2,20}$/;
const idWeights=[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
const idCodes='10X98765432';
const validPassword=password=>typeof password==='string'&&password.length>=12&&password.length<=128;
function validId(id){if(typeof id!=='string'||!/^\d{17}[\dX]$/.test(id))return false;let sum=0;for(let i=0;i<17;i++)sum+=Number(id[i])*idWeights[i];return idCodes[sum%11]===id[17]}
function present(entry){return entry?presentIdentity(entry.username,entry.role):null}
async function check(store,username,secret,identityMode){
 const entry=validName(username)?store.accounts.find(a=>a.username.toLowerCase()===username.toLowerCase()):undefined;
 if(typeof secret!=='string'||secret.length>128)return null;
 const salt=entry?.salt||'00000000000000000000000000000000',expected=entry?.hash||'0'.repeat(128);
 const actual=await scrypt(secret,salt,64);
 let ok=/^[0-9a-f]{128}$/.test(expected)&&timingSafeEqual(actual,Buffer.from(expected,'hex'));
 if(identityMode){if(entry?.factor!=='identity'||entry.role!=='examiner')ok=false}else if(entry?.factor==='identity')ok=false;
 if(!entry||entry.disabled||entry.lockedUntil>store.clock()||entry.salt!==salt||entry.hash!==expected)return null;
 const old={failures:entry.failures,lockedUntil:entry.lockedUntil};
 if(ok){entry.failures=0;entry.lockedUntil=0}else{entry.failures=(entry.failures||0)+1;if(entry.failures>=5){entry.lockedUntil=store.clock()+900000;entry.failures=0}}
 try{store.storage.save(store.accounts)}catch(e){Object.assign(entry,old);throw e}
 return ok?present(entry):null;
}
export class AccountStore {
 constructor({storage={load:()=>[],save:()=>{}},clock=Date.now}={}){this.storage=storage;this.clock=clock;this.accounts=storage.load();if(!Array.isArray(this.accounts))throw Error('账号记录无效')}
 async create({username,password,role,name,idNumber}={}){
  const rule=roleMatrix[role];
  if(!rule)throw Error('账号参数无效');
  const identity=name!==undefined||idNumber!==undefined;
  let secret=password,factor;
  if(identity){
   if(role!=='examiner'||password!==undefined)throw Error('账号参数无效');
   if(typeof idNumber==='string')idNumber=idNumber.toUpperCase();
   if(!phoneRe.test(username)||!nameRe.test(name)||!validId(idNumber))throw Error('账号参数无效');
   secret=name+'\n'+idNumber;factor='identity';
  }else if(rule.login==='phone'){if(!phoneRe.test(username)||!validPassword(password))throw Error('账号参数无效')}
  else if(!validName(username)||!validPassword(password))throw Error('账号参数无效');
  if(this.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))throw Error('账号已存在');
  const salt=randomBytes(16).toString('hex'),hash=(await scrypt(secret,salt,64)).toString('hex');
  if(this.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))throw Error('账号已存在');
  const entry={username,role,salt,hash,disabled:false,failures:0,lockedUntil:0};
  if(factor)entry.factor=factor;
  this.accounts.push(entry);try{this.storage.save(this.accounts)}catch(e){this.accounts.pop();throw e}return {username,role,disabled:false};
 }
 authenticate(username,password){return check(this,username,password,false)}
 authenticateIdentity({phone,name,idNumber}={}){if(typeof idNumber==='string')idNumber=idNumber.toUpperCase();if(!phoneRe.test(phone)||!nameRe.test(name)||!validId(idNumber))return null;return check(this,phone,name+'\n'+idNumber,true)}
 identity(username){const account=this.accounts.find(a=>a.username===username&&!a.disabled);return present(account)}
 list(){return this.accounts.map(({username,role,disabled})=>({username,role,disabled}))}
 async resetPassword(username,password){if(!validPassword(password))throw Error('密码无效');const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');if(entry.factor==='identity')throw Error('密码无效');const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex'),previous={salt:entry.salt,hash:entry.hash,failures:entry.failures,lockedUntil:entry.lockedUntil};Object.assign(entry,{salt,hash,failures:0,lockedUntil:0});try{this.storage.save(this.accounts)}catch(e){Object.assign(entry,previous);throw e}}
 setRole(username,role){if(!roleMatrix[role])throw Error('角色无效');const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');if(entry.factor==='identity'||(roleMatrix[role].login==='phone'&&!phoneRe.test(entry.username)))throw Error('角色无效');const previous=entry.role;entry.role=role;try{this.storage.save(this.accounts)}catch(e){entry.role=previous;throw e}}
 enable(username){const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.disabled;entry.disabled=false;try{this.storage.save(this.accounts)}catch(e){entry.disabled=previous;throw e}}
 disable(username){const entry=this.accounts.find(a=>a.username===username);if(!entry)throw Error('账号不存在');const previous=entry.disabled;entry.disabled=true;try{this.storage.save(this.accounts)}catch(e){entry.disabled=previous;throw e}}
}
