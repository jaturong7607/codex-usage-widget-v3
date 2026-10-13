param([Parameter(Mandatory=$true)][ValidateSet('standard','mascot')][string]$Variant)
$ErrorActionPreference = 'Stop'
$taskPreviousHome = $env:CODEX_HOME
$taskSessionHome = Join-Path $env:LOCALAPPDATA ('CodexUsageWidget/oauth-v3-' + $Variant)
if (Test-Path -LiteralPath (Join-Path $taskSessionHome 'auth.json')) {
    throw 'This session already exists. Do not sign in over a token chain owned by an installed widget. Use a fresh session directory for a deliberate replacement.'
}
New-Item -ItemType Directory -Path $taskSessionHome -Force | Out-Null
try {
    $env:CODEX_HOME = $taskSessionHome
    $taskCodex = Get-Command codex -ErrorAction Stop
    & $taskCodex.Source -c 'cli_auth_credentials_store="file"' login
    if ($LASTEXITCODE -ne 0) { throw 'Codex login did not complete.' }
    Write-Output ('Dedicated session created for V3 ' + $Variant + '. Copy its refresh token before the first iPhone setup.')
} finally {
    if ($null -eq $taskPreviousHome) { Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue }
    else { $env:CODEX_HOME = $taskPreviousHome }
}
