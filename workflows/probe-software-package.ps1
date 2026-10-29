$ErrorActionPreference = 'Stop'
$python = 'D:\Anaconda3\python.exe'
function Decode([string]$value) { $b=[Convert]::FromBase64String($value);$g=[IO.Compression.GZipStream]::new([IO.MemoryStream]::new($b),[IO.Compression.CompressionMode]::Decompress);return [IO.StreamReader]::new($g).ReadToEnd() }
function Finish($value) { Write-Output ('CLASSROOM_PACKAGE_PROBE:' + ($value | ConvertTo-Json -Compress)); exit }
function Run([string]$code,[string[]]$argv) { $raw=@(& $python -c $code @argv 2>&1);if($LASTEXITCODE -ne 0 -or $raw.Count -ne 1){throw 'probe'};return ($raw[0] | ConvertFrom-Json -ErrorAction Stop) }
try {
 if (!(Test-Path -LiteralPath $python -PathType Leaf)) { Finish @{status='failed';stage='python'} }
 foreach($path in @('D:\','D:\Anaconda3',$python)){ $item=Get-Item -LiteralPath $path -Force; if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){Finish @{status='failed';stage='python'}} }
 $env:PYTHONDONTWRITEBYTECODE='1';$env:PYTHONNOUSERSITE='1';foreach($v in @('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','PYTHONUSERBASE')){[Environment]::SetEnvironmentVariable($v,$null,'Process')}
 $helper=Decode '__HELPER__'
 $platform=Run -code $helper -argv @('platform','__PACKAGE__');if($platform.status -ne 'supported'){Finish @{status='failed';stage='platform'}}
 $state=Run -code $helper -argv @('state','__PACKAGE__');if($state.status -eq 'failed'){if($state.stage -in @('version','import','probe')){Finish @{status='failed';stage=$state.stage}};Finish @{status='failed';stage='probe'}}
 if($state.status -notin @('ready','missing')){Finish @{status='failed';stage='probe'}}
 $deps=Run -code $helper -argv @('dependencies','__PACKAGE__');if($deps.status -ne 'ready'){Finish @{status='failed';stage='dependencies'}}
 if($state.status -eq 'ready'){Finish @{status='ready';python=$platform.python;version=$state.version}}
 Finish @{status='missing';python=$platform.python}
} catch { Finish @{status='failed';stage='probe'} }
