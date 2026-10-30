<?php
// ประวัติการเล่นล่าสุดของบัญชีที่ login อยู่ (เฉพาะของตัวเอง)
require __DIR__ . '/../lib/bootstrap.php';
require_method('GET');

$uid = $_SESSION['user_id'] ?? null;
if ($uid === null) send_json(401, ['error' => 'ต้องเข้าสู่ระบบก่อน']);

$stmt = mysqli_prepare($conn, 'SELECT game_id, mode, outcome, score, played_at FROM game_results WHERE account_id = ? ORDER BY played_at DESC, id DESC LIMIT 30');
mysqli_stmt_bind_param($stmt, 'i', $uid);
mysqli_stmt_execute($stmt);
$items = [];
$res = mysqli_stmt_get_result($stmt);
while ($row = mysqli_fetch_assoc($res)) {
    $row['score'] = $row['score'] === null ? null : (int)$row['score'];
    $row['played_at'] = (int)$row['played_at'];
    $items[] = $row;
}
mysqli_stmt_close($stmt);

send_json(200, ['items' => $items]);
