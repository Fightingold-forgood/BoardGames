-- ตารางของระบบบัญชีห้องเกม (แยกจากตาราง resume: profile, education, skill, training)
-- รันใน DB ที่กำหนดใน config/db.php เท่านั้น ไม่มี DROP TABLE
CREATE TABLE IF NOT EXISTS accounts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(20) NOT NULL UNIQUE COLLATE utf8mb4_unicode_ci,
  email      VARCHAR(190) NOT NULL UNIQUE COLLATE utf8mb4_unicode_ci,
  pw_hash    VARCHAR(255) NOT NULL,
  created_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ประวัติการเล่น: บันทึกเฉพาะเกมที่จบแล้ว ผลเป็นของบัญชีที่ login (ผู้เล่นคนที่ 1 ในโหมด 2 คน)
CREATE TABLE IF NOT EXISTS game_results (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  game_id    VARCHAR(20) NOT NULL,
  mode       ENUM('bot', 'pvp', 'solo') NOT NULL,
  outcome    ENUM('win', 'lose', 'draw', 'finished') NOT NULL,
  score      INT NULL,
  played_at  INT NOT NULL,
  INDEX idx_account_time (account_id, played_at),
  CONSTRAINT fk_game_results_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  attempt_key  VARCHAR(190) NOT NULL,
  attempted_at INT NOT NULL,
  INDEX idx_attempt_key (attempt_key, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
