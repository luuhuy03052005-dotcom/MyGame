# Use robocopy to delete the folder (mirrors an empty folder)
$src = "C:\Users\luuhu\OneDrive\Desktop\Project\empty"
$dest = "C:\Users\luuhu\OneDrive\Desktop\Project\Townscraper\dist"

# Create empty folder if needed
if (-not (Test-Path $src)) {
    New-Item -ItemType Directory -Path $src | Out-Null
}

# Mirror empty to dest (effectively deletes all files)
& robocopy $src $dest /MIR /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1 | Out-Null

# Now remove the folder
Start-Sleep -Milliseconds 500
if (Test-Path $dest) {
    Remove-Item -Path $dest -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path $dest) {
    Write-Host "Failed to remove dist"
    exit 1
} else {
    Write-Host "SUCCESS - dist folder removed"
}
