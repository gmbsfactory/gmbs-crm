# PowerShell script to start all development tools (PARALLEL VERSION)
# This script launches Docker, CMD, Git Bash, Cursor, and VSCode in parallel where possible
# When you close this PowerShell window, all launched processes will be terminated
# Compatible with PowerShell 5.1+

param(
    [string]$ProjectRoot = $PSScriptRoot + "\..\.."
)

# Store process IDs for cleanup
$script:LaunchedProcesses = @()
$script:MainProcessNames = @()  # Track main process names for better cleanup

# Function to launch a process and track its PID
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

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
}

# Function to start Docker Desktop
function Start-DockerDesktop {
    Write-Host "Checking Docker status..." -ForegroundColor Yellow
    
    if (Test-DockerRunning) {
        Write-Host "Docker is already running" -ForegroundColor Green
        return
    }
    
    Write-Host "Docker is not running. Starting Docker Desktop..." -ForegroundColor Yellow
    
    # Common Docker Desktop installation paths
    $dockerPaths = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )
    
    $dockerFound = $false
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Start-TrackedProcess -FilePath $path
            $dockerFound = $true
            Write-Host "Docker Desktop started. Waiting for Docker to be ready..." -ForegroundColor Yellow
            
            # Wait for Docker to be ready (max 60 seconds)
            $timeout = 60
            $elapsed = 0
            while ($elapsed -lt $timeout) {
                Start-Sleep -Seconds 2
                $elapsed += 2
                if (Test-DockerRunning) {
                    Write-Host "Docker is now ready!" -ForegroundColor Green
                    return
                }
                Write-Host "." -NoNewline -ForegroundColor Yellow
            }
            Write-Host ""
            Write-Host "Docker Desktop started but may still be initializing..." -ForegroundColor Yellow
            return
        }
    }
    
    if (-not $dockerFound) {
        Write-Host "Docker Desktop not found in common locations. Please start it manually." -ForegroundColor Red
    }
}

# Function to kill process tree recursively
function Stop-ProcessTree {
    param([int]$ProcessId)
    
    try {
        # Get all child processes
        $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
        foreach ($child in $children) {
            Stop-ProcessTree -ProcessId $child.ProcessId
        }
        
        # Kill the process itself
        $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    catch {
        # Process may have already terminated
    }
}

# Cleanup function to terminate all launched processes
function Stop-AllLaunchedProcesses {
    Write-Host "`nCleaning up launched processes..." -ForegroundColor Yellow
    
    foreach ($pid in $script:LaunchedProcesses) {
        try {
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                $processName = $process.ProcessName.ToLower()
                
                # Don't kill Docker Desktop (it's a system service)
                if ($processName -match "docker") {
                    Write-Host "Keeping Docker Desktop running: $($process.ProcessName) (PID: $pid)" -ForegroundColor Cyan
                    continue
                }
                
                Write-Host "Terminating process tree: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                Stop-ProcessTree -ProcessId $pid
            }
        }
        catch {
            # Process may have already terminated
        }
    }
    
    # Additional cleanup: kill any remaining terminal windows (CMD, bash) that might have been spawned
    # This is a safety net for terminals that might not have been tracked properly
    try {
        Get-Process -Name "cmd", "bash", "sh" -ErrorAction SilentlyContinue | Where-Object { 
            $_.MainWindowTitle -ne "" 
        } | ForEach-Object {
            Write-Host "Terminating remaining terminal: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Yellow
            Stop-ProcessTree -ProcessId $_.Id
        }
    }
    catch { }
    
    Write-Host "Cleanup complete!" -ForegroundColor Green
}

# Register cleanup on script exit
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Stop-AllLaunchedProcesses
}

# Also set up cleanup for Ctrl+C
$Host.UI.RawUI.WindowTitle = "Project Startup (Parallel) - Close this window to stop all launched processes"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Project Startup Script (PARALLEL)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# Ensure we're using the correct project root (resolve to absolute path)
$ProjectRoot = Resolve-Path $ProjectRoot -ErrorAction SilentlyContinue
if (-not $ProjectRoot) {
    Write-Host "Error: Could not resolve project root path" -ForegroundColor Red
    exit 1
}

