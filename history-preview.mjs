const source=String.raw`$ErrorActionPreference='Stop'
$status='error';$size=[long]0
try {
 $user=(Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).UserName
 if ([string]::IsNullOrWhiteSpace($user)) {$status='no_user'}
 else {
  $account=New-Object System.Security.Principal.NTAccount($user)
  $sid=$account.Translate([System.Security.Principal.SecurityIdentifier]).Value
  $profiles=@(Get-CimInstance Win32_UserProfile -ErrorAction Stop | Where-Object {$_.SID -eq $sid})
  if ($profiles.Count -ne 1 -or [string]::IsNullOrWhiteSpace($profiles[0].LocalPath)) {$status='unsupported_profile'}
  else {
   $root=[IO.Path]::GetFullPath($profiles[0].LocalPath).TrimEnd('\')
   if ($root -notmatch '^[A-Za-z]:\\Users\\[^\\]+$') {$status='unsupported_profile'}
   else {
    $drive=[IO.Path]::GetPathRoot($root);$paths=@($drive,(Join-Path $drive 'Users'),$root,(Join-Path $root '.ipython'),(Join-Path $root '.ipython\profile_default'),(Join-Path $root '.ipython\profile_default\history.sqlite'))
    $status='found'
    foreach ($path in $paths) {
     if (!(Test-Path -LiteralPath $path)) {$status='not_found';break}
     $item=Get-Item -LiteralPath $path -Force -ErrorAction Stop
     if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {$status='unsafe';break}
     if ($path -eq $paths[-1]) {if ($item.PSIsContainer) {$status='unsafe'} else {$size=[long]$item.Length}}
     elseif (!$item.PSIsContainer) {$status='unsafe';break}
    }
   }
  }
 }
} catch {$status='error';$size=[long]0}
if ($status -ne 'found') {$size=[long]0}
$json=@{status=$status;size=$size}|ConvertTo-Json -Compress
Write-Output ('CLASSROOM_HISTORY_PREVIEW:'+ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)))`;
export function historyPreviewCommand(){return 'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(source,'utf16le').toString('base64')}
export function parseHistoryPreview(text){
 if(typeof text!=='string'||text.length>65536)throw Error('历史检查回执无效');const lines=text.split(/\r?\n/).filter(x=>x.startsWith('CLASSROOM_HISTORY_PREVIEW:'));if(lines.length!==1)throw Error('历史检查回执缺失');const raw=lines[0].slice('CLASSROOM_HISTORY_PREVIEW:'.length);if(!raw||raw.length>4096||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw))throw Error('历史检查回执无效');let x;try{x=JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}catch{throw Error('历史检查回执无效')}
 return validateHistoryPreview(x);
}
export function validateHistoryPreview(x,{allowUnknown=false}={}){
 if(!x||!['found','not_found','no_user','unsupported_profile','unsafe','error',...(allowUnknown?['unknown']:[])].includes(x.status)||!Number.isSafeInteger(x.size)||x.size<0||(x.status!=='found'&&x.size!==0))throw Error('历史检查回执无效');return {status:x.status,size:x.size};
}
