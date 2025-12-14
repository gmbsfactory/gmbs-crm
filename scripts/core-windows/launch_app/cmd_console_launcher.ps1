[string]$ProjectRoot = Resolve-Path "$PSScriptRoot\..\..\.."

function Start-TrackedProcess {
    param(
        [string]$FilePath,
        [string]$Arguments = "",
        [string]$WorkingDirectory = $ProjectRoot,
        [switch]$NoNewWindow
    )

    $processArgs = @{
        FilePath         = $FilePath
        WorkingDirectory = $WorkingDirectory
        PassThru         = $true
    }

    if ($Arguments) {
        $processArgs.ArgumentList = $Arguments
    }

    if ($NoNewWindow) {
        $processArgs.NoNewWindow = $true
    }

    try {
        $process = Start-Process @processArgs
        Write-Host "Started: $FilePath (PID: $($process.Id))" -ForegroundColor Green
        return $process
    }
    catch {
        Write-Host "Failed to start: $FilePath - $_" -ForegroundColor Red
        return $null
    }
}

Start-TrackedProcess -FilePath "cmd.exe" -Arguments "/k" -WorkingDirectory $ProjectRoot
