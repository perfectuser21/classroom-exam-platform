import {QuestionBank} from './question-bank.mjs';
const types={单选:'single',多选:'multiple',判断:'truefalse',填空:'fill',简答:'essay'};
function asText(value){if(typeof value==='string')return value.trim();if(typeof value==='number'&&Number.isFinite(value))return String(value);if(value===null||value===undefined)return '';throw Error('包含不支持的单元格类型')}
function rowToQuestion(values){
 if(!Array.isArray(values)||values.length!==15)throw Error('列数不符合模板');const level=Number(asText(values[0])),type=types[asText(values[1])],stem=asText(values[2]),all=values.slice(3,13).map(asText);while(all.length&&all.at(-1)==='')all.pop();if(all.some(x=>!x))throw Error('选项必须从 A 开始连续填写');const reference=asText(values[13]),points=Number(asText(values[14]));if(['fill','essay'].includes(type)){if(all.length)throw Error('填空和简答题不填写选项');return {level,type,stem,reference,points}}const answer=reference.toUpperCase().replaceAll('，',',').replace(/\s+/g,'');if(!/^[A-J](,[A-J])*$/.test(answer))throw Error('正确答案应填写选项字母，例如 A 或 A,C');const answers=answer.split(',').map(x=>x.charCodeAt(0)-65);return {level,type,stem,options:all,answers,points};
}
export function validateImportRows(rows,existing){
 if(!Array.isArray(rows)||rows.length>1000||!Array.isArray(existing))throw Error('导入数据无效');const bank=new QuestionBank({storage:{load:()=>structuredClone(existing),save:()=>{}}}),items=[],errors=[];
 for(const row of rows){try{if(!Number.isInteger(row?.row)||row.row<2)throw Error('行号无效');if(row.imageError)throw Error(row.imageError);if(row.error)throw Error('包含公式或不支持的单元格');const item=rowToQuestion(row.values);bank.create(item);items.push(item)}catch(e){errors.push({row:Number.isInteger(row?.row)?row.row:0,message:e.message||'题目无效'})}}
 if(!rows.length)errors.push({row:0,message:'模板中没有题目'});return {items,errors};
}
