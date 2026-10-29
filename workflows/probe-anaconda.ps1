$ErrorActionPreference = 'Stop'
try {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'permissions' }
    $target = 'D:\Anaconda3'
    $targetExists = Test-Path -LiteralPath $target
    $apps = @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DisplayName -ErrorAction SilentlyContinue)
    $known = @('C:\ProgramData\anaconda3','C:\Anaconda3','D:\Anaconda','C:\ProgramData\miniconda3','C:\Miniconda3','D:\Miniconda3')
    $users = @(Get-ChildItem -LiteralPath 'C:\Users' -Directory -Force -ErrorAction Stop)
    foreach ($user in $users) { $known += (Join-Path $user.FullName 'anaconda3'); $known += (Join-Path $user.FullName 'miniconda3') }
    $existing = $targetExists -or @($apps | Where-Object { $_ -match 'Anaconda|Miniconda' }).Count -gt 0 -or @($known | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'" -ErrorAction Stop
    $free = if ($disk) { [Int64]$disk.FreeSpace } else { [Int64]0 }
    Write-Output ('CLASSROOM_ANACONDA_PROBE:' + (@{probe='complete';existing=[bool]$existing;targetExists=[bool]$targetExists;dFreeBytes=$free} | ConvertTo-Json -Compress))
} catch { Write-Output 'CLASSROOM_ANACONDA_PROBE:{"probe":"error"}' }
