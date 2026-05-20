$asar = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist\win-unpacked\resources\app.asar"
$tempName = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist\win-unpacked\resources\app_old.asar"

if (Test-Path $asar) {
    try {
        Move-Item -Path $asar -Destination $tempName -Force -ErrorAction Stop
        Write-Host "Renamed app.asar to app_old.asar"
    } catch {
        Write-Host "Cannot rename - file is locked by another process"
        exit 1
    }
}

# Now try to remove the old file
Start-Sleep -Seconds 2
if (Test-Path $tempName) {
    try {
        Remove-Item -Path $tempName -Force -ErrorAction Stop
        Write-Host "Removed app_old.asar"
    } catch {
        Write-Host "Renamed but cannot remove old file - this is OK for build"
    }
}

if (Test-Path $asar) {
    Write-Host "Original file still exists"
    exit 1
} else {
    Write-Host "Success - app.asar has been removed"
}
