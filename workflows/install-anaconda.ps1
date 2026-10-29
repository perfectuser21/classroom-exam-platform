$ErrorActionPreference = 'Stop'
$target = 'D:\Anaconda3'
$installer = 'D:\ClassroomExam\Installers\Anaconda3-2025.12-2-Windows-x86_64.exe'
$expectedHash = '2e0b8e40ec7600793f116250f5c1775c866833bac32d184ad575ecc0d360a88f'
function Finish($value) { Write-Output ('CLASSROOM_ANACONDA:' + ($value | ConvertTo-Json -Compress)); exit }
function InspectTarget {
    $root = Get-Item -LiteralPath $target -Force -ErrorAction Stop
    if (($root.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }
    $python = Join-Path $target 'python.exe'
    $conda = Join-Path $target 'condabin\conda.bat'
    $jupyter = Join-Path $target 'Scripts\jupyter-notebook.exe'
    $spyder = Join-Path $target 'Scripts\spyder.exe'
    if (!(Test-Path -LiteralPath $python -PathType Leaf) -or !(Test-Path -LiteralPath $conda -PathType Leaf) -or !(Test-Path -LiteralPath $jupyter -PathType Leaf) -or !(Test-Path -LiteralPath $spyder -PathType Leaf)) { return $null }
    $check = New-Object System.Diagnostics.Process
    $check.StartInfo.FileName = $python
    $check.StartInfo.Arguments = '-c "import importlib.metadata as m; import notebook, spyder; print(m.version(''conda''))"'
    $check.StartInfo.UseShellExecute = $false
    $check.StartInfo.CreateNoWindow = $true
    $check.StartInfo.RedirectStandardOutput = $true
    $check.StartInfo.RedirectStandardError = $true
    if (!$check.Start()) { return $null }
    if (!$check.WaitForExit(120000)) { $check.Kill(); return $null }
    $output = $check.StandardOutput.ReadToEnd().Trim()
    if ($check.ExitCode -ne 0 -or $output -notmatch '^\d+(\.\d+){1,3}$') { return $null }
    return $output
}
try {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Finish @{status='blocked';reason='permissions'} }
    if (Test-Path -LiteralPath $target) {
        $version = InspectTarget
        if (!$version) { Finish @{status='blocked';reason='target'} }
        Finish @{status='already_ready';version=$version;python=$true;jupyter=$true;spyder=$true}
    }
    $apps = @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DisplayName -ErrorAction SilentlyContinue)
    $known = @('C:\ProgramData\anaconda3','C:\Anaconda3','D:\Anaconda','C:\ProgramData\miniconda3','C:\Miniconda3','D:\Miniconda3')
    $users = @(Get-ChildItem -LiteralPath 'C:\Users' -Directory -Force -ErrorAction SilentlyContinue)
    foreach ($user in $users) { $known += (Join-Path $user.FullName 'anaconda3'); $known += (Join-Path $user.FullName 'miniconda3') }
    if (@($apps | Where-Object { $_ -match 'Anaconda|Miniconda' }).Count -gt 0 -or @($known | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0) { Finish @{status='blocked';reason='existing'} }
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'" -ErrorAction Stop
    if (!$disk -or [Int64]$disk.FreeSpace -lt 15GB) { Finish @{status='blocked';reason='space'} }
    foreach ($path in @('D:\ClassroomExam','D:\ClassroomExam\Installers',(Split-Path -Parent $installer),$installer)) {
        $item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        if (!$item -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { Finish @{status='blocked';reason='installer'} }
    }
    if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { Finish @{status='blocked';reason='installer'} }
    if (Test-Path -LiteralPath $target) { Finish @{status='blocked';reason='target'} }
    $process = Start-Process -FilePath $installer -ArgumentList @('/InstallationType=AllUsers','/AddToPath=0','/RegisterPython=0','/S','/D=D:\Anaconda3') -PassThru
    if (!$process.WaitForExit(1800000)) { Finish @{status='unknown'} }
    if ($process.ExitCode -ne 0) { Finish @{status='failed';stage='installer'} }
    $version = InspectTarget
    if (!$version) { Finish @{status='failed';stage='verify'} }
    Finish @{status='installed';version=$version;python=$true;jupyter=$true;spyder=$true}
} catch { Finish @{status='unknown'} }
