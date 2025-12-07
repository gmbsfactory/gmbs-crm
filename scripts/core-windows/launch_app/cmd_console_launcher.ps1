function Start-TrackedProcess {
    param(
        [string]$FilePath,
        [string]$Arguments = "",
        [string]$WorkingDirectory = $ProjectRoot,
        [switch]$NoNewWindow
    )
    
    $processArgs = @{
        FilePath = $FilePath
        WorkingDirectory = $WorkingDirectory
        PassThru = $true
    }
    
    if ($Arguments) {
        $processArgs.ArgumentList = $Arguments
    }
    
    if ($NoNewWindow) {
        $processArgs.NoNewWindow = $true
    }
    
    try {
        $process = Start-Process @processArgs
        $script:LaunchedProcesses += $process.Id
        $processName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
        $script:MainProcessNames += $processName
        Write-Host "Started: $FilePath (PID: $process.Id)" -ForegroundColor Green
        return $process
    }
    catch {
        Write-Host "Failed to start: $FilePath - $_" -ForegroundColor Red
        return $null
    }
}

 [string]$ProjectRoot = $PSScriptRoot + "\..\.."
$cmdArgs = "/k cd /d `"$ProjectRoot`" && `"$launchCmdPath`""
Start-TrackedProcess -FilePath "cmd.exe" -Arguments $cmdArgs -WorkingDirectory $ProjectRoot