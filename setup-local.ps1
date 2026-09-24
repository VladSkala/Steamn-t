$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (Test-Path -LiteralPath '.env') {
    Write-Host 'Using existing .env; no values changed.'
    exit 0
}

function New-LocalSecret([int]$Bytes) {
    $buffer = [byte[]]::new($Bytes)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($buffer) }
    finally { $random.Dispose() }
    return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$settings = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot '.env.example'))
$settings = $settings.Replace('replace-with-a-local-development-secret', (New-LocalSecret 48))
$settings = $settings.Replace('replace-with-a-local-development-password', (New-LocalSecret 32))
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env'), $settings)
Write-Host 'Created .env with local credentials. Frontend: http://localhost:5180'
