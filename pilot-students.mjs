export function pilotStudents(users){
 if(!Array.isArray(users)||users.length>200)throw Error('考生名单不可用');const result=[],seen=new Set();
 for(const user of users){if(!Array.isArray(user?.roles))throw Error('考生角色无效');if(!user.roles.some(r=>r.shortname==='student'))continue;const id=Number(user.id),name=user.fullname||user.username;if(!Number.isSafeInteger(id)||id<1||seen.has(id)||typeof name!=='string'||!name.trim()||name.length>200)throw Error('考生身份无效');seen.add(id);result.push({id,name:name.trim()});if(result.length>50)throw Error('考生数量超出试点范围')}return result;
}
