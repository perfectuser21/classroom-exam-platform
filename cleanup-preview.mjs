import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {historyPreviewCommand,parseHistoryPreview,validateHistoryPreview} from './history-preview.mjs';
const source=String.raw`$ErrorActionPreference='Stop'
$base='E:\ClassroomExam';$files=New-Object 'System.Collections.Generic.List[object]';$count=0;$bytes=[long]0;$skipped=0;$partial=$false;$status='complete'
try {
 if (!(Get-PSDrive -Name E -ErrorAction SilentlyContinue)) {$status='no_drive'}
 elseif (!(Test-Path -LiteralPath $base)) {$status='not_found'}
 else {
  $drive=Get-Item -LiteralPath 'E:\' -Force; $root=Get-Item -LiteralPath $base -Force
  if (!$root.PSIsContainer -or (($root.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or (($drive.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {$status='unsafe'}
  else {
   $queue=New-Object 'System.Collections.Generic.Queue[object]';$queue.Enqueue(@{path=$base;depth=0});$seen=0
   while ($queue.Count -gt 0 -and $seen -lt 5000) {
    $entry=$queue.Dequeue()
    foreach ($name in [IO.Directory]::EnumerateFileSystemEntries($entry.path)) {
     if ($seen -ge 5000) {$partial=$true;break};$seen++;$item=Get-Item -LiteralPath $name -Force
     if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {$skipped++;$partial=$true;continue}
     if ($item.PSIsContainer) {if ($entry.depth -ge 6) {$partial=$true} else {$queue.Enqueue(@{path=$name;depth=($entry.depth+1)})};continue}
     $relative=$item.FullName.Substring($base.Length+1).Replace('\','/');$length=[long]$item.Length;$count++;$bytes+=$length
     if ($files.Count -lt 200) {if ($relative.Length -gt 512 -or $relative -match '[\x00-\x1f]') {$partial=$true} else {$files.Add(@{path=$relative;size=$length;sha256=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()})}} else {$partial=$true}
    }
   }
   if ($queue.Count -gt 0) {$partial=$true};if ($partial) {$status='partial'}
  }
 }
} catch {$status='error';$count=0;$bytes=0;$skipped=0;$files.Clear()}
$result=@{status=$status;fileCount=$count;totalBytes=$bytes;skipped=$skipped;files=@($files.ToArray())}|ConvertTo-Json -Depth 5 -Compress
Write-Output ('CLASSROOM_CLEANUP_PREVIEW:'+ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($result)))`;
export function cleanupPreviewCommand(){return 'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(source,'utf16le').toString('base64')}
const safePath=p=>typeof p==='string'&&p.length>0&&p.length<=512&&!/[\x00-\x1f\\:]/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
export function parseCleanupPreview(text){if(typeof text!=='string'||text.length>1048576)throw Error('预览回执无效');const lines=text.split(/\r?\n/).filter(x=>x.startsWith('CLASSROOM_CLEANUP_PREVIEW:'));if(lines.length!==1)throw Error('预览回执缺失');const raw=lines[0].slice('CLASSROOM_CLEANUP_PREVIEW:'.length);if(!raw||raw.length>200000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw))throw Error('预览回执无效');let x;try{x=JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}catch{throw Error('预览回执无效')}if(!x||!['complete','partial','not_found','no_drive','unsafe','error'].includes(x.status)||![x.fileCount,x.totalBytes,x.skipped].every(n=>Number.isSafeInteger(n)&&n>=0)||x.fileCount>5000||x.skipped>5000||!Array.isArray(x.files)||x.files.length>200||x.files.length>x.fileCount||x.files.some(f=>!f||!safePath(f.path)||!Number.isSafeInteger(f.size)||f.size<0||(f.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(f.sha256)))||new Set(x.files.map(f=>f.path.toLowerCase())).size!==x.files.length||x.files.reduce((n,f)=>n+f.size,0)>x.totalBytes||(['not_found','no_drive','unsafe','error'].includes(x.status)&&(x.fileCount!==0||x.totalBytes!==0||x.files.length||x.skipped!==0))||(x.status==='complete'&&(x.skipped!==0||x.fileCount!==x.files.length||x.files.reduce((n,f)=>n+f.size,0)!==x.totalBytes)))throw Error('预览回执不完整');return {status:x.status,fileCount:x.fileCount,totalBytes:x.totalBytes,skipped:x.skipped,files:x.files.map(({path,size,sha256})=>({path,size,...sha256===undefined?{}:{sha256}})),...(x.history===undefined?{}:{history:validateHistoryPreview(x.history,{allowUnknown:true})})}}
export async function runCleanupPreview(device,command){let result;try{result=parseCleanupPreview(await command(device,cleanupPreviewCommand(),{timeout:60000}))}catch(e){return {status:e?.code==='DEVICE_OFFLINE'?'offline':'unknown'}}try{result.history=parseHistoryPreview(await command(device,historyPreviewCommand(),{timeout:60000}))}catch{result.history={status:'unknown',size:0}}return result}

