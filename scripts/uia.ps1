# uia.ps1 - UIA helper for the Figma desktop window (webview panels).
# -List          : enumerate named elements with absolute physical rects
# -Name "X"      : click the element center (mouse_event, absolute coords)
# -Name "X" -Keys "{DOWN}" : focus the element, then send keys (webview-safe)
#
# Typical use:
#   uia.ps1 -List
#   uia.ps1 -Name "No scrolling"          # open an Overflow dropdown
#   then click an option row with figma_win.ps1 in the SAME script run if the popup closes across runs
param(
  [string]$Name = "",
  [switch]$List,
  [string]$Keys = "",
  [int]$Wait = 800,
  [switch]$Dump,
  [int]$Index = 0
)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class UA2 {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
}
"@
[UA2]::SetProcessDPIAware() | Out-Null
$pf = Get-Process Figma -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $pf) { Write-Output "NO_FIGMA"; exit 1 }
$h = $pf.MainWindowHandle
$fg = [UA2]::GetForegroundWindow()
$tid = [UA2]::GetCurrentThreadId()
$ftid = [UA2]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
[UA2]::AttachThreadInput($tid, $ftid, $true) | Out-Null
[UA2]::SetForegroundWindow($h) | Out-Null
[UA2]::AttachThreadInput($tid, $ftid, $false) | Out-Null
Start-Sleep -Milliseconds 400
$fig = [System.Windows.Automation.AutomationElement]::FromHandle($h)

function DumpAll([int]$cap = 160) {
  $all = $fig.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $n = 0
  foreach ($e in $all) {
    $nm = $e.Current.Name
    if ($nm -and $nm.Length -gt 0 -and $nm.Length -lt 60) {
      $r = $e.Current.BoundingRectangle
      if ($r.Width -gt 0 -and $r.Height -gt 0) {
        Write-Output ("E '" + $nm + "' @ " + [int]$r.X + "," + [int]$r.Y + " " + [int]$r.Width + "x" + [int]$r.Height)
        $n++
        if ($n -gt $cap) { return }
      }
    }
  }
}

if ($List) { DumpAll; exit 0 }
if ($Name -eq "") { Write-Output "NEED_NAME_OR_LIST"; exit 1 }
$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Name)
$matches = $fig.FindAll([System.Windows.Automation.TreeScope]::Descendants, $c)
if ($matches.Count -eq 0) { Write-Output ("NOT_FOUND " + $Name); exit 1 }
if ($Index -ge $matches.Count) { $Index = 0 }
$e = $matches.Item($Index)
$r = $e.Current.BoundingRectangle
if ($Keys -ne "") {
  $e.SetFocus()
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
  Start-Sleep -Milliseconds $Wait
  Write-Output ("FOCUSED '" + $Name + "' KEYS " + $Keys)
} else {
  $x = [int]($r.X + $r.Width / 2); $y = [int]($r.Y + $r.Height / 2)
  [UA2]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 350
  [UA2]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 70
  [UA2]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
  Write-Output ("CLICKED '" + $Name + "' @ " + $x + "," + $y + " (" + [int]$r.Width + "x" + [int]$r.Height + ")")
}
if ($Dump) { Start-Sleep -Milliseconds 400; DumpAll }
