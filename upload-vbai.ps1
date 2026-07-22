# ==============================================================================
# Script nen va tai cac folder can thiet nhat cua VBAI len VPS qua SSH/SCP
# ==============================================================================

$VPS_IP = "202.92.7.138"
$VPS_PORT = "24700"
$VPS_USER = "root"
$REMOTE_DIR = "/var/www/vbai"
$ZIP_FILE = "vbai_deploy.zip"
$TEMP_DIR = "temp_deploy"

Write-Host "=== 1. Dang chuan bi va loc thu muc can thiet (proxy, webapp, bosung) ===" -ForegroundColor Cyan

# Xoa tep cu neu co
if (Test-Path $TEMP_DIR) { Remove-Item -Recurse -Force $TEMP_DIR }
if (Test-Path $ZIP_FILE) { Remove-Item -Force $ZIP_FILE }

# Tao thu muc tam
New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null

# 1. Copy file deploy-vps.sh
if (Test-Path "deploy-vps.sh") {
    Copy-Item "deploy-vps.sh" -Destination (Join-Path $TEMP_DIR "deploy-vps.sh")
}

# 2. Copy folder proxy (bo qua node_modules)
if (Test-Path "proxy") {
    New-Item -ItemType Directory -Force -Path (Join-Path $TEMP_DIR "proxy") | Out-Null
    Get-ChildItem -Path "proxy" -Recurse | Where-Object {
        $_.FullName -notmatch '\\node_modules\\'
    } | ForEach-Object {
        $rel = $_.FullName.Substring((Get-Item "proxy").FullName.Length + 1)
        $target = Join-Path (Join-Path $TEMP_DIR "proxy") $rel
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Force -Path $target | Out-Null
        } else {
            $parent = Split-Path $target
            if (!(Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
            Copy-Item $_.FullName -Destination $target -Force
        }
    }
}

# 3. Copy folder webapp (bo qua node_modules, dist)
if (Test-Path "webapp") {
    New-Item -ItemType Directory -Force -Path (Join-Path $TEMP_DIR "webapp") | Out-Null
    Get-ChildItem -Path "webapp" -Recurse | Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\dist\\'
    } | ForEach-Object {
        $rel = $_.FullName.Substring((Get-Item "webapp").FullName.Length + 1)
        $target = Join-Path (Join-Path $TEMP_DIR "webapp") $rel
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory -Force -Path $target | Out-Null
        } else {
            $parent = Split-Path $target
            if (!(Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
            Copy-Item $_.FullName -Destination $target -Force
        }
    }
}

# 4. Copy folder bosung
if (Test-Path "bosung") {
    Copy-Item -Path "bosung" -Destination $TEMP_DIR -Recurse -Force
}

Write-Host "=== 2. Dang dong goi file zip ===" -ForegroundColor Cyan
Compress-Archive -Path "$TEMP_DIR\*" -DestinationPath $ZIP_FILE -Force

Write-Host "=== 3. Dang tai tep len VPS qua SCP ===" -ForegroundColor Cyan
scp -P $VPS_PORT $ZIP_FILE "${VPS_USER}@${VPS_IP}:/tmp/"

Write-Host "=== 4. Dang giai nen va cau hinh tren VPS ===" -ForegroundColor Cyan
$RemoteCmd = "sudo apt-get update -y && sudo apt-get install -y unzip && sudo mkdir -p $REMOTE_DIR && sudo unzip -o /tmp/$ZIP_FILE -d $REMOTE_DIR && sudo rm -f /tmp/$ZIP_FILE && cd $REMOTE_DIR && chmod +x deploy-vps.sh && ./deploy-vps.sh"
ssh -p $VPS_PORT "${VPS_USER}@${VPS_IP}" $RemoteCmd

Write-Host "=== 5. Don dep thu muc tam ===" -ForegroundColor Cyan
Remove-Item -Recurse -Force $TEMP_DIR
Remove-Item -Force $ZIP_FILE

Write-Host "==========================================" -ForegroundColor Green
Write-Host "SUCCESS: HOAN THANH DI CHUYEN DU AN LEN VPS" -ForegroundColor Green
Write-Host "URL: http://$VPS_IP/" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
