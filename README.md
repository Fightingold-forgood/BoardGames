# ห้องรวมบอร์ดเกม (เวอร์ชัน PHP + MySQL)

พอร์ตจาก `server/app.py` (Python + SQLite) มาเป็น PHP + MySQL ตามแนวทางของแล็บ 69-database ฟีเจอร์เกมและหน้า UI เหมือนเดิม

## ต้องมี
- PHP 8.1 ขึ้นไป (ใช้ `array_is_list`, `str_contains`) และ MySQL ผ่าน XAMPP หรือ Angsila
- Apache ที่อนุญาต `.htaccess` (`AllowOverride All`) เพื่อกันการเข้าไฟล์ใน `private/` โดยตรง

## ขั้นตอน
1. คัดลอกโฟลเดอร์นี้ไปไว้ใน web root เช่น `htdocs/boardgames/`
2. นำเข้า `database/boardgames.sql` ใน phpMyAdmin (สร้างตาราง `accounts` และ `login_attempts` เท่านั้น)
3. คัดลอก `config/db.example.php` เป็น `config/db.php` แล้วกรอก host, user, password และชื่อฐานข้อมูลจริง
4. เปิด `http://localhost/boardgames/` แล้วสมัครสมาชิก

## โครงสร้าง
- `index.html`, `auth.js`, `style.css`, `sfx.js`, `fx.js`, `registry.js`: ไฟล์สาธารณะ
- `private/` (main.js และ games/*.js): ส่งผ่าน `asset.php` หลัง login เท่านั้น
- `api/me.php`, `api/register.php`, `api/login.php`, `api/logout.php`: API ของบัญชี
- `lib/bootstrap.php`: session, CSRF, origin check, rate limit

## ความปลอดภัย
- SQL ทุกคำสั่งใช้ prepared statement
- รหัสผ่านเก็บด้วย `password_hash` / เทียบด้วย `password_verify`
- session เปลี่ยน id หลัง login (`session_regenerate_id`), cookie เป็น HttpOnly และ SameSite=Strict
- POST ทุกคำขอต้องมี CSRF token ใน header `X-CSRF-Token`
- จำกัดการ login ผิดซ้ำด้วยตาราง `login_attempts`

หมายเหตุ: ทดสอบด้วย `server/test_auth.py` ไม่ได้ เพราะเป็นเทสต์ของเวอร์ชัน Python ยังไม่มีเทสต์ของเวอร์ชันนี้ และยังไม่ได้รันบน PHP จริง
