$ErrorActionPreference = 'Stop'
$target = 'D:\Anaconda3'
function Finish($value) { Write-Output ('CLASSROOM_ANACONDA_EXISTING:' + ($value | ConvertTo-Json -Compress)); exit }
try {
    foreach ($path in @('D:\', $target, (Join-Path $target 'condabin'), (Join-Path $target 'Scripts'))) {
        $item = Get-Item -LiteralPath $path -Force -ErrorAction Stop
        if (!$item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { Finish @{status='blocked';reason='target'} }
    }
    foreach ($path in @((Join-Path $target 'python.exe'), (Join-Path $target 'condabin\conda.bat'), (Join-Path $target 'Scripts\jupyter-notebook.exe'), (Join-Path $target 'Scripts\spyder.exe'))) {
        $item = Get-Item -LiteralPath $path -Force -ErrorAction Stop
        if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { Finish @{status='blocked';reason='target'} }
    }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo.FileName = Join-Path $target 'python.exe'
    $process.StartInfo.Arguments = '-c "import importlib.metadata as m; import notebook, spyder; print(m.version(''conda''))"'
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.EnvironmentVariables['PYTHONDONTWRITEBYTECODE'] = '1'
    $process.StartInfo.EnvironmentVariables['PYTHONNOUSERSITE'] = '1'
    foreach ($variable in @('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','PYTHONUSERBASE')) { $process.StartInfo.EnvironmentVariables.Remove($variable) }
    if (!$process.Start()) { Finish @{status='blocked';reason='verify'} }
    if (!$process.WaitForExit(120000)) { $process.Kill(); Finish @{status='blocked';reason='verify'} }
    $version = $process.StandardOutput.ReadToEnd().Trim()
    if ($process.ExitCode -ne 0 -or $version -notmatch '^\d+(\.\d+){1,3}$') { Finish @{status='blocked';reason='verify'} }
    Finish @{status='ready';version=$version;python=$true;jupyter=$true;spyder=$true}
} catch { Finish @{status='blocked';reason='target'} }
