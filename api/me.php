<?php
require __DIR__ . '/../lib/bootstrap.php';
require_method('GET');
send_json(200, ['user' => current_user(), 'csrf' => csrf_token()]);
