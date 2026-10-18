$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$staging = Join-Path $root 'runtime.installing'
$runtime = Join-Path $root 'runtime'
$backup = Join-Path $root 'runtime.previous'
try {
    if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $root 'runtime.zip'), $staging)
    foreach ($file in @('python\python.exe', 'node\node.exe', 'manifest.json')) {
        if (-not (Test-Path (Join-Path $staging $file))) { throw "Runtime archive is missing $file" }
    }
    if (Test-Path $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
    if (Test-Path $runtime) { Move-Item -LiteralPath $runtime -Destination $backup }
    try { Move-Item -LiteralPath $staging -Destination $runtime }
    catch {
        if (Test-Path $backup) { Move-Item -LiteralPath $backup -Destination $runtime }
        throw
    }
    if (Test-Path $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
    Remove-Item -LiteralPath (Join-Path $root 'runtime.zip') -Force
    exit 0
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
