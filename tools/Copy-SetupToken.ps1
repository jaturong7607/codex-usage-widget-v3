param([Parameter(Mandatory=$true)][ValidateSet('standard','mascot')][string]$Variant)
$ErrorActionPreference = 'Stop'
$taskSessionHome = Join-Path $env:LOCALAPPDATA ('CodexUsageWidget/oauth-v3-' + $Variant)
$taskAuth = Get-Content -LiteralPath (Join-Path $taskSessionHome 'auth.json') -Raw | ConvertFrom-Json
$taskToken = $taskAuth.tokens.refresh_token
if ([string]::IsNullOrWhiteSpace($taskToken)) { throw 'No refresh token found. Complete the dedicated ChatGPT login first.' }
Set-Clipboard -Value $taskToken
$taskToken = $null
$taskAuth = $null
Write-Output ('Setup token for V3 ' + $Variant + ' copied to Windows clipboard. Use only before the first iPhone setup. Never post it in chat or Git.')
