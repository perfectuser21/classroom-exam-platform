import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const defaultPython=fileURLToPath(new URL('./.venv/bin/python',import.meta.url));
const imagePython=fileURLToPath(new URL('./.venv-xlsx/bin/python',import.meta.url));
const worker=fileURLToPath(new URL('./question-xlsx-worker.py',import.meta.url));
export async function parseQuestionXlsx(data,{python,allowImages=false}={}){
 if(!Buffer.isBuffer(data)||!data.length||data.length>5*1024*1024)throw Error('文件为空或超过 5 MB');
 if(typeof allowImages!=='boolean')throw Error('导入选项无效');const executable=python||(allowImages?imagePython:defaultPython);
 const out=await new Promise((resolve,reject)=>{const child=execFile(executable,[worker],{timeout:20000,maxBuffer:5*1024*1024,env:{...process.env,CLASSROOM_XLSX_IMAGES:allowImages?'1':'0'}},(error,stdout)=>error?reject(Error('工作簿解析失败或超时')):resolve(stdout));child.stdin.on('error',()=>{});child.stdin.end(data)});
 let result;try{result=JSON.parse(out)}catch{throw Error('工作簿解析失败')}if(result.error)throw Error(result.error);if(!Array.isArray(result.rows)||result.rows.length>1000)throw Error('工作簿结果无效');return result;
}
