# install_font.ps1 - install fonts for the current user and broadcast WM_FONTCHANGE.
# No admin rights required. ASCII-only on purpose (PowerShell 5 reads ANSI without BOM).
#
# Usage:
#   powershell -NoProfile -File install_font.ps1 -Src .\instances -Prefix "MP"
#   powershell -NoProfile -File install_font.ps1 -Uninstall -Prefix "MP"
param(
  [string]$Src = ".",
  [string]$Prefix = "MP",
  [switch]$Uninstall
)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FI {
  [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern int AddFontResourceW(string path);
  [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] public static extern bool RemoveFontResourceW(string path);
  [DllImport("user32.dll")] public static extern int SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
}
"@
$dst = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
$reg = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts'
$p = $Prefix.Trim()
if ($p -eq "") { $p = "MP" }
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force -Path $dst | Out-Null }
$res = [IntPtr]::Zero
function Broadcast {
  [FI]::SendMessageTimeout([IntPtr]0xffff, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 0x0002, 1000, [ref]$res) | Out-Null
}
if ($Uninstall) {
  $files = Get-ChildItem $dst -File | Where-Object { $_.Name -like ($p + "_*") }
  foreach ($f in $files) {
    [FI]::RemoveFontResourceW($f.FullName) | Out-Null
    Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue
  }
  $props = (Get-ItemProperty $reg)
  foreach ($prop in $props.PSObject.Properties) {
    if ($prop.Name -like ($p + " *") -and $prop.Name -notlike "PS*") {
      Remove-ItemProperty -Path $reg -Name $prop.Name -ErrorAction SilentlyContinue
    }
  }
  Broadcast
  Write-Output ("UNINSTALLED " + $files.Count)
  exit 0
}
$fonts = Get-ChildItem $Src -File | Where-Object { $_.Extension -in ".ttf", ".otf" }
if (-not $fonts) { Write-Output ("NO_FONTS in " + $Src); exit 1 }
$n = 0
foreach ($f in $fonts) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
  $ext = $f.Extension.ToLower()
  $target = Join-Path $dst ($p + "_" + $base + $ext)
  Copy-Item $f.FullName $target -Force
  $label = $p + " " + $base + " (TrueType)"
  New-ItemProperty -Path $reg -Name $label -Value ($p + "_" + $base + $ext) -PropertyType String -Force | Out-Null
  $r = [FI]::AddFontResourceW($target)
  Write-Output ("INSTALLED " + $target + " addres=" + $r)
  $n++
}
Broadcast
Write-Output ("TOTAL " + $n)
