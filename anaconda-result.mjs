export function parseAnacondaResult(raw){
 const matches=[...String(raw).matchAll(/^CLASSROOM_ANACONDA:(\{[^\r\n]*\})\r?$/gm)];if(matches.length!==1)throw Error('未收到有效安装回执');let value;try{value=JSON.parse(matches[0][1])}catch{throw Error('安装回执无效')}
 if(['already_ready','installed'].includes(value.status)&&typeof value.version==='string'&&/^\d+(\.\d+){1,3}$/.test(value.version)&&value.python===true&&value.jupyter===true&&value.spyder===true)return {status:value.status,version:value.version};
 if(value.status==='blocked'&&['existing','target','space','installer','permissions','verify'].includes(value.reason))return {status:'blocked',reason:value.reason};
 if(value.status==='failed'&&['installer','verify'].includes(value.stage))return {status:'failed',stage:value.stage};
 if(value.status==='unknown')return {status:'unknown'};throw Error('安装回执无效');
}
