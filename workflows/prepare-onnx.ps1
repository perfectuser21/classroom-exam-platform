$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$python = 'D:\Anaconda3\python.exe'
$checkEncoded = '__CLASSROOM_ENV_CHECK__'
$checkStream = [IO.MemoryStream]::new([Convert]::FromBase64String($checkEncoded))
$checkGzip = [IO.Compression.GZipStream]::new($checkStream,[IO.Compression.CompressionMode]::Decompress)
$checkCode = [IO.StreamReader]::new($checkGzip).ReadToEnd()
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONNOUSERSITE = '1'
foreach ($variable in @('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','PYTHONUSERBASE')) { [Environment]::SetEnvironmentVariable($variable, $null, 'Process') }
function Result([string]$status, [string]$stage, [string]$version) {
  $result = @{status=$status}
  if ($stage) { $result.stage=$stage }
  if ($version) { $result.version=$version }
  Write-Output ('CLASSROOM_RESULT:' + ($result | ConvertTo-Json -Compress))
}
function Inspect([string]$mode) {
  $raw = @(& $python -c $checkCode $mode 'onnx' 2>&1)
  if ($LASTEXITCODE -ne 0 -or $raw.Count -ne 1) { throw 'probe' }
  return ($raw[0] | ConvertFrom-Json -ErrorAction Stop)
}
try {
  if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { Result 'failed' 'python' ''; exit 0 }
  foreach ($path in @('D:\','D:\Anaconda3',$python)) { $item=Get-Item -LiteralPath $path -Force; if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Result 'failed' 'python' ''; exit 0 } }
  $state = Inspect 'state'
  if ($state.status -eq 'failed') { if ($state.stage -in @('version','import','probe')) { Result 'failed' $state.stage '' } else { Result 'failed' 'probe' '' }; exit 0 }
  if ($state.status -notin @('ready','missing')) { Result 'failed' 'probe' ''; exit 0 }
  $deps = Inspect 'dependencies'
  if ($deps.status -ne 'ready') { Result 'failed' 'dependencies' ''; exit 0 }
  if ($state.status -eq 'ready') { Result 'already_ready' '' $state.version; exit 0 }
  & $python -m pip --isolated install --index-url 'https://pypi.org/simple' --disable-pip-version-check --no-input --no-deps --only-binary=:all: 'onnx==1.22.0' 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Result 'failed' 'pip' ''; exit 0 }
  $verified = Inspect 'state'
  if ($verified.status -ne 'ready') { if ($verified.stage -in @('version','import')) { Result 'failed' $verified.stage '' } else { Result 'failed' 'import' '' }; exit 0 }
  Result 'installed' '' $verified.version
} catch { Result 'failed' 'probe' '' }
