import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createLocalMeshInvoke} from '../../../../mesh-material-client.mjs';
const run=resolve(process.argv[2]||'.classroom-evidence/current');
mkdirSync(run,{recursive:true,mode:0o700});
const lines=[];
// Only query device metadata. No pilot device is ever treated as disposable.
try {
 const env={...process.env};
 for(const line of readFileSync(join(process.env.HOME,'.credentials/1password.env'),'utf8').split('\n')){
  const m=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);if(m&&!env[m[1]])env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
 }
 const raw=await createLocalMeshInvoke({...env,CLASSROOM_MESH_BACKEND:'mac'})(['ListDevices','--json'],{timeout:15000});
 const devices=JSON.parse(raw);if(!Array.isArray(devices))throw Error('invalid');
 const pilots=devices.filter(d=>d.groupname==='教学机房-5台试点');
 lines.push(`INFO R6 local Mesh: ${pilots.length} shared pilot devices, ${pilots.filter(d=>d.conn&1).length} online; no device designated disposable`);
} catch {lines.push('INFO R6 local Mesh device inventory unavailable');}
lines.push(
 'FAIL R6 Doctor: one-click cleanup execution and post-delete verification are not implemented; existing cleanup is preview only',
 'FAIL R6 Doctor: one-click catalog installation and a real Windows seat health check have not been verified end-to-end',
 'FAIL R6 Doctor: no disposable Windows test seat and owned exam-file fixture have been established for safe Drive'
);
writeFileSync(join(run,'seat-env-doctor.txt'),lines.join('\n')+'\n');
console.log(lines.join('\n'));
process.exitCode=1;
