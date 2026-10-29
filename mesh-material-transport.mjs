const encode=s=>Buffer.from(s,'utf16le').toString('base64');
const decodeVar=(name,value)=>`$${name}=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encode(value)}'))`;
const command=script=>'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+encode(script);
const walk=`$parts=$dir.Substring(3).Split('\\'); $current='E:\\';
$item=Get-Item -LiteralPath $current -Force -ErrorAction Stop;
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse' }
for ($i=0; $i -lt $parts.Length; $i++) {
 $current=Join-Path $current $parts[$i];
 if ($i -eq $parts.Length-1 -and $create) {
   New-Item -ItemType Directory -Path $current -ErrorAction Stop | Out-Null;
 } elseif (-not (Test-Path -LiteralPath $current)) {
   if (-not $create) { throw 'missing' }
   New-Item -ItemType Directory -Path $current -ErrorAction Stop | Out-Null;
 }
 $item=Get-Item -LiteralPath $current -Force -ErrorAction Stop;
 if (-not $item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'unsafe' }
}`;
function script(plan,create){
 const prefix=`$ErrorActionPreference='Stop'; ${decodeVar('dir',plan.directory)}; $create=$${create?'true':'false'}; ${walk};`;
 return create?prefix+" Write-Output 'CLASSROOM_DIRECTORY_READY'":prefix+` ${decodeVar('name',plan.name)}; $file=Join-Path $dir $name; $item=Get-Item -LiteralPath $file -Force -ErrorAction Stop; if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {throw 'unsafe'}; $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant(); Write-Output ('CLASSROOM_HASH:'+$item.Length+':'+$hash)`;
}
export function makeMeshMaterialTransport({command:run,upload}){
 return {
  async prepare(plan){const out=await run(plan.device,command(script(plan,true)));if(!String(out).split(/\r?\n/).includes('CLASSROOM_DIRECTORY_READY'))throw Error('目录确认缺失')},
  async upload(plan,data){await upload(plan.device,plan.directory,plan.name,data)},
  async verify(plan){const out=String(await run(plan.device,command(script(plan,false))));const matches=[...out.matchAll(/^CLASSROOM_HASH:(\d+):([a-f0-9]{64})\r?$/gm)];if(matches.length!==1)throw Error('校验回执缺失');const size=Number(matches[0][1]);if(!Number.isSafeInteger(size))throw Error('文件大小无效');return {size,sha256:matches[0][2]}}
 };
}
