<?php
require __DIR__ . '/../lib/bootstrap.php';
require_method('POST');
origin_check();
check_csrf();

$_SESSION = [];
$p = session_get_cookie_params();
setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
session_destroy();
send_json(200, ['user' => null]);
