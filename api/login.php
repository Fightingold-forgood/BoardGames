<?php
require __DIR__ . '/../lib/bootstrap.php';
require_method('POST');
$body = read_json();
check_csrf();

$email = strtolower(trim(text_field($body, 'email', 190)));
$password = text_field($body, 'password', 256);
$userKey = 'login:' . client_ip() . ':' . hash('sha256', $email);   // แฮชอีเมลให้ key ไม่เกิน VARCHAR(190)
$ipKey = 'loginip:' . client_ip();
if (blocked($userKey, 5, LOGIN_WINDOW) || blocked($ipKey, 20, LOGIN_WINDOW)) {
    send_json(429, ['error' => 'ลองผิดหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่']);
}

$row = null;
if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $stmt = mysqli_prepare($conn, 'SELECT id, username, pw_hash FROM accounts WHERE email = ? LIMIT 1');
    mysqli_stmt_bind_param($stmt, 's', $email);
    mysqli_stmt_execute($stmt);
    $row = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt)) ?: null;
    mysqli_stmt_close($stmt);
}

// ไม่พบ user ก็ยังเทียบ hash หลอก เพื่อให้เวลาตอบใกล้เคียงกับกรณีพบ user
$hash = $row ? $row['pw_hash'] : password_hash('dummy-password', PASSWORD_DEFAULT);
$ok = password_verify($password, $hash) && $row !== null;
if (!$ok) {
    note_attempt($userKey);
    note_attempt($ipKey);
    send_json(401, ['error' => 'อีเมลหรือรหัสผ่านไม่ถูกต้อง']);
}

clear_attempts($userKey);
start_login((int)$row['id'], $row['username']);
send_json(200, ['user' => $row['username'], 'csrf' => csrf_token()]);
