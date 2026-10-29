import {readFileSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
export class FileJobStorage {
 constructor(path){this.path=path}
 load(){try{const data=JSON.parse(readFileSync(this.path,'utf8'));if(!Array.isArray(data))throw Error('任务记录格式错误');return data}catch(e){if(e.code==='ENOENT')return [];throw e}}
 save(jobs){const temp=this.path+'.'+randomBytes(8).toString('hex')+'.tmp';let fd;try{fd=openSync(temp,'wx',0o600);writeFileSync(fd,JSON.stringify(jobs));fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temp,this.path)}catch(e){if(fd!==undefined)closeSync(fd);try{unlinkSync(temp)}catch{}throw e}}
}
