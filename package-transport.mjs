import {basename} from 'node:path';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const idPattern=new RegExp('^'+uuid+'$','i'),pathPattern=new RegExp('^D:\\\\ClassroomExam\\\\Installers\\\\'+uuid+'$','i');
const encode=s=>Buffer.from(s,'utf16le').toString('base64');
const command=s=>'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+encode(s);
function walk(path,create){return `$ErrorActionPreference='Stop'; $dir=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encode(path)}')); $current='D:\\'; $root=Get-Item -LiteralPath $current -Force; if (($root.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'unsafe'}; $parts=$dir.Substring(3).Split('\\'); for ($i=0;$i -lt $parts.Length;$i++) { $current=Join-Path $current $parts[$i]; if ($i -eq $parts.Length-1 -and $${create?'true':'false'}) {New-Item -ItemType Directory -Path $current -ErrorAction Stop | Out-Null} elseif (!(Test-Path -LiteralPath $current)) {if (!$${create?'true':'false'}) {throw 'missing'};New-Item -ItemType Directory -Path $current -ErrorAction Stop | Out-Null}; $item=Get-Item -LiteralPath $current -Force; if (!$item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {throw 'unsafe'} };`}
export function createPackageTransport({manifest,localPath,command:run,uploadPath}){
 if(!manifest||typeof manifest.filename!=='string'||!/^[a-zA-Z0-9._-]+\.(?:exe|zip|whl)$/i.test(manifest.filename)||basename(localPath)!==manifest.filename||!Number.isSafeInteger(manifest.size)||manifest.size<1||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw Error('安装包清单无效');
 function valid(path){if(typeof path!=='string'||!pathPattern.test(path))throw Error('安装包目录无效')}
 return {
  async prepare(device,id){if(typeof id!=='string'||!idPattern.test(id))throw Error('任务标识无效');const path='D:\\ClassroomExam\\Installers\\'+id;const output=await run(device,command(walk(path,true)+" Write-Output 'CLASSROOM_PACKAGE_DIRECTORY_READY'"));if(!String(output).split(/\r?\n/).includes('CLASSROOM_PACKAGE_DIRECTORY_READY'))throw Error('安装目录未确认');return path},
  async upload(device,path){valid(path);await uploadPath(device,path,localPath,manifest.size)},
  async verify(device,path){valid(path);const script=walk(path,false)+` $name=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encode(manifest.filename)}')); $file=Join-Path $dir $name; $item=Get-Item -LiteralPath $file -Force; if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {throw 'unsafe'}; $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant(); Write-Output ('CLASSROOM_PACKAGE:'+$item.Length+':'+$hash)`;const output=await run(device,command(script)),expected='CLASSROOM_PACKAGE:'+manifest.size+':'+manifest.sha256;if(!String(output).split(/\r?\n/).includes(expected))throw Error('安装包校验失败')}
 };
}
