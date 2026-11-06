// Runs only on a disposable GitHub-hosted Windows VM. No shared credentials,
// Mesh service, pilot identity or pilot storage is reachable from this harness.
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,createWriteStream,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import https from 'node:https';
import {pipeline} from 'node:stream/promises';
import {AccountStore} from '../account-store.mjs';
import {FileJobStorage} from '../job-storage.mjs';
import {InstallerStore} from '../installer-store.mjs';
import {anacondaManifest} from '../anaconda-workflow.mjs';
const exec=promisify(execFile),run=resolve('.classroom-evidence/windows');
mkdirSync(run,{recursive:true});
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_ENVIRONMENT!=='github-hosted'||process.env.GITHUB_REPOSITORY!=='perfectuser21/classroom-exam-platform'||process.env.GITHUB_REF!=='refs/heads/poteto/r6-seat-env')throw Error('Disposable hosted Windows R6 branch required');
writeFileSync(join(run,'seat-env-source.json'),JSON.stringify({repository:process.env.GITHUB_REPOSITORY,sha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,platform:process.platform,runner:process.env.RUNNER_ENVIRONMENT},null,2)+'\n');
const temp=mkdtempSync(join(tmpdir(),'classroom-r6-')),state=join(temp,'state'),home=join(temp,'home'),data=join(temp,'mesh-data'),children=[],logs=[];
for(const dir of [state,join(state,'installers'),join(home,'.credentials'),data])mkdirSync(dir,{recursive:true});
const credential={username:'r6admin',password:randomBytes(32).toString('hex')};
const credentialFile=join(temp,'mesh-private.json');writeFileSync(credentialFile,JSON.stringify(credential));
writeFileSync(join(home,'.credentials/1password.env'),'# Isolated runner; no shared secrets\n');
writeFileSync(join(home,'.credentials/classroom-frontend.json'),JSON.stringify({username:'r6-basic',password:randomBytes(32).toString('hex')}));
const env={...process.env,HOME:home,USERPROFILE:home,CLASSROOM_STATE_DIR:state,CLASSROOM_PORT:'18199',CLASSROOM_ENABLE_STAFF_AUTH:'1',CLASSROOM_ENABLE_ANACONDA:'1',CLASSROOM_MESH_BACKEND:'mac',CLASSROOM_VERIFY_MESH_CREDENTIAL_FILE:credentialFile};
const mesh=resolve('node_modules/meshcentral/meshcentral.js'),ctrl=resolve('node_modules/meshcentral/meshctrl.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let phase='Launch',failed=false;
function launch(file,args,log){const stream=createWriteStream(join(run,log),{flags:'a'});logs.push(stream);const child=spawn(file,args,{env,stdio:['pipe','pipe','pipe'],windowsHide:true});child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});if(log==='drive.log')child.stdout.pipe(process.stdout,{end:false});child.on('error',error=>stream.write('Process error: '+error.code+'\n'));children.push(child);return child}
async function node(file,args=[],extra={}){return (await exec(process.execPath,[file,...args],{env:{...env,...extra},timeout:180000,maxBuffer:1048576})).stdout}
async function ps(source){const file=join(temp,'local-'+randomBytes(6).toString('hex')+'.ps1');writeFileSync(file,"$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';\n"+source);return (await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{timeout:180000,maxBuffer:1048576})).stdout}
async function until(fn,timeout=120000){const start=Date.now();while(Date.now()-start<timeout){for(const child of children){if(child.exitCode!==null||child.signalCode)throw Error('Required child exited during '+phase+'; inspect retained logs')}try{const value=await fn();if(value)return value}catch{}await sleep(1000)}throw Error('Timed out during '+phase)}
async function control(args){return node(ctrl,args,{MESHCTRL_URL:'wss://127.0.0.1:18443',MESHCTRL_LOGINUSER:credential.username,MESHCTRL_LOGINPASS:credential.password})}
function localGet(path){return new Promise((resolve,reject)=>{https.get('https://127.0.0.1:18443'+path,{rejectUnauthorized:false},r=>{if(r.statusCode!==200){r.resume();reject(Error('Local Mesh HTTP '+r.statusCode));return}resolve(r)}).on('error',reject)})}
try{
 phase='Launch clean hosted image';console.log(phase);
 const prepared=await ps(readFileSync(resolve('workflows/r6-prepare-windows.ps1'),'utf8'));
 writeFileSync(join(run,'seat-env-image.txt'),prepared);console.log(prepared);
 console.log('Launch: isolated Windows storage, Mesh and gateway');
 // New real NTFS volumes when the hosted image has no D:/E:. Never reformat
 // an existing drive. The runner VM and these VHDs are destroyed by Actions.
 console.log(await ps(`foreach($letter in @('D','E')){if(!(Test-Path ($letter+':\\'))){$vhd=Join-Path '${temp.replaceAll("'","''")}' ($letter+'.vhdx');$maximum=if($letter -eq 'D'){40000}else{128};$script=@(('create vdisk file="{0}" maximum={1} type=expandable' -f $vhd,$maximum),('select vdisk file="{0}"' -f $vhd),'attach vdisk','create partition primary','format fs=ntfs quick label=ClassroomR6',('assign letter={0}' -f $letter));$file=$vhd+'.txt';$script | Set-Content -LiteralPath $file -Encoding ASCII;diskpart /s $file;if(!(Test-Path ($letter+':\\'))){throw ('volume unavailable: '+$letter)}}};Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,FreeSpace,Size | Format-Table`));
 writeFileSync(join(data,'config.json'),JSON.stringify({settings:{cert:'127.0.0.1',port:18443,portBind:'127.0.0.1',redirPort:0,mpsPort:0,wanOnly:true,exactPorts:true},domains:{'':{newAccounts:false}}}));
 // Keep generated passwords out of CLI arguments and retained logs.
 const bootstrap=join(temp,'mesh-bootstrap.cjs');
 writeFileSync(bootstrap,`const fs=require('fs');const c=JSON.parse(fs.readFileSync(${JSON.stringify(credentialFile)}));process.argv=[process.execPath,${JSON.stringify(mesh)},'--datapath',${JSON.stringify(data)},'--launch','1',...process.argv.slice(2)];if(process.argv.includes('--createaccount'))process.argv.push(c.username,'--pass',c.password);if(process.argv.includes('--adminaccount'))process.argv.push(c.username);require(${JSON.stringify(resolve('workflows/mesh-runtime.cjs'))}).loadMeshRuntime().mainStart();`);
 phase='Launch Mesh account';await node(bootstrap,['--createaccount']);await node(bootstrap,['--adminaccount']);
 phase='Launch Mesh control';console.log(phase);
 launch(process.execPath,[bootstrap],'mesh.log');
 await until(async()=>{const text=await control(['ListDevices','--json']);return Array.isArray(JSON.parse(text))});
 await control(['AddDeviceGroup','--name','Classroom-R6-Disposable']);
 const groups=JSON.parse(await control(['ListDeviceGroups','--json'])),group=groups.find(g=>g.name==='Classroom-R6-Disposable');
 if(!group)throw Error('Isolated group missing');
 phase='Launch Windows agent';console.log(phase);const agent=join(temp,'meshagent.exe');await pipeline(await localGet('/meshagents?id=4&meshid='+encodeURIComponent(group._id.split('/')[2])),createWriteStream(agent));
 launch(agent,['run'],'agent.log');
 const device=await until(async()=>{const devices=JSON.parse(await control(['ListDevices','--json']));if(devices.length>1)throw Error('Isolated inventory expected');return devices.find(d=>d.groupname==='Classroom-R6-Disposable'&&(d.conn&1))},180000);
 const name='R6-DISPOSABLE-'+process.env.GITHUB_RUN_ID;await control(['EditDevice','--id',device._id,'--name',name]);
 env.CLASSROOM_VERIFY_DISPOSABLE_SEAT=JSON.stringify({name,id:device._id,group:'Classroom-R6-Disposable',disposable:true});
 const accounts=new AccountStore({storage:new FileJobStorage(join(state,'staff-accounts.json'))});await accounts.create({username:'verify_admin',password:'Verify-only-admin-password-2026!',role:'admin'});
 phase='Launch official installer';console.log('Launch: downloading pinned official Anaconda installer');
 const manifest=anacondaManifest(),installer=join(state,'installers',manifest.filename),response=await fetch(manifest.source);if(!response.ok)throw Error('Official installer HTTP '+response.status);await pipeline(response.body,createWriteStream(installer));
 if((await new InstallerStore(join(state,'installers'),manifest).inspect()).status!=='ready')throw Error('Official installer integrity failed');
 launch(process.execPath,['gateway.mjs'],'gateway.log');await until(async()=>{try{return (await fetch('http://127.0.0.1:18199/staff')).ok}catch{return false}});
 writeFileSync(join(run,'seat-env-launch.txt'),'PASS R6 Launch: real disposable Windows, isolated Mesh Agent, pinned official installer and gateway\n');
 phase='Doctor';console.log(await node('.cursor/skills/verify-classroom/scripts/seat-env-doctor.mjs',[run]));
 phase='Drive';
 // Stream check progress while the actual installer can take many minutes.
 const drive=launch(process.execPath,['.cursor/skills/verify-classroom/scripts/seat-env-drive.mjs','drive',run],'drive.log');
 const status=await new Promise((resolve,reject)=>{drive.once('error',reject);drive.once('exit',resolve)});if(status!==0)throw Error('Drive failed');
}catch(error){failed=true;writeFileSync(join(run,'seat-env-runner.txt'),'FAIL R6 '+phase+': '+error.message.replaceAll(credential.password,'[redacted]')+'\n');console.error('FAIL R6 '+phase+'; see sanitized receipts and logs')}
finally{
 phase='Cleanup';try{console.log(await node('.cursor/skills/verify-classroom/scripts/seat-env-drive.mjs',['cleanup',run]))}catch{failed=true;writeFileSync(join(run,'seat-env-cleanup.txt'),'FAIL R6 Cleanup: owned Windows fixture requires inspection\n')}
 for(const child of children.reverse()){if(child.exitCode===null){try{await exec('taskkill',['/PID',String(child.pid),'/T','/F'],{timeout:15000})}catch{}}}
 for(const log of logs)log.end();
 const receipts=['seat-env-launch.txt','seat-env-doctor.txt','seat-env-drive.txt','seat-env-cleanup.txt'];let result='';for(const file of receipts)result+=existsSync(join(run,file))?readFileSync(join(run,file),'utf8'):'FAIL R6 missing '+file+'\n';if(existsSync(join(run,'seat-env-runner.txt')))result+=readFileSync(join(run,'seat-env-runner.txt'),'utf8');
 failed ||= result.includes('FAIL');result+=(failed?'FAIL':'PASS')+' verify-classroom R6 disposable Windows install and cleanup\n';writeFileSync(join(run,'result.txt'),result);console.log(result);
 // Private Mesh config, account DBs and passwords never become artifacts.
 // A failed fixture cleanup retains its manifest until the VM is destroyed.
 if(!existsSync(join(run,'seat-env-private.json'))){try{await ps(`foreach($letter in @('D','E')){$vhd=Join-Path '${temp.replaceAll("'","''")}' ($letter+'.vhdx');if(Test-Path -LiteralPath $vhd){$file=$vhd+'.detach.txt';@(('select vdisk file="{0}"' -f $vhd),'detach vdisk') | Set-Content -LiteralPath $file -Encoding ASCII;diskpart /s $file | Out-Null}}`);rmSync(temp,{recursive:true,force:true})}catch{console.log('INFO R6: runner VM destruction will remove remaining temporary storage')}}
 process.exitCode=failed?1:0;
}
