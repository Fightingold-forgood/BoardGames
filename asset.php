<?php
// ส่งไฟล์เกมจาก private/ เฉพาะเมื่อ login แล้ว (แทน PUBLIC_FILES ของเวอร์ชัน Python)
require __DIR__ . '/lib/bootstrap.php';
require_method('GET');

if (current_user() === null) {
    send_json(401, ['error' => 'ต้องสมัครสมาชิกหรือเข้าสู่ระบบก่อนจึงจะเล่นเกมได้']);
}

$f = (string)($_GET['f'] ?? '');
$base = realpath(__DIR__ . '/private');
$path = str_contains($f, "\0") ? false : realpath($base . DIRECTORY_SEPARATOR . $f);
if ($path === false
    || !str_starts_with($path, $base . DIRECTORY_SEPARATOR)
    || !is_file($path)
    || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'js') {
    send_json(404, ['error' => 'ไม่พบหน้านี้']);
}

header('Content-Type: text/javascript; charset=utf-8');
header('Cache-Control: no-cache');
readfile($path);
