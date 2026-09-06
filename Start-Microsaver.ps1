$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $nodePath = $bundledNode }
    else { throw 'Node.js 22+ is required. Install Node.js LTS, then rerun this script.' }
} else { $nodePath = $nodeCommand.Source }
$listener = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($listener) { throw 'Port 8765 is already in use. Stop the existing Microsaver server with Ctrl+C before starting with keys.' }
. (Join-Path $PSScriptRoot 'Microsaver-Vault.ps1')
$vaultStatus = Get-MicrosaverVaultStatus
if (-not ($vaultStatus.ETORO_API_KEY -and $vaultStatus.ETORO_USER_KEY -and $vaultStatus.OPENAI_API_KEY)) {
    throw 'Microsaver credentials are not in Windows Credential Manager. Run Microsaver-Vault.ps1 -Action setup first.'
}
Write-Host 'Microsaver: REAL account reads only. Credentials loaded from Windows Credential Manager. All trading is disabled.'
try {
    $env:ETORO_ENV = 'real'
    $env:ETORO_API_KEY = Get-MicrosaverVaultSecret 'ETORO_API_KEY'
    $env:ETORO_USER_KEY = Get-MicrosaverVaultSecret 'ETORO_USER_KEY'
    $env:OPENAI_API_KEY = Get-MicrosaverVaultSecret 'OPENAI_API_KEY'
    & $nodePath (Join-Path $PSScriptRoot 'server.mjs')
} finally {
    Remove-Item Env:ETORO_API_KEY,Env:ETORO_USER_KEY,Env:OPENAI_API_KEY,Env:ETORO_ENV -ErrorAction SilentlyContinue
}
