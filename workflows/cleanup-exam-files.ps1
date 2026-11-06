$ErrorActionPreference = 'Stop'
$base = 'E:\ClassroomExam'
# __SNAPSHOT__ is replaced only with a server-generated SHA256 digest and count.
$expectedDigest = '__DIGEST__'
$expectedCount = __COUNT__
$handles = New-Object 'System.Collections.Generic.List[object]'
$streams = New-Object 'System.Collections.Generic.List[object]'
$deleted = 0
$status = 'blocked'
$reason = 'unsafe'
try {
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class ClassroomCleanupHandles {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern SafeFileHandle CreateFile(string p, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
 [DllImport("kernel32.dll", SetLastError=true)]
 public static extern bool GetFileInformationByHandle(SafeFileHandle h, out Info info);
 [StructLayout(LayoutKind.Sequential)] public struct Info {
  public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Created,Accessed,Written;
  public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;
 }
 [DllImport("kernel32.dll", SetLastError=true)]
 public static extern bool SetFileInformationByHandle(SafeFileHandle h, int type, ref int delete, uint size);
 public static void Check(SafeFileHandle h, bool directory) {
  Info i;
  if(h.IsInvalid || !GetFileInformationByHandle(h,out i) || (i.Attributes & 1024)!=0 || ((i.Attributes & 16)!=0)!=directory)
   throw new System.IO.IOException("Unsafe path");
 }
}
'@
 if (!(Get-PSDrive -Name E -ErrorAction SilentlyContinue)) { $reason='no_drive'; throw 'No E drive' }
 $dirs = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
 function Lock-Directory([string]$path) {
  if ($dirs.Add($path)) {
   # No FILE_SHARE_WRITE or FILE_SHARE_DELETE: prevent directory retargeting.
   $h=[ClassroomCleanupHandles]::CreateFile($path,128,1,[IntPtr]::Zero,3,0x02200000,[IntPtr]::Zero)
   $handles.Add($h); [ClassroomCleanupHandles]::Check($h,$true)
  }
 }
 Lock-Directory 'E:\'
 if (!(Test-Path -LiteralPath $base)) {
  if ($expectedCount -ne 0) {$reason='changed';throw 'Snapshot changed'}
  $status='already_clean'
 } else {
  Lock-Directory $base
  $queue=New-Object 'System.Collections.Generic.Queue[object]'
  $queue.Enqueue(@{path=$base;depth=0});$seen=0
  $records=New-Object 'System.Collections.Generic.List[string]'
  while ($queue.Count -gt 0) {
   $entry=$queue.Dequeue()
   foreach ($path in [IO.Directory]::EnumerateFileSystemEntries($entry.path)) {
    $seen++;if($seen -gt 5000){throw 'Too many entries'}
    $item=Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'Link refused'}
    if ($item.PSIsContainer) {
     if($entry.depth -ge 6){throw 'Too deep'}
     Lock-Directory $item.FullName
     $queue.Enqueue(@{path=$item.FullName;depth=($entry.depth+1)});continue
    }
    if ($streams.Count -ge 200) {throw 'Too many files'}
    $relative=$item.FullName.Substring($base.Length+1).Replace('\','/')
    if ($relative.Length -gt 512 -or $relative -match '[\x00-\x1f:]') {throw 'Invalid path'}
    # Read + DELETE, sharing reads only, OPEN_REPARSE_POINT. Hash and delete use
    # the same handle; no path-based recursive deletion or close/delete race.
    $h=[ClassroomCleanupHandles]::CreateFile($item.FullName,2147549184,1,[IntPtr]::Zero,3,0x00200000,[IntPtr]::Zero)
    $handles.Add($h);[ClassroomCleanupHandles]::Check($h,$false)
    $stream=New-Object IO.FileStream($h,[IO.FileAccess]::Read)
    $streams.Add($stream);$hash=[Security.Cryptography.SHA256]::Create()
    try {$digest=([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
    $record=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($relative))+':'+$stream.Length+':'+$digest
    $records.Add($record)
   }
  }
  [string[]]$sorted=$records.ToArray();[Array]::Sort($sorted,[StringComparer]::Ordinal)
  $canonical=if($sorted.Length){[String]::Join("`n",$sorted)+"`n"}else{''}
  $hash=[Security.Cryptography.SHA256]::Create()
  try {$actual=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
  if($records.Count -ne $expectedCount -or $actual -ne $expectedDigest){$reason='changed';throw 'Snapshot changed'}
  foreach($stream in $streams){$disposition=1;if(![ClassroomCleanupHandles]::SetFileInformationByHandle($stream.SafeFileHandle,4,[ref]$disposition,4)){throw 'Delete failed'};$deleted++}
  $status=if($deleted){'cleaned'}else{'already_clean'}
 }
} catch {if($deleted -gt 0){$status='unknown'}} finally {
 foreach($stream in $streams){$stream.Dispose()}
 foreach($handle in $handles){$handle.Dispose()}
}
$result=@{status=$status;deleted=$deleted;reason=$reason}|ConvertTo-Json -Compress
Write-Output ('CLASSROOM_CLEANUP_EXECUTION:'+ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($result)))
