<?php
// ตัวช่วยกลาง: session, ฐานข้อมูล, JSON, CSRF, origin check, rate limit (ทุกคำสั่ง SQL ใช้ prepared statement)
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
require_once __DIR__ . '/../config/db.php';

const COOKIE_LIFETIME = 604800;   // 7 วัน
const MAX_BODY = 4096;
const USERNAME_RE = '/\A[A-Za-z0-9_]{3,20}\z/';
const LOGIN_WINDOW = 900;         // 15 นาที

header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.gc_maxlifetime', (string)COOKIE_LIFETIME);
session_set_cookie_params([
    'lifetime' => COOKIE_LIFETIME,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

function send_json(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

// คำขอที่มี Origin ต้องมาจากโดเมนเดียวกับหน้าเว็บ
function origin_check(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $u = parse_url($origin);
    $netloc = ($u['host'] ?? '') . (isset($u['port']) ? ':' . $u['port'] : '');
    if ($netloc !== ($_SERVER['HTTP_HOST'] ?? '')) send_json(403, ['error' => 'คำขอไม่ได้มาจากหน้าเว็บนี้']);
}

function require_method(string $method): void {
    if ($_SERVER['REQUEST_METHOD'] !== $method) send_json(405, ['error' => 'วิธีส่งไม่ถูกต้อง']);
}

function read_json(): array {
    origin_check();
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') send_json(415, ['error' => 'ต้องส่งข้อมูลเป็น JSON']);
    $len = $_SERVER['CONTENT_LENGTH'] ?? null;
    if ($len === null || !ctype_digit((string)$len)) send_json(411, ['error' => 'ไม่ทราบขนาดข้อมูล']);
    if ((int)$len > MAX_BODY) send_json(413, ['error' => 'ข้อมูลที่ส่งมาใหญ่เกินไป']);
    $data = json_decode((string)file_get_contents('php://input', false, null, 0, MAX_BODY), true);
    if (!is_array($data) || array_is_list($data)) send_json(400, ['error' => 'ข้อมูลที่ส่งมาไม่ถูกต้อง']);
    return $data;
}

function text_field(array $body, string $name, int $max): string {
    $v = $body[$name] ?? null;
    if (!is_string($v) || mb_strlen($v) > $max) send_json(400, ['error' => 'ข้อมูลที่ส่งมาไม่ถูกต้อง']);
    return $v;
}

// CSRF token เก็บใน session และส่งกลับทาง /api/me ให้หน้าเว็บแนบใน header X-CSRF-Token
function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function check_csrf(): void {
    if (!hash_equals(csrf_token(), $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) send_json(403, ['error' => 'Invalid CSRF token']);
}

function current_user(): ?string {
    return $_SESSION['username'] ?? null;
}

// หลัง login สำเร็จ เปลี่ยน session id (กัน session fixation) และหมุน CSRF token ใหม่
function start_login(int $id, string $username): void {
    session_regenerate_id(true);
    $_SESSION['user_id'] = $id;
    $_SESSION['username'] = $username;
    unset($_SESSION['csrf']);
}

function client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function attempts(string $key, int $window): int {
    global $conn;
    $since = time() - $window;
    $stmt = mysqli_prepare($conn, 'SELECT COUNT(*) FROM login_attempts WHERE attempt_key = ? AND attempted_at > ?');
    mysqli_stmt_bind_param($stmt, 'si', $key, $since);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_bind_result($stmt, $n);
    mysqli_stmt_fetch($stmt);
    mysqli_stmt_close($stmt);
    return (int)$n;
}

function blocked(string $key, int $limit, int $window): bool {
    return attempts($key, $window) >= $limit;
}

function note_attempt(string $key): void {
    global $conn;
    $old = time() - 3600;
    $del = mysqli_prepare($conn, 'DELETE FROM login_attempts WHERE attempted_at < ?');
    mysqli_stmt_bind_param($del, 'i', $old);
    mysqli_stmt_execute($del);
    mysqli_stmt_close($del);
    $now = time();
    $ins = mysqli_prepare($conn, 'INSERT INTO login_attempts (attempt_key, attempted_at) VALUES (?, ?)');
    mysqli_stmt_bind_param($ins, 'si', $key, $now);
    mysqli_stmt_execute($ins);
    mysqli_stmt_close($ins);
}

function clear_attempts(string $key): void {
    global $conn;
    $stmt = mysqli_prepare($conn, 'DELETE FROM login_attempts WHERE attempt_key = ?');
    mysqli_stmt_bind_param($stmt, 's', $key);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);
}
