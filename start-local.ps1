# VBAI Local Environment Startup Script
# Last Update: 2026-05-17

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Kích Hoạt Trợ Lý Hành Chính - Local Dev   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Kiểm tra Service Account ngoài repo
$saPath = if ($env:GOOGLE_APPLICATION_CREDENTIALS) { 
    $env:GOOGLE_APPLICATION_CREDENTIALS 
} elseif (Test-Path "$PSScriptRoot/proxy/service-account.json") {
    "$PSScriptRoot/proxy/service-account.json"
} else {
    "$env:TEMP/vbai-service-account.json"
}
if (-not (Test-Path $saPath)) {
    Write-Error "Không tìm thấy file Service Account ngoài repo tại: $saPath. Hãy đặt GOOGLE_APPLICATION_CREDENTIALS hoặc chép file vào thư mục tạm."
    Exit
}
Write-Host "[OK] Tìm thấy file Service Account tại: $saPath" -ForegroundColor Green

# 2. Giải phóng cổng 8080 và 5173
Write-Host "Đang giải phóng cổng 8080 và 5173..." -ForegroundColor Yellow
$p8080 = (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($p8080) { Stop-Process -Id $p8080 -Force; Write-Host " - Đã đóng tiến trình $p8080 trên cổng 8080" -ForegroundColor Green }

$p5173 = (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($p5173) { Stop-Process -Id $p5173 -Force; Write-Host " - Đã đóng tiến trình $p5173 trên cổng 5173" -ForegroundColor Green }

# 3. Chạy Backend trong cửa sổ PowerShell mới
Write-Host "Đang khởi chạy Backend (Port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
    `$env:GOOGLE_APPLICATION_CREDENTIALS='$saPath';
    `$env:FIREBASE_PROJECT_ID='gen-lang-client-0462350485';
    `$env:FIREBASE_SERVICE_ACCOUNT=Get-Content '$saPath' -Raw;
    cd '$PSScriptRoot/proxy';
    npm run dev
"

# 4. Chạy Frontend trong cửa sổ PowerShell mới
Write-Host "Đang khởi chạy Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
    cd '$PSScriptRoot/webapp';
    npm run dev
"

# 5. Đợi server khởi động rồi mở trình duyệt
Write-Host "Đang đợi máy chủ khởi động trong 3 giây..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Đang mở trình duyệt truy cập ứng dụng..." -ForegroundColor Green
Start-Process 'chrome.exe' 'http://localhost:5173/'

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Khởi chạy hoàn tất! Bạn có thể sử dụng.  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

