<?php
// คัดลอกไฟล์นี้เป็น config/db.php แล้วกรอกค่าจริงของเครื่องหรือ server (config/db.php อยู่ใน .gitignore)
$host = getenv('DB_HOST') ?: 'localhost';
$user = getenv('DB_USER') ?: 'your_user';
$pass = getenv('DB_PASS') ?: 'your_password';
$dbname = getenv('DB_NAME') ?: 'your_database';
$conn = mysqli_connect($host, $user, $pass, $dbname);
mysqli_set_charset($conn, 'utf8mb4');
