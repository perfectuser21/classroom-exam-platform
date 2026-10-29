export function parseSoftwareResult(raw){
 const matches=[...String(raw).matchAll(/^CLASSROOM_RESULT:(\{[^\r\n]*\})\r?$/gm)];
 if(matches.length!==1)throw Error('未收到唯一安装回执');
 const value=JSON.parse(matches[0][1]);
 if(['already_ready','installed'].includes(value.status)&&typeof value.version==='string'&&/^\d+(\.\d+){1,3}$/.test(value.version))return {status:value.status,version:value.version};
 if(value.status==='failed'&&['python','probe','pip','import','version','dependencies','platform','package'].includes(value.stage))return {status:'failed',stage:value.stage};
 throw Error('安装回执无效');
}
