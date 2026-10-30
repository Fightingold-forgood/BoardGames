<?php
require __DIR__ . '/../lib/bootstrap.php';
require_method('POST');
$body = read_json();
check_csrf();

$username = text_field($body, 'username', 64);
$password = text_field($body, 'password', 256);
$email = strtolower(trim(text_field($body, 'email', 190)));
if (!preg_match(USERNAME_RE, $username)) {
    send_json(400, ['error' => 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9 และ _ ความยาว 3-20 ตัวอักษร']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    send_json(400, ['error' => 'กรอกอีเมลให้ถูกต้อง']);
}
if (mb_strlen($password) < 10 || mb_strlen($password) > 128) {
    send_json(400, ['error' => 'รหัสผ่านต้องยาว 10-128 ตัวอักษร']);
}

$key = 'reg:' . client_ip();
if (blocked($key, 10, 3600)) send_json(429, ['error' => 'สมัครสมาชิกบ่อยเกินไป รอสักครู่แล้วลองใหม่']);
note_attempt($key);

$hash = password_hash($password, PASSWORD_DEFAULT);
try {
    $stmt = mysqli_prepare($conn, 'INSERT INTO accounts (username, email, pw_hash, created_at) VALUES (?, ?, ?, ?)');
    $now = time();
    mysqli_stmt_bind_param($stmt, 'sssi', $username, $email, $hash, $now);
    mysqli_stmt_execute($stmt);
    $id = mysqli_insert_id($conn);
    mysqli_stmt_close($stmt);
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() === 1062) send_json(409, ['error' => 'ชื่อผู้ใช้หรืออีเมลนี้มีคนใช้แล้ว']);
    throw $e;
}

start_login((int)$id, $username);
send_json(201, ['user' => $username, 'csrf' => csrf_token()]);
