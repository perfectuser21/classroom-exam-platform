import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createLocalMeshInvoke,createMeshMaterialClient} from '../../../../mesh-material-client.mjs';
import {disposableSeatScope} from '../../../../seat-map.mjs';
import {anacondaProbeCommand,parseAnacondaProbe} from '../../../../anaconda-probe.mjs';
import {cleanupPreviewCommand,parseCleanupPreview} from '../../../../cleanup-preview.mjs';
export function seatEnv(){const env={...process.env};for(const line of readFileSync(join(process.env.HOME||process.env.USERPROFILE,'.credentials/1password.env'),'utf8').split('\n')){const m=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);if(m&&!env[m[1]])env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}return {...env,CLASSROOM_MESH_BACKEND:env.CLASSROOM_MESH_BACKEND||'mac'}}
export async function doctor(run){
 mkdirSync(run,{recursive:true,mode:0o700});const lines=[],details={};
 const check=(ok,label)=>{lines.push(`${ok?'PASS':'FAIL'} R6 Doctor: ${label}`);return ok};
 try{
  const env=seatEnv(),seat=disposableSeatScope(env),invoke=createLocalMeshInvoke(env);
  const devices=JSON.parse(await invoke(['ListDevices','--json'],{timeout:15000}));
  if(!Array.isArray(devices))throw Error('inventory');
  details.inventory=devices.map(d=>({name:d.name,group:d.groupname,online:!!(d.conn&1)}));
  lines.push(`INFO R6 Mesh: ${devices.length} devices; ${devices.filter(d=>d.conn&1).length} online; shared pilots never used for writes`);
  if(check(!!seat,'explicitly designated disposable Windows seat (separate group and pinned identity)')){
   const found=devices.filter(d=>d.name===seat.name);
   if(check(found.length===1&&found[0]._id===seat.id&&found[0].groupname===seat.group&&!!(found[0].conn&1),'disposable Mesh seat uniquely online')){
    const client=createMeshMaterialClient({invoke,disposableSeat:seat});
    const probe=parseAnacondaProbe(await client.command(seat.name,anacondaProbeCommand()));details.installProbe=probe;
    check(!probe.existing&&!probe.targetExists&&probe.dFreeBytes>=15*1024**3,'Windows administrator, clean Anaconda target and sufficient D: space');
    const preview=parseCleanupPreview(await client.command(seat.name,cleanupPreviewCommand()));details.cleanupProbe=preview;
    check(['complete','not_found'].includes(preview.status)&&preview.fileCount===0,'exam directory empty and safe before run-owned fixture creation');
    const code="$ErrorActionPreference='Stop';$d=Get-Item -LiteralPath 'E:\\' -Force;if(($d.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'unsafe'};if([Environment]::OSVersion.Platform -ne 'Win32NT'){throw 'windows'};Write-Output 'CLASSROOM_R6_WINDOWS:ready'";
    check(String(await client.command(seat.name,'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(code,'utf16le').toString('base64'))).split(/\r?\n/).includes('CLASSROOM_R6_WINDOWS:ready'),'real Windows OS and safe E: drive');
    const hashCode="$ErrorActionPreference='Stop';$hash=(Get-FileHash -LiteralPath (Join-Path $PSHOME 'powershell.exe') -Algorithm SHA256).Hash;if($hash -notmatch '^[a-fA-F0-9]{64}$'){throw 'hash'};Write-Output 'CLASSROOM_R6_HASH:ready'";
    check(String(await client.command(seat.name,'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(hashCode,'utf16le').toString('base64'))).split(/\r?\n/).includes('CLASSROOM_R6_HASH:ready'),'Windows SHA256 utility available for package verification and cleanup snapshots');
   }
  }
 }catch{check(false,'device inventory or independent Windows prerequisite probe unavailable')}
 try{
  const login=await fetch('http://127.0.0.1:18199/api/staff/login',{method:'POST',headers:{'content-type':'application/json','x-classroom-request':'staff-login'},body:JSON.stringify({username:'verify_admin',password:'Verify-only-admin-password-2026!'})});
  const cookie=login.headers.get('set-cookie')?.split(';')[0];if(!login.ok||!cookie)throw Error('login');
  const headers={cookie};const cap=await (await fetch('http://127.0.0.1:18199/api/capabilities',{headers})).json(),pkgs=await (await fetch('http://127.0.0.1:18199/api/software-packages',{headers})).json();
  check(cap.anacondaInstall===true,'catalog Anaconda execution enabled for the verification gateway');
  check(pkgs.find(p=>p.id==='anaconda')?.status==='ready','official installer size and SHA256 verified');
 }catch{check(false,'authenticated gateway catalog prerequisites unavailable')}
 writeFileSync(join(run,'seat-env-doctor.json'),JSON.stringify(details,null,2)+'\n');
 writeFileSync(join(run,'seat-env-doctor.txt'),lines.join('\n')+'\n');console.log(lines.join('\n'));
 return !lines.some(l=>l.startsWith('FAIL'));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'))){process.exitCode=await doctor(resolve(process.argv[2]||'.classroom-evidence/current'))?0:1}
