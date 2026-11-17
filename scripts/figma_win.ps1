# figma_win.ps1 - DPI-aware driver for the Figma desktop window (Windows).
# Foregrounds Figma, then runs clicks / hover / keys / wheel / screenshot in window-relative coords.
# Screenshot pixels == window-relative coordinates (do NOT subtract the window origin again).
#
# Usage:
#   figma_win.ps1 -Action shot -Out shot.png
#   figma_win.ps1 -Clicks "60,106,900;130,578,1000" -Out menu.png
#   figma_win.ps1 -Hover "480,621" -Out hover.png
#   figma_win.ps1 -Action keys -Keys "{ENTER}" -Out after.png
#   figma_win.ps1 -Action wheel -Wheel "1120,640,-600,4" -Out scrolled.png
#
# Notes:
# - Menus / native dialogs accept synthetic clicks; webview content and the prototype player may not.
# - Popup lists close when the window is re-foregrounded by a NEW script run: open + select in one run.
param(
  [string]$Action = "shot",
  [string]$Clicks = "",
  [string]$Hover = "",
  [string]$Keys = "",
  [string]$Wheel = "",
  [string]$Out = "shot.png",
  [string]$OutDir = "shots",
  [int]$Wait = 1200,
  [switch]$Max
)
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FW {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
"@
[FW]::SetProcessDPIAware() | Out-Null
$pf = Get-Process Figma -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $pf) { Write-Output "NO_FIGMA"; exit 1 }
$h = $pf.MainWindowHandle

function Fg() {
  $fg = [FW]::GetForegroundWindow()
  $tid = [FW]::GetCurrentThreadId()
  $ftid = [FW]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
  [FW]::AttachThreadInput($tid, $ftid, $true) | Out-Null
  [FW]::SetForegroundWindow($h) | Out-Null
  [FW]::AttachThreadInput($tid, $ftid, $false) | Out-Null
  # topmost round-trip forces a real z-order raise even with the foreground lock on
  [FW]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 0x0003) | Out-Null
  Start-Sleep -Milliseconds 120
  [FW]::SetWindowPos($h, [IntPtr](-2), 0, 0, 0, 0, 0x0003) | Out-Null
  [FW]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 500
}
function Rect() { $r = New-Object FW+RECT; [FW]::GetWindowRect($h, [ref]$r) | Out-Null; return $r }
function Clk([int]$x, [int]$y, $r, [int]$hold = 1000) {
  [FW]::SetCursorPos($r.L + $x, $r.T + $y) | Out-Null
  Start-Sleep -Milliseconds 380
  [FW]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [FW]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds $hold
}

if ([FW]::IsIconic($h)) { [FW]::ShowWindow($h, 9) | Out-Null; Start-Sleep -Milliseconds 600 }
if ($Max) { [FW]::ShowWindow($h, 3) | Out-Null; Start-Sleep -Milliseconds 1000 }
Fg
$r = Rect
$w = $r.R - $r.L; $hh = $r.B - $r.T
Write-Output ("WIN " + $r.L + "," + $r.T + " " + $w + "x" + $hh)

if ($Clicks -ne "") {
  foreach ($pair in $Clicks.Split(';')) {
    if ($pair.Trim() -eq '') { continue }
    $p = $pair.Split(',')
    $hold = 1000
    if ($p.Length -gt 2) { $hold = [int]$p[2] }
    Clk ([int]$p[0]) ([int]$p[1]) $r $hold
    Write-Output ("CLICK " + $p[0] + "," + $p[1])
  }
}
if ($Hover -ne "") {
  $p = $Hover.Split(',')
  [FW]::SetCursorPos($r.L + [int]$p[0], $r.T + [int]$p[1]) | Out-Null
  Start-Sleep -Milliseconds 1100
  Write-Output ("HOVER " + $Hover)
}
if ($Wheel -ne "") {
  # "x,y,delta,times" - delta negative = scroll down; delivered via PostMessage (webview-safe)
  $p = $Wheel.Split(',')
  $ax = $r.L + [int]$p[0]; $ay = $r.T + [int]$p[1]
  $delta = [int]$p[2]; $times = [int]$p[3]
  [FW]::SetCursorPos($ax, $ay) | Out-Null
  Start-Sleep -Milliseconds 300
  $pt = New-Object FW+POINT; $pt.X = $ax; $pt.Y = $ay
  $target = [FW]::WindowFromPoint($pt)
  $lparam = [IntPtr](($ay -shl 16) -bor ($ax -band 0xFFFF))
  for ($i = 0; $i -lt $times; $i++) {
    $wp = [IntPtr](([int]$delta -shl 16) -band 0xFFFFFFFF)
    [FW]::PostMessage($target, 0x020A, $wp, $lparam) | Out-Null
    Start-Sleep -Milliseconds 300
  }
  Start-Sleep -Milliseconds 1000
  Write-Output ("WHEEL " + $Wheel + " target=" + $target)
}
if ($Action -eq "keys" -and $Keys -ne "") {
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
  Start-Sleep -Milliseconds $Wait
}
if ($Action -eq "shot" -or $Action -eq "keys" -or $Action -eq "wheel") {
  if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
  $dir = (Resolve-Path -LiteralPath $OutDir).Path
  $bmp = New-Object System.Drawing.Bitmap $w, $hh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
  $bmp.Save((Join-Path $dir $Out), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output ("SHOT " + $Out + " " + $w + "x" + $hh)
}
Write-Output "DONE"
