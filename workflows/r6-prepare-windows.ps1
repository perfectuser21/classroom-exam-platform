# Only the throwaway hosted R6 VM may remove the image-provided Miniconda.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:GITHUB_REPOSITORY -ne 'perfectuser21/classroom-exam-platform' -or $env:GITHUB_REF -ne 'refs/heads/poteto/r6-seat-env') { throw 'Disposable hosted R6 runner required' }
$root = 'C:\Miniconda'
if ($env:CONDA -ne $root) { throw 'Unexpected hosted image CONDA location' }
if (Test-Path -LiteralPath $root) {
    $items = @((Get-Item -LiteralPath $root -Force)) + @(Get-ChildItem -LiteralPath $root -Recurse -Force)
    if (@($items | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count) { throw 'Unsafe image Miniconda path' }
    $uninstallers = @(Get-ChildItem -LiteralPath $root -Filter 'Uninstall-*.exe' -File)
    if ($uninstallers.Count -ne 1) { throw 'Expected one image Miniconda uninstaller' }
    $process = Start-Process -FilePath $uninstallers[0].FullName -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw 'Image Miniconda uninstall failed' }
    if (Test-Path -LiteralPath $root) {
        # NSIS may retain its own executable/empty installation directory.
        $items = @((Get-Item -LiteralPath $root -Force)) + @(Get-ChildItem -LiteralPath $root -Recurse -Force)
        if (@($items | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count) { throw 'Unsafe uninstall remainder' }
        Remove-Item -LiteralPath $root -Recurse -Force
    }
}
if (Test-Path -LiteralPath $root) { throw 'Image Miniconda still present' }
$apps = @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Anaconda|Miniconda' })
if ($apps.Count) { throw 'Existing conda registration remains; product guard must stay active' }
Write-Output 'PASS R6 image preparation: preinstalled C:\Miniconda removed and registration absent; product existing-install guard unchanged'
