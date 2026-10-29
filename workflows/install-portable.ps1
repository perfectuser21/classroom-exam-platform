$ErrorActionPreference = 'Stop'
function Finish($value) { Write-Output ('CLASSROOM_PORTABLE:' + ($value | ConvertTo-Json -Compress)); exit }
try {
    $config = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__CLASSROOM_CONFIG_B64__')) | ConvertFrom-Json
    $target = [string]$config.target
    $jobDir = [string]$config.jobDir
    $archivePath = Join-Path $jobDir ([string]$config.filename)
    if (Test-Path -LiteralPath $target) { Finish @{status='blocked';reason='target'} }
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'" -ErrorAction Stop
    if (!$disk -or [Int64]$disk.FreeSpace -lt 1GB) { Finish @{status='blocked';reason='space'} }
    foreach ($path in @('D:\ClassroomExam','D:\ClassroomExam\Installers',$jobDir,$archivePath)) {
        $item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        if (!$item -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { Finish @{status='blocked';reason='installer'} }
    }
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $config.sha256) { Finish @{status='blocked';reason='installer'} }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
    $unpacked = Join-Path $jobDir 'unpacked'
    New-Item -ItemType Directory -Path $unpacked -ErrorAction Stop | Out-Null
    try {
        if ($archive.Entries.Count -ne $config.files.Count) { throw 'Unexpected archive entries' }
        foreach ($expected in $config.files) {
            $entries = @($archive.Entries | Where-Object { $_.FullName -ceq $expected.name })
            if ($entries.Count -ne 1 -or $entries[0].Length -ne [Int64]$expected.size -or $expected.name -match '[\\/:]') { throw 'Unexpected archive entry' }
            $path = Join-Path $unpacked $expected.name
            $source = $entries[0].Open(); $destination = [IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
            try { $source.CopyTo($destination) } finally { $destination.Dispose(); $source.Dispose() }
            if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { throw 'File verification failed' }
        }
    } finally { $archive.Dispose() }
    if (Test-Path -LiteralPath $target) { Finish @{status='blocked';reason='target'} }
    [IO.Directory]::Move($unpacked,$target)
    foreach ($expected in $config.files) {
        $path = Join-Path $target $expected.name
        if (!(Test-Path -LiteralPath $path -PathType Leaf) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { Finish @{status='unknown'} }
    }
    Finish @{status='deployed';version=$config.version;filesVerified=$true}
} catch { Finish @{status='unknown'} }
