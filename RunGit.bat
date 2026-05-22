@echo off
title Tu Dong Push Git
echo Chuan bi push code len Github...

:: Thêm tất cả thay đổi vào kho lưu trữ
echo 1. Dang chay: git add .
git add .

:: Khởi tạo nội dung commit
echo 2. Dang chay: git commit -m "Update"
git commit -m "Update"

:: Đẩy code lên nhánh chính
echo 3. Dang chay: git push origin main
git push origin main

echo ====================================
echo Hoan thanh quy trinh Git Push!
pause
    