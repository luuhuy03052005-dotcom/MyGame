# Pause OneDrive sync
$onedrivePath = "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
if (Test-Path $onedrivePath) {
    Write-Host "Pausing OneDrive..."
    Start-Process $onedrivePath -ArgumentList "/shutdown" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Now try to delete
Start-Sleep -Seconds 2
$distPath = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist"
if (Test-Path $distPath) {
    try {
        Remove-Item -Path $distPath -Recurse -Force -ErrorAction Stop
        Write-Host "SUCCESS - dist folder removed"
    } catch {
        Write-Host "Still failed: $_"
    }
} else {
    Write-Host "SUCCESS - dist folder already removed"
}
