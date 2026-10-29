import {examPaths} from './exam-paths.mjs';
const encode=s=>Buffer.from(s,'utf16le').toString('base64');
export function answerScanCommand(exam,student){
 const base=examPaths(exam,student).answers;
 const script=`$ErrorActionPreference='Stop';
$base=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encode(base)}'));
$current='E:\\'; $root=Get-Item -LiteralPath $current -Force;
if (($root.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'unsafe root'};
foreach ($part in $base.Substring(3).Split('\\')) {
 $current=Join-Path $current $part; $item=Get-Item -LiteralPath $current -Force;
 if (-not $item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {throw 'unsafe directory'}
};
$stack=New-Object 'System.Collections.Generic.Stack[string]'; $stack.Push($base);
$files=New-Object 'System.Collections.Generic.List[object]'; $count=0; $total=0;
while ($stack.Count -gt 0) {
 $dir=$stack.Pop();
 foreach ($item in @(Get-ChildItem -LiteralPath $dir -Force)) {
  $count++; if ($count -gt 1000) {throw 'too many entries'};
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'unsafe link'};
  if ($item.PSIsContainer) { $stack.Push($item.FullName); continue }
  if ($item.Length -gt 268435456) {throw 'file too large'};
  $total+=$item.Length; if ($total -gt 536870912 -or $files.Count -ge 20) {throw 'answers too large'};
  $relative=$item.FullName.Substring($base.Length+1).Replace('\\','/');
  $hash=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant();
  $files.Add(@{path=$relative;size=$item.Length;sha256=$hash})
 }
};
$json=ConvertTo-Json -InputObject @($files.ToArray()) -Compress -Depth 4;
Write-Output ('CLASSROOM_ANSWERS:'+ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)));`;
 return 'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+encode(script);
}
export function parseAnswerScan(output){
 const matches=[...String(output).matchAll(/^CLASSROOM_ANSWERS:([A-Za-z0-9+/=]+)\r?$/gm)];
 if(matches.length!==1||matches[0][1].length>65536)throw Error('答案扫描回执无效');
 let files;try{files=JSON.parse(Buffer.from(matches[0][1],'base64').toString('utf8'))}catch{throw Error('答案扫描回执无效')}
 if(!Array.isArray(files)||files.length>20)throw Error('答案扫描回执无效');return files;
}
