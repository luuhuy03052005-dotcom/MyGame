# Stop Windows Search to release file locks
Stop-Service -Name WSearch -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Try to remove the dist folder
$distPath = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist"
$asarPath = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist\win-unpacked\resources\app.asar"

if (Test-Path $asarPath) {
    # Try to delete the asar file first
    try {
        [System.IO.File]::Delete($asarPath)
        Write-Host "Deleted app.asar using .NET"
    } catch {
        Write-Host "Could not delete app.asar: $_"
    }
}

# Try removing entire dist
if (Test-Path $distPath) {
    try {
        Remove-Item -Path $distPath -Recurse -Force -ErrorAction Stop
        Write-Host "Removed dist folder"
    } catch {
        Write-Host "Could not remove dist: $_"
    }
}

# Verify
if (Test-Path $distPath) {
    Write-Host "Dist folder still exists"
} else {
    Write-Host "SUCCESS - Dist folder removed"
}
