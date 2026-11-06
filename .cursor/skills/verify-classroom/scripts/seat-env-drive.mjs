import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync,renameSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {seatEnv} from './seat-env-doctor.mjs';
import {disposableSeatScope} from '../../../../seat-map.mjs';
import {createLocalMeshInvoke,createMeshMaterialClient} from '../../../../mesh-material-client.mjs';
import {anacondaExistingProbeCommand,parseAnacondaExistingProbe} from '../../../../anaconda-existing-probe.mjs';
import {anacondaManifest} from '../../../../anaconda-workflow.mjs';
const mode=process.argv[2]||'drive',run=resolve(process.argv[3]||'.classroom-evidence/current'),base='http://127.0.0.1:18199';
mkdirSync(run,{recursive:true,mode:0o700});const checks=[],privateFile=join(run,'seat-env-private.json');let browser,hiddenPackage;
const record=(ok,label)=>{checks.push(`${ok?'PASS':'FAIL'} R6 ${label}`);console.log(checks.at(-1));if(!ok)throw Error('acceptance')};
const ps=source=>'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from("$ErrorActionPreference='Stop';"+source,'utf16le').toString('base64');
const save=(name,data)=>writeFileSync(join(run,name),JSON.stringify(data,null,2)+'\n');
try{
 const env=seatEnv(),seat=disposableSeatScope(env),client=createMeshMaterialClient({invoke:createLocalMeshInvoke(env),disposableSeat:seat});
 if(mode==='cleanup'){
  if(existsSync(privateFile)){
   const m=JSON.parse(readFileSync(privateFile));record(seat&&m.device===seat.name&&m.nodeId===seat.id&&/^[a-f0-9-]{36}$/.test(m.id),'Cleanup manifest pins the disposable seat');
   const script=`$dir='E:\\ClassroomExam\\r6-${m.id}';$sentinel='E:\\ClassroomR6Sentinel-${m.id}.txt';foreach($p in @('E:\\','E:\\ClassroomExam',$dir)){if(Test-Path -LiteralPath $p){$i=Get-Item -LiteralPath $p -Force;if(($i.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'unsafe'}}};if(Test-Path -LiteralPath $dir){$files=@(Get-ChildItem -LiteralPath $dir -Force);foreach($f in $files){if($f.Name -ne 'owned.txt' -or $f.PSIsContainer -or ($f.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0 -or (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${m.hash}'){throw 'not owned'}};foreach($f in $files){[IO.File]::Delete($f.FullName)};[IO.Directory]::Delete($dir,$false)};if(Test-Path -LiteralPath $sentinel){$i=Get-Item -LiteralPath $sentinel -Force;if(($i.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0 -or (Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${m.hash}'){throw 'not owned'};[IO.File]::Delete($sentinel)};if((Test-Path -LiteralPath $dir)-or(Test-Path -LiteralPath $sentinel)){throw 'not clean'};Write-Output 'CLASSROOM_R6_FIXTURE:removed'`;
   record(String(await client.command(seat.name,ps(script))).split(/\r?\n/).includes('CLASSROOM_R6_FIXTURE:removed'),'Cleanup owned fixture and sentinel removed and verified');unlinkSync(privateFile);
  }else record(true,'Cleanup no outstanding owned Windows fixture');
 }else{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage();
  await page.goto(base+'/staff');await page.locator('#username').fill('verify_admin');await page.locator('#password').fill('Verify-only-admin-password-2026!');await Promise.all([page.waitForURL(base+'/'),page.getByRole('button',{name:'登录',exact:true}).click()]);
  await page.locator('button[data-page="environment"]').click();await page.getByRole('button',{name:'查看软件清单',exact:true}).click();await page.locator('#software-catalog h3').first().waitFor();
  record(await page.locator('#software-catalog').innerText().then(t=>t.includes('Anaconda')&&t.includes('D:')),'Drive staff UI shows catalog, supported D: target and cleanup action');
  await page.screenshot({path:join(run,'seat-env-catalog.png'),fullPage:true});
  record(!!seat,'Drive disposable Windows seat configured; no pilot seat selected');
  record(existsSync(join(run,'seat-env-doctor.txt'))&&!readFileSync(join(run,'seat-env-doctor.txt'),'utf8').includes('FAIL'),'Drive Windows Doctor passed before any write');
  await page.locator('.device-check').first().waitFor();for(const box of await page.locator('.device-check').all())await box.uncheck();
  await page.locator('.device-check').evaluateAll((nodes,name)=>nodes.forEach(n=>{n.checked=n.value===name}),seat.name);
  record(await page.locator('.device-check:checked').count()===1&&await page.locator('.device-check:checked').inputValue()===seat.name,'Drive selects only the pinned disposable seat');
  const api=context.request;
  async function get(path){const r=await api.get(base+path);if(!r.ok())throw Error('HTTP');return r.json()}
  async function poll(path,timeout=2100000){const start=Date.now();while(Date.now()-start<timeout){const jobs=await get(path);const job=Array.isArray(jobs)?jobs.at(-1):jobs;if(job&&job.state!=='running')return job;await new Promise(r=>setTimeout(r,1500))}throw Error('job timeout')}
  // Real, definite preflight failure: temporarily hide ONLY the run's local
  // installer copy. The Windows/Mesh transport and installer are never mocked.
  const packagePath=join(process.env.CLASSROOM_STATE_DIR||readFileSync(join(run,'state-path'),'utf8').trim(),'installers',anacondaManifest().filename);hiddenPackage={path:packagePath,hidden:packagePath+'.r6-held'};renameSync(hiddenPackage.path,hiddenPackage.hidden);
  await page.getByRole('button',{name:/一键安装 Anaconda/}).click();
  const failed=await poll('/api/anaconda-jobs');save('seat-env-install-failure.json',failed);record(failed.devices.length===1&&failed.devices[0].name===seat.name&&failed.devices[0].status==='blocked'&&failed.devices[0].reason==='installer','Drive missing run-owned installer produces definite failure, permits retry');
  await page.locator('#anaconda-retry-button').waitFor({timeout:15000});await page.screenshot({path:join(run,'seat-env-retry.png'),fullPage:true});
  renameSync(hiddenPackage.hidden,hiddenPackage.path);hiddenPackage=null;
  const requestPromise=page.waitForResponse(r=>r.url().endsWith('/api/anaconda-jobs')&&r.request().method()==='POST');await page.locator('#anaconda-retry-button').click();const created=await (await requestPromise).json();
  const installed=await poll('/api/anaconda-jobs/'+created.id);save('seat-env-install.json',installed);
  record(installed.id!==failed.id&&installed.devices[0].status==='installed','Drive retry through staff UI installs official Anaconda on Windows D:');
  const health=parseAnacondaExistingProbe(await client.command(seat.name,anacondaExistingProbeCommand(),{timeout:150000}));save('seat-env-health.json',health);
  record(health.status==='already_ready'&&health.version===installed.devices[0].version,'Drive independent Windows Python, notebook, Spyder and conda version readback');
  await page.waitForFunction(()=>document.querySelector('#software-result').textContent.includes('独立健康检查通过'),null,{timeout:15000});await page.screenshot({path:join(run,'seat-env-installed.png'),fullPage:true});
  const againPromise=page.waitForResponse(r=>r.url().endsWith('/api/anaconda-jobs')&&r.request().method()==='POST');await page.getByRole('button',{name:/一键安装 Anaconda/}).click();const again=await (await againPromise).json(),repeated=await poll('/api/anaconda-jobs/'+again.id);save('seat-env-install-repeat.json',repeated);
  record(repeated.devices[0].status==='already_ready'&&repeated.devices[0].version===health.version,'Drive repeated install reads healthy environment without overwriting');
  const id=randomUUID(),content='classroom-r6-owned-'+id,m={id,device:seat.name,nodeId:seat.id,hash:createHash('sha256').update(content).digest('hex')};writeFileSync(privateFile,JSON.stringify(m),{mode:0o600});
  const create=`$base='E:\\ClassroomExam';$dir=$base+'\\r6-${id}';$sentinel='E:\\ClassroomR6Sentinel-${id}.txt';$root=Get-Item -LiteralPath 'E:\\' -Force;if(($root.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'unsafe'};if(Test-Path -LiteralPath $base){$b=Get-Item -LiteralPath $base -Force;if(($b.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0 -or @(Get-ChildItem -LiteralPath $base -Force).Count -ne 0){throw 'not empty'}};[IO.Directory]::CreateDirectory($dir)|Out-Null;$bytes=[Text.Encoding]::UTF8.GetBytes('${content}');foreach($p in @($dir+'\\owned.txt',$sentinel)){$f=[IO.File]::Open($p,[IO.FileMode]::CreateNew);try{$f.Write($bytes,0,$bytes.Length)}finally{$f.Dispose()}};Write-Output 'CLASSROOM_R6_FIXTURE:created'`;
  record(String(await client.command(seat.name,ps(create))).split(/\r?\n/).includes('CLASSROOM_R6_FIXTURE:created'),'Drive creates only manifest-owned exam file plus unrelated sentinel');
  page.on('dialog',dialog=>dialog.accept());
  const cleanupResponse=page.waitForResponse(r=>/\/api\/cleanup-previews\/[^/]+\/execute$/.test(r.url())&&r.request().method()==='POST');await page.locator('#cleanup-execute-button').click();
  const cleanupCreated=await (await cleanupResponse).json();let cleanup=await poll('/api/cleanup-previews/'+cleanupCreated.id);save('seat-env-cleanup-job.json',cleanup);
  record(cleanup.operation==='cleanup'&&cleanup.devices[0].result.status==='cleaned'&&cleanup.devices[0].result.deleted===1&&cleanup.devices[0].result.verified===true,'Drive one-click scoped deletion and independent job readback');
  const verify=`if(Test-Path -LiteralPath 'E:\\ClassroomExam\\r6-${id}\\owned.txt'){throw 'retained'};if((Get-FileHash -LiteralPath 'E:\\ClassroomR6Sentinel-${id}.txt' -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${m.hash}'){throw 'sentinel changed'};Write-Output 'CLASSROOM_R6_POSTDELETE:verified'`;
  record(String(await client.command(seat.name,ps(verify))).split(/\r?\n/).includes('CLASSROOM_R6_POSTDELETE:verified'),'Drive independent deletion check confirms owned file gone and unrelated sentinel unchanged');
  await page.waitForFunction(()=>document.querySelector('#cleanup-preview-result').textContent.includes('删除后检查通过'));await page.screenshot({path:join(run,'seat-env-cleaned.png'),fullPage:true});
  const repeatResponse=page.waitForResponse(r=>/\/api\/cleanup-previews\/[^/]+\/execute$/.test(r.url())&&r.request().method()==='POST');await page.locator('#cleanup-execute-button').click();const repeatCreated=await (await repeatResponse).json();cleanup=await poll('/api/cleanup-previews/'+repeatCreated.id);save('seat-env-cleanup-repeat.json',cleanup);
  record(cleanup.operation==='cleanup'&&cleanup.devices[0].result.status==='already_clean'&&cleanup.devices[0].result.verified===true,'Drive repeated cleanup verifies already clean');
 }
}catch{if(!checks.at(-1)?.startsWith('FAIL'))checks.push(`FAIL R6 ${mode}: runtime operation failed; retained evidence and ownership manifest require inspection`);if(browser){try{await browser.contexts()[0]?.pages()[0]?.screenshot({path:join(run,'seat-env-failure.png'),fullPage:true})}catch{}}process.exitCode=1}
finally{if(hiddenPackage&&existsSync(hiddenPackage.hidden))renameSync(hiddenPackage.hidden,hiddenPackage.path);if(browser)await browser.close();writeFileSync(join(run,mode==='cleanup'?'seat-env-cleanup.txt':'seat-env-drive.txt'),checks.join('\n')+'\n')}
