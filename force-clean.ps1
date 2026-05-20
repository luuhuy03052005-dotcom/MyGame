$file = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist\win-unpacked\resources\app.asar"
if (Test-Path $file) {
    # Take ownership
    & takeown /F $file /A 2>&1 | Out-Null
    & icacls $file /grant Administrators:F 2>&1 | Out-Null
    # Try to delete again
    Start-Sleep -Seconds 1
    Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
    if (Test-Path $file) {
        Write-Host "File still locked - may need system restart or admin intervention"
        exit 1
    }
}
Write-Host "app.asar removed successfully"
