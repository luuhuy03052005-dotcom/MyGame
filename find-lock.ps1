# Find which process has a handle to app.asar
$asarPath = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist\win-unpacked\resources\app.asar"

# Method 1: Check using WMIC
$wmicOutput = & WMIC path win32_process get processid,commandline 2>&1 | Where-Object { $_ -like '*app.asar*' -or $_ -like '*Townscraper*' }
Write-Host "WMIC matches:"
Write-Host $wmicOutput

# Method 2: List all processes with their paths
Write-Host "`nAll electron/node processes:"
Get-Process | Where-Object { $_.ProcessName -like '*electron*' -or $_.ProcessName -like '*node*' } | Format-Table Id, ProcessName -AutoSize
