<?php
// บันทึกผลเกมที่จบแล้วของบัญชีที่ login อยู่ (ใช้ prepared statement และ CSRF เหมือน API อื่น)
require __DIR__ . '/../lib/bootstrap.php';
require_method('POST');
$body = read_json();
check_csrf();

$uid = $_SESSION['user_id'] ?? null;
if ($uid === null) send_json(401, ['error' => 'ต้องเข้าสู่ระบบก่อน']);

$game = text_field($body, 'game', 20);
$mode = text_field($body, 'mode', 10);
$outcome = text_field($body, 'outcome', 10);

const GAMES = ['ttt', 'c4', 'reversi', 'memory', 'snakes', 'chess', 'uno', 'werewolf', 'blocks', 'candy'];
const SOLO_GAMES = ['blocks', 'candy'];
const MODES = ['bot', 'pvp', 'solo'];
const OUTCOMES = ['win', 'lose', 'draw', 'finished'];

if (!in_array($game, GAMES, true) || !in_array($mode, MODES, true) || !in_array($outcome, OUTCOMES, true)) {
    send_json(400, ['error' => 'ข้อมูลผลเกมไม่ถูกต้อง']);
}
// เกมคนเดียวต้องเป็นโหมด solo และจบด้วย finished เท่านั้น เกมอื่นต้องเป็น bot/pvp และจบด้วยผลแพ้ชนะ
$solo = in_array($game, SOLO_GAMES, true);
if ($solo !== ($mode === 'solo') || $solo !== ($outcome === 'finished')) {
    send_json(400, ['error' => 'ข้อมูลผลเกมไม่ถูกต้อง']);
}

$score = null;
if (isset($body['score'])) {
    if (!is_int($body['score']) || $body['score'] < 0 || $body['score'] > 100000000) {
        send_json(400, ['error' => 'คะแนนไม่ถูกต้อง']);
    }
    $score = $body['score'];
}

$now = time();
$stmt = mysqli_prepare($conn, 'INSERT INTO game_results (account_id, game_id, mode, outcome, score, played_at) VALUES (?, ?, ?, ?, ?, ?)');
mysqli_stmt_bind_param($stmt, 'isssii', $uid, $game, $mode, $outcome, $score, $now);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

send_json(201, ['ok' => true]);