# 1. Start Docker (must be sequential - other processes depend on it)
Start-DockerDesktop

# 1.5. Run fresh_start_db.ps1 in background using Start-Process
# This runs in a separate PowerShell window so it doesn't block
$freshStartDbPath = Join-Path $PSScriptRoot "fresh_start_db.ps1"
if (Test-Path $freshStartDbPath) {
    Write-Host "`nInitializing Supabase database in background..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$freshStartDbPath`"" -WindowStyle Normal
}
else {
    Write-Host "Warning: fresh_start_db.ps1 not found at $freshStartDbPath" -ForegroundColor Yellow
}

# 2-5. Launch all other processes in parallel (no sleeps between them)
# Start-Process is already asynchronous, so we can launch them all at once
Write-Host "`nLaunching all development tools in parallel..." -ForegroundColor Yellow

# 2. Launch CMD window
Write-Host "Launching CMD window..." -ForegroundColor Yellow
Start-TrackedProcess -FilePath "cmd.exe" -Arguments "/k" -WorkingDirectory $ProjectRoot

# 3. Launch Git Bash terminal at project root
Write-Host "Launching Git Bash..." -ForegroundColor Yellow
$gitBashPaths = @(
    "${env:ProgramFiles}\Git\bin\git-bash.exe",
    "${env:ProgramFiles}\Git\bin\bash.exe",
    "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)

$gitBashFound = $false
foreach ($path in $gitBashPaths) {
    if (Test-Path $path) {
        Start-TrackedProcess -FilePath $path -WorkingDirectory $ProjectRoot
        $gitBashFound = $true
        break
    }
}

if (-not $gitBashFound) {
    Write-Host "Warning: Git Bash not found in common locations" -ForegroundColor Yellow
}

# 4. Launch Cursor at project root
Write-Host "Launching Cursor..." -ForegroundColor Yellow
$cursorPaths = @(
    "C:\Program Files\cursor\Cursor.exe",
    "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe",
    "${env:ProgramFiles}\Cursor\Cursor.exe",
    "${env:ProgramFiles(x86)}\Cursor\Cursor.exe"
)

$cursorFound = $false
foreach ($path in $cursorPaths) {
    if (Test-Path $path) {
        Start-TrackedProcess -FilePath $path -Arguments "`"$ProjectRoot`""
        $cursorFound = $true
        break
    }
}

if (-not $cursorFound) {
    Write-Host "Warning: Cursor not found in common locations" -ForegroundColor Yellow
}

# 5. Launch VSCode at project root
Write-Host "Launching VSCode..." -ForegroundColor Yellow
$codePaths = @(
    "C:\Users\bigp_\AppData\Local\Programs\MicrosoftVSCode\Code.exe",
    "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe",
    "$env:LOCALAPPDATA\Programs\MicrosoftVSCode\Code.exe",
    "${env:ProgramFiles}\Microsoft VS Code\Code.exe",
    "${env:ProgramFiles(x86)}\Microsoft VS Code\Code.exe"
)

$codeFound = $false
foreach ($path in $codePaths) {
    if (Test-Path $path) {
        Start-TrackedProcess -FilePath $path -Arguments "`"$ProjectRoot`""
        $codeFound = $true
        break
    }
}

if (-not $codeFound) {
    Write-Host "Warning: VSCode not found in common locations" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  All processes launched!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Launched $($script:LaunchedProcesses.Count) processes" -ForegroundColor Gray
Write-Host "`nClose this window to terminate all launched processes" -ForegroundColor Yellow
Write-Host "(Note: Docker Desktop will remain running)" -ForegroundColor Gray
Write-Host ""

# Keep the script running so cleanup can work
# Wait for user to close the window
try {
    while ($true) {
        Start-Sleep -Seconds 1
        # Check if any tracked processes have exited (optional monitoring)
    }
}
catch {
    # Window was closed
}
finally {
    Stop-AllLaunchedProcesses
}

