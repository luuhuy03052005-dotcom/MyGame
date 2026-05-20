# Kill all electron processes
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Remove the entire dist folder
$distPath = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist"
if (Test-Path $distPath) {
    Remove-Item -Path $distPath -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    if (Test-Path $distPath) {
        Write-Host "Failed to remove dist folder"
        exit 1
    }
}

Write-Host "Dist folder cleaned successfully"
