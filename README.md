# Mikroin Monitor

Mikroin Monitor adalah aplikasi monitoring OLT dan ONU/ONT berbasis SNMP menggunakan Next.js. Aplikasi ini membantu teknisi memantau status OLT, data ONU/ONT, RX power, suhu, kasus down, alert, notifikasi Telegram, chat bot Telegram, role akses, dan startup otomatis.

## Fitur Utama

- Monitoring OLT via SNMP.
- Polling data ONU/ONT.
- Menampilkan RX power, suhu, status, dan kasus down.
- Alert ONT down, ONT recovery, OLT down, dan OLT recovery.
- Notifikasi Telegram.
- Chat bot Telegram untuk `/menu`, `/cek`, `/down`, `/olt`, dan `/summary`.
- Login lokal dengan role `Admin` dan `Super Admin`.
- Menu System untuk user, role, audit log, reset default, dan startup otomatis.
- Dark mode dan light mode.

## Kebutuhan Sistem

- Windows, Linux, atau server lokal yang bisa menjalankan Node.js.
- Node.js LTS.
- NPM.
- Akses jaringan dari server aplikasi ke OLT.
- SNMP community OLT.
- Port default aplikasi: `3007`.

## 1. Install Node.js

### Windows

1. Buka website Node.js:
   `https://nodejs.org`
2. Download versi `LTS`.
3. Jalankan installer.
4. Pastikan opsi `npm package manager` ikut terinstall.
5. Setelah selesai, buka PowerShell atau Command Prompt.
6. Cek instalasi:

```powershell
node -v
npm -v
```

Jika PowerShell menolak perintah `npm`, gunakan:

```powershell
npm.cmd -v
```

### Linux Ubuntu/Debian

Install Node.js LTS sesuai distro yang digunakan. Contoh umum:

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v
npm -v
```

Jika versi Node.js dari repository terlalu lama, gunakan installer resmi dari Node.js atau NodeSource.

## 2. Masuk ke Folder Aplikasi

Contoh Windows:

```powershell
cd "D:\OLT Monitoring"
```

Contoh Linux:

```bash
cd /opt/mikroin-monitor
```

## 3. Install Dependency

Jalankan:

```bash
npm install
```

Di Windows PowerShell, jika `npm` diblokir, gunakan:

```powershell
npm.cmd install
```

## 4. Jalankan Mode Development

Untuk menjalankan aplikasi lokal:

```bash
npm run dev
```

Atau di Windows:

```powershell
npm.cmd run dev
```

Buka browser:

```text
http://127.0.0.1:3007
```

## 5. Jalankan Mode Production

Build aplikasi:

```bash
npm run build
```

Jalankan aplikasi:

```bash
npm run start
```

Jika ingin dibuka dari perangkat lain dalam jaringan:

```bash
npm run start -- --hostname 0.0.0.0 --port 3007
```

Lalu buka dari client:

```text
http://IP-SERVER:3007
```

## 6. Login Default

Akun awal:

```text
Username: superadmin
Password: hubungi pengembang
Role: Super Admin
```

```text
Username: admin
Password: admin123
Role: Admin
```

Segera ganti password melalui menu:

```text
System -> Akun dan Role -> Edit User
```

## 7. Role Akses

### Admin

Admin bisa mengakses:

- Dashboard
- OLT
- ONU/ONT
- Alert
- About

### Super Admin

Super Admin bisa mengakses semua menu:

- Dashboard
- OLT
- ONU/ONT
- Alert
- Setting
- System
- About

## 8. Menambahkan OLT

1. Login sebagai Super Admin atau role yang memiliki akses OLT.
2. Masuk menu `OLT`.
3. Isi:
   - Nama OLT
   - IP/Host
   - Vendor
   - Port SNMP, default `161`
   - Community
   - Write Community jika ingin fitur rename aktif
   - Polling dalam detik, default `60`
4. Klik `Simpan OLT`.
5. Klik `Test` untuk cek SNMP.
6. Klik `Poll ONU` untuk membaca data ONU/ONT.

## 9. Telegram Notifikasi dan Chat Bot

Masuk menu:

```text
Setting -> Telegram Bot
```

Isi:

- Bot Token
- Chat ID
- Aktifkan Telegram
- Aktifkan chat bot polling
- Notifikasi ONT down
- Notifikasi ONT recovery

Command bot:

```text
/menu
/cek nama pelanggan
/down
/olt
/summary
```

Untuk grup Telegram:

- Masukkan bot ke grup.
- Gunakan Chat ID grup, biasanya diawali `-100`.
- Jika command grup tidak terbaca, nonaktifkan privacy mode bot lewat BotFather.

## 10. Startup Otomatis

### Windows

Masuk menu:

```text
System -> Jalankan saat startup
```

Klik:

```text
Aktifkan Startup
```

Aplikasi akan membuat launcher di folder Startup Windows. Setelah Windows login, Mikroin Monitor akan menjalankan server lokal otomatis.

### Linux

Linux menggunakan `systemd`. Menu System akan menampilkan template service dan command yang perlu dijalankan dengan akses `sudo`.

Alur umum:

```bash
npm run build
sudo systemctl daemon-reload
sudo systemctl enable mikroin-monitor.service
sudo systemctl start mikroin-monitor.service
sudo systemctl status mikroin-monitor.service
```

## 11. Reset Default

Menu:

```text
System -> Reset Default
```

Reset Default akan mengosongkan:

- OLT
- ONU/ONT
- Alert
- Setting Telegram

Reset Default tidak menghapus akun login.

## 12. File Data Lokal

Data monitoring:

```text
data/monitoring-db.json
```

Data akun dan audit log:

```text
data/auth-db.json
```

QRIS About:

```text
public/QRIS.svg
```

## 13. Troubleshooting

### Aplikasi tidak bisa dibuka

Pastikan server berjalan:

```bash
npm run dev
```

Lalu buka:

```text
http://127.0.0.1:3007
```

### OLT tidak terbaca

Cek:

- IP OLT benar.
- Port SNMP benar.
- Community benar.
- Server aplikasi bisa menjangkau IP OLT.
- Firewall tidak memblokir SNMP.

### Telegram tidak mengirim

Cek:

- Bot Token benar.
- Chat ID benar.
- Bot sudah masuk grup jika memakai grup.
- Telegram aktif di menu Setting.
- Klik `Test Telegram`.

### PowerShell menolak npm

Gunakan:

```powershell
npm.cmd run dev
```

atau ubah Execution Policy Windows jika diperlukan.

## 14. Kontak

WhatsApp:

```text
085353368296
```

Email:

```text
radius.mikroin@gmail.com
```

## 15. Dukungan Pengembangan

Jika Mikroin Monitor membantu operasional jaringan Anda, dukungan donasi sangat berarti untuk pengembangan, perawatan, dan penambahan fitur. Untuk permintaan hak akses Super Admin atau dukungan lanjutan, silakan hubungi pengembang melalui WhatsApp atau email.