export function cleanupSnapshot(preview){
 const p=parseCleanupPreview('CLASSROOM_CLEANUP_PREVIEW:'+Buffer.from(JSON.stringify(preview)).toString('base64'));
 if(!['complete','not_found'].includes(p.status)||p.files.some(f=>!f.sha256||f.path.split('/').some(part=>/[. ]$|[<>"|?*]/.test(part)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))))throw Error('需要完整、带校验值的安全预览，请重新预览');
 const rows=p.files.map(f=>Buffer.from(f.path).toString('base64')+':'+f.size+':'+f.sha256).sort();
 return {count:p.fileCount,digest:createHash('sha256').update(rows.length?rows.join('\n')+'\n':'').digest('hex')};
}
export function cleanupExecutionCommand(preview){
 const snapshot=cleanupSnapshot(preview),script=readFileSync(new URL('./workflows/cleanup-exam-files.ps1',import.meta.url),'utf8').replace('__DIGEST__',snapshot.digest).replace('__COUNT__',String(snapshot.count));
 const zipped=gzipSync(Buffer.from(script)).toString('base64');
 const wrapper="$b=[Convert]::FromBase64String('"+zipped+"');$m=New-Object IO.MemoryStream(,$b);$g=New-Object IO.Compression.GZipStream($m,[IO.Compression.CompressionMode]::Decompress);$r=New-Object IO.StreamReader($g,[Text.Encoding]::UTF8);& ([ScriptBlock]::Create($r.ReadToEnd()))";
 // The wrapper is ASCII with only a generated base64 literal, so cmd.exe can
 // carry it directly without the 8 KB expansion of UTF-16 EncodedCommand.
 const command='powershell.exe -NoProfile -NonInteractive -Command "'+wrapper+'"';
 if(command.length>=8000)throw Error('清理命令过长');return command;
}
export async function runCleanupExecution(device,preview,command){
 // An interrupted remote command may already have deleted files: retain the lock.
 try{
  const cmd=cleanupExecutionCommand(preview),raw=await command(device,cmd,{timeout:120000});
  const lines=String(raw).split(/\r?\n/).filter(x=>x.startsWith('CLASSROOM_CLEANUP_EXECUTION:'));
  if(lines.length!==1||lines[0].length>2048)throw Error('清理回执无效');
  const result=JSON.parse(Buffer.from(lines[0].split(':')[1],'base64').toString('utf8'));
  if(result.status==='blocked'&&result.deleted===0&&['unsafe','changed','no_drive'].includes(result.reason))return {status:'blocked',reason:result.reason};
  if(!['cleaned','already_clean'].includes(result.status)||result.deleted!==preview.fileCount||(result.status==='already_clean')!==(result.deleted===0))throw Error('清理回执无效');
  const after=parseCleanupPreview(await command(device,cleanupPreviewCommand(),{timeout:60000}));
  if(!['complete','not_found'].includes(after.status)||after.fileCount!==0)throw Error('删除后检查未通过');
  return {status:result.status,deleted:result.deleted,verified:true};
 }catch{return {status:'unknown'}}
}
