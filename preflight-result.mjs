import {decodeProbe} from './software-probe.mjs';
export function normalizePreflight(value) {
 if(value.error) return {name:value.name,error:value.error};
 try { const data=decodeProbe(value.raw || ''); return {name:value.name,online:true,...data}; }
 catch { return {name:value.name,online:!!value.online,error:'环境检查未返回完整结果'}; }
}
