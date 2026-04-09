# Huong dan chay du an tren may tinh moi

## 1) Yeu cau truoc khi chay
- He dieu hanh: Windows 10/11
- Da cai Node.js ban LTS (khuyen nghi Node 20+)
- Co ket noi Internet de cai thu vien npm

Kiem tra nhanh:
- Mo PowerShell trong thu muc du an
- Chay lenh:
  - node -v
  - npm -v

Neu 2 lenh tra ve version thi moi truong da san sang.

## 2) Lay source code
- Copy toan bo thu muc du an ReportTool sang may moi
- Cau truc toi thieu can co:
  - server.js
  - package.json
  - reportDataBuilder.js
  - scripts/build-report-data.js
  - thu muc Report

## 3) Dat file bao cao dung cau truc
Hien tai du an ho tro mo hinh moi: moi nam la 1 cap file CSV.

Dat file vao dung duong dan:
- Report/<nam>/...DonHangBan...csv
- Report/<nam>/...danhsachkhachhang-...csv

Vi du:
- Report/2026/2026-04-08-DonHangBan_XXXX.csv
- Report/2026/08-04-2026 22-20-danhsachkhachhang-XXXX.csv

Ghi chu:
- He thong se map du lieu theo cot Ngay tao trong CSV (khong map theo ten folder thang).

## 4) Cai thu vien
Trong thu muc goc du an, chay:
- npm install

## 5) Build du lieu bao cao
Chay lenh:
- npm run build:data

Ket qua mong doi:
- Tao/ghi de file report-data.json

## 6) Chay server
Chay lenh:
- npm start

Server mac dinh chay o:
- http://localhost:3001

Mo dashboard:
- http://localhost:3001/dashboard.html

Mo cac tab khac:
- http://localhost:3001/leads.html
- http://localhost:3001/orders.html
- http://localhost:3001/performance.html

## 7) Quy trinh cap nhat du lieu hang ngay
Moi lan co CSV moi:
1. Copy de file CSV vao dung thu muc Report/<nam>/
2. Chay lai: npm run build:data
3. F5 hoac Ctrl+F5 tren trinh duyet

## 8) Loi thuong gap va cach xu ly
### A. Build xong nhung so lieu thang bi 0
- Kiem tra cot Ngay tao trong CSV co dung dinh dang dd/mm/yyyy
- Kiem tra nam/thang trong Ngay tao co dung voi du lieu mong muon

### B. Khong chay duoc npm install
- Kiem tra mang/Proxy
- Kiem tra quyen folder
- Thu xoa node_modules va package-lock.json roi cai lai:
  - Remove-Item -Recurse -Force node_modules
  - Remove-Item -Force package-lock.json
  - npm install

### C. Mo trang khong thay du lieu moi
- Chay lai npm run build:data
- Hard refresh trinh duyet: Ctrl+F5

## 9) Lenh nhanh tong hop
- npm install
- npm run build:data
- npm start
