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
     if ($files.Count -lt 200) {if ($relative.Length -gt 512 -or $relative -match '[\x00-\x1f]') {$partial=$true} else {$files.Add(@{path=$relative;size=$length})}} else {$partial=$true}
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
export function parseCleanupPreview(text){if(typeof text!=='string'||text.length>1048576)throw Error('预览回执无效');const lines=text.split(/\r?\n/).filter(x=>x.startsWith('CLASSROOM_CLEANUP_PREVIEW:'));if(lines.length!==1)throw Error('预览回执缺失');const raw=lines[0].slice('CLASSROOM_CLEANUP_PREVIEW:'.length);if(!raw||raw.length>200000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw))throw Error('预览回执无效');let x;try{x=JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}catch{throw Error('预览回执无效')}if(!x||!['complete','partial','not_found','no_drive','unsafe','error'].includes(x.status)||![x.fileCount,x.totalBytes,x.skipped].every(n=>Number.isSafeInteger(n)&&n>=0)||x.fileCount>5000||x.skipped>5000||!Array.isArray(x.files)||x.files.length>200||x.files.length>x.fileCount||x.files.some(f=>!f||!safePath(f.path)||!Number.isSafeInteger(f.size)||f.size<0)||new Set(x.files.map(f=>f.path.toLowerCase())).size!==x.files.length||x.files.reduce((n,f)=>n+f.size,0)>x.totalBytes||(['not_found','no_drive','unsafe','error'].includes(x.status)&&(x.fileCount!==0||x.totalBytes!==0||x.files.length||x.skipped!==0))||(x.status==='complete'&&(x.skipped!==0||x.fileCount!==x.files.length||x.files.reduce((n,f)=>n+f.size,0)!==x.totalBytes)))throw Error('预览回执不完整');return {status:x.status,fileCount:x.fileCount,totalBytes:x.totalBytes,skipped:x.skipped,files:x.files.map(({path,size})=>({path,size})),...(x.history===undefined?{}:{history:validateHistoryPreview(x.history,{allowUnknown:true})})}}
export async function runCleanupPreview(device,command){let result;try{result=parseCleanupPreview(await command(device,cleanupPreviewCommand(),{timeout:60000}))}catch(e){return {status:e?.code==='DEVICE_OFFLINE'?'offline':'unknown'}}try{result.history=parseHistoryPreview(await command(device,historyPreviewCommand(),{timeout:60000}))}catch{result.history={status:'unknown',size:0}}return result}
