param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("full", "lite")]
  [string]$Edition
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSCommandPath
$moduleDir = Join-Path $workspace "font-settings"
$propPath = Join-Path $moduleDir "module.prop"

# A UTF-8 BOM in module.prop makes the installer read the module id as
# "<BOM>font-settings": KernelSU then ends up with two module directories whose
# list keys collide (the manager crashes) and customize.sh writes into the BOM
# directory, so uploaded fonts are silently lost. Refuse to ship that.
$propBytes = [System.IO.File]::ReadAllBytes($propPath)
if ($propBytes.Length -ge 3 -and $propBytes[0] -eq 0xEF -and $propBytes[1] -eq 0xBB -and $propBytes[2] -eq 0xBF) {
  throw "module.prop starts with a UTF-8 BOM; rewrite it as UTF-8 without BOM before packaging."
}

$version = ((Get-Content -LiteralPath $propPath | Where-Object { $_ -like "version=v*" }) -replace "^version=", "")
$suffix = if ($Edition -eq "lite") { "_lite" } else { "" }
$archive = Join-Path $workspace ("font-settings_{0}{1}_KSU.zip" -f $version, $suffix)
$staging = Join-Path $env:TEMP ("font-settings-{0}-{1}" -f $version, $Edition)

if (Test-Path -LiteralPath $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}

Copy-Item -LiteralPath $moduleDir -Destination $staging -Recurse
if ($Edition -eq "lite") {
  Remove-Item -LiteralPath (Join-Path $staging "emoji") -Recurse -Force
  $prop = Join-Path $staging "module.prop"
  $content = Get-Content -LiteralPath $prop -Raw
  $content = $content.Replace("name=Font Settings", "name=Font Settings Lite")
  $content = $content.Replace("description=适用于 Android 8.0+ 的通用 KernelSU 字体与 Emoji 管理模块，安装时自动适配系统字体配置。", "description=适用于 Android 8.0+ 的通用 KernelSU 字体管理模块（无内置 Emoji），安装时自动适配系统字体配置。")
  [System.IO.File]::WriteAllText($prop, $content, [System.Text.UTF8Encoding]::new($false))
}

if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}
tar -a -c -f $archive -C $staging *
Remove-Item -LiteralPath $staging -Recurse -Force
Write-Output $archive
