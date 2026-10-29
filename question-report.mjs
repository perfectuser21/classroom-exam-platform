import {csvCell} from './exam-export.mjs';
export function questionErrorCsv(errors,format='excel'){
 if(!['excel','word'].includes(format)||!Array.isArray(errors)||errors.length<1||errors.length>1000||errors.some(x=>!Number.isInteger(x?.row)||x.row<0||x.row>1001||(format==='word'&&x.row===1)||typeof x.message!=='string'||!x.message||x.message.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(x.message)))throw Error('错误报告数据无效');
 const label=x=>format==='word'?(x.row?'第 '+(x.row-1)+' 个表格':'文档整体'):x.row;
 return '\ufeff'+[[format==='word'?'位置':'行号','错误'],...errors.map(x=>[label(x),x.message])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
