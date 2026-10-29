import {examPaths} from './exam-paths.mjs';
import {filename} from './artifact-store.mjs';
const reserved=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
function safeRelative(path){
 if(typeof path!=='string'||!path||path.length>512||path.includes('\\'))throw Error('答案路径无效');
 const parts=path.split('/');if(parts.length>10||parts.some(x=>!x||x==='.'||x==='..'||x.length>128||/[\x00-\x1f<>:"|?*]/.test(x)||/[. ]$/.test(x)||reserved.test(x)))throw Error('答案路径无效');
 filename(parts.at(-1));return parts;
}
export function planAnswerCollection({exam,student,device,available,files}){
 const base=examPaths(exam,student).answers;
 if(typeof device!=='string'||!Array.isArray(available)||available.filter(x=>x===device).length!==1||!Array.isArray(files)||files.length>20)throw Error('回收设备或文件列表无效');
 let total=0;const seen=new Set();
 return files.map(file=>{
  const parts=safeRelative(file?.path),key=parts.join('/').toLowerCase();if(seen.has(key))throw Error('答案文件重复');seen.add(key);
  if(!Number.isSafeInteger(file.size)||file.size<0||file.size>268435456||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('答案文件信息无效');
  total+=file.size;if(total>536870912)throw Error('答案总大小超限');
  return {exam,student,device,path:parts.join('/'),source:base+'\\'+parts.join('\\'),size:file.size,sha256:file.sha256};
 });
}
