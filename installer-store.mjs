import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export class InstallerStore {
 constructor(root,manifest){if(!manifest||typeof manifest.filename!=='string'||!/^[a-zA-Z0-9._-]+$/.test(manifest.filename)||!Number.isSafeInteger(manifest.size)||manifest.size<1||!/^([a-f0-9]{64})$/.test(manifest.sha256))throw Error('安装包清单无效');this.path=join(root,manifest.filename);this.manifest=structuredClone(manifest)}
 async inspect(){let fd;try{fd=await open(this.path,constants.O_RDONLY|constants.O_NOFOLLOW);const before=await fd.stat({bigint:true});if(!before.isFile()||before.size!==BigInt(this.manifest.size))return {status:'invalid'};const hash=createHash('sha256');for await(const chunk of fd.createReadStream({autoClose:false}))hash.update(chunk);const after=await fd.stat({bigint:true}),pathStat=await lstat(this.path,{bigint:true});if(before.ino!==after.ino||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs||pathStat.ino!==after.ino||pathStat.dev!==after.dev||!pathStat.isFile()||hash.digest('hex')!==this.manifest.sha256)return {status:'invalid'};return {status:'ready'}}catch(e){if(e.code==='ENOENT')return {status:'missing'};if(e.code==='ELOOP')return {status:'invalid'};return {status:'unavailable'}}finally{if(fd)await fd.close().catch(()=>{})}}
}
