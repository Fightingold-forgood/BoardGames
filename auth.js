// ระบบบัญชีฝั่งหน้าเว็บ: ต้องสมัครสมาชิก/เข้าสู่ระบบก่อนจึงจะโหลดเกมได้
// เซิร์ฟเวอร์ไม่ส่งโค้ดเกมให้คนที่ยังไม่ล็อกอิน (ดู PUBLIC_FILES ใน server/app.py)
(function () {
  const $ = (id) => document.getElementById(id);
  const gate = $('gate'), lobby = $('lobby'), bar = $('account'), nameEl = $('account-name');
  const dlg = $('auth'), form = $('auth-form'), userIn = $('auth-user'), passIn = $('auth-pass');
  const errEl = $('auth-error'), submitBtn = $('auth-submit'), hintEl = $('auth-hint'), passHintEl = $('auth-pass-hint');
  const tabLogin = $('auth-tab-login'), tabReg = $('auth-tab-register'), titleEl = $('auth-title');
  const userWrap = $('auth-user-field'), emailIn = $('auth-email');
  const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  // เกมใหม่ต้องเพิ่มชื่อไฟล์ที่นี่ด้วย (ลำดับคือลำดับการ์ดในหน้าแรก) main.js ต้องอยู่ท้ายสุด
  const SCRIPTS = [
    'games/tictactoe.js', 'games/connect4.js', 'games/reversi.js', 'games/memory.js', 'games/snakes.js',
    'games/chess.js', 'games/uno.js', 'games/werewolf.js', 'games/blocks.js', 'games/candy.js', 'games/wheel.js', 'main.js',
  ];
  let mode = 'login', busy = false, loaded = false;

  let csrf = '';   // ได้จาก api/me.php และหมุนใหม่ทุกครั้งที่ login/register

  async function api(path, body) {
    const headers = { 'X-CSRF-Token': csrf };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (data.csrf) csrf = data.csrf;
    return { ok: res.ok, data };
  }
  window.Account = { api };   // ให้ main.js ส่งผลเกมและอ่านประวัติได้ โดยใช้ CSRF token เดียวกัน

  function loadScripts(list) {
    return list.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'asset.php?f=' + encodeURIComponent(src);   // ไฟล์เกมถูกส่งผ่าน asset.php เฉพาะคนที่ login แล้ว
      s.onload = resolve;
      s.onerror = () => reject(new Error(src));
      document.body.appendChild(s);
    })), Promise.resolve());
  }

  function showGate(note, noButtons) {
    lobby.hidden = true;
    bar.hidden = true;
    gate.hidden = false;
    if (note) $('gate-text').textContent = note;
    $('gate-actions').hidden = !!noButtons;
  }

  // เข้าสู่ระบบสำเร็จ: เปิดหน้าแรกแล้วโหลดเกม
  async function enter(user) {
    nameEl.textContent = '👤 ' + user;
    bar.hidden = false;
    gate.hidden = true;
    lobby.hidden = false;
    if (loaded) return;
    try {
      await loadScripts(SCRIPTS);
      loaded = true;
    } catch (e) {
      showGate('โหลดเกมไม่สำเร็จ อาจเพราะเซสชันหมดอายุ ลองเข้าสู่ระบบอีกครั้ง');
    }
  }

  function openDialog(m) {
    setMode(m);
    dlg.showModal();
    (m === 'register' ? userIn : emailIn).focus();   // ช่องชื่อผู้ใช้ซ่อนอยู่ในโหมดเข้าสู่ระบบ
  }

  function setMode(m) {
    mode = m;
    const reg = m === 'register';
    tabLogin.setAttribute('aria-pressed', !reg);
    tabReg.setAttribute('aria-pressed', reg);
    titleEl.textContent = reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
    submitBtn.textContent = reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
    passIn.autocomplete = reg ? 'new-password' : 'current-password';
    hintEl.hidden = !reg;
    passHintEl.hidden = !reg;
    userWrap.hidden = !reg;
    showError('');
  }

  function showError(msg) {
    errEl.textContent = msg;   // textContent เท่านั้น ไม่ใช้ innerHTML กับข้อความจากเซิร์ฟเวอร์
  }

  function validate() {
    if (emailIn.value.length > 190 || !EMAIL_RE.test(emailIn.value)) return 'กรอกอีเมลให้ถูกต้อง';
    if (mode === 'register' && !USERNAME_RE.test(userIn.value)) return 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9 และ _ ความยาว 3-20 ตัวอักษร';
    if (mode === 'register' && (passIn.value.length < 10 || passIn.value.length > 128)) return 'รหัสผ่านต้องยาว 10-128 ตัวอักษร';
    if (!passIn.value) return 'กรอกรหัสผ่านก่อน';
    return '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const problem = validate();
    if (problem) { showError(problem); return; }
    busy = true;
    submitBtn.disabled = true;
    showError('');
    try {
      const payload = mode === 'register'
        ? { username: userIn.value, email: emailIn.value, password: passIn.value }
        : { email: emailIn.value, password: passIn.value };
      const r = await api(mode === 'register' ? 'api/register.php' : 'api/login.php', payload);
      if (r.ok) {
        passIn.value = '';
        emailIn.value = '';
        dlg.close();
        enter(r.data.user);
      } else {
        showError(r.data.error || 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง');
      }
    } catch (err) {
      showError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่แล้วลองใหม่');
    } finally {
      busy = false;
      submitBtn.disabled = false;
    }
  });

  $('gate-register').addEventListener('click', () => openDialog('register'));
  $('gate-login').addEventListener('click', () => openDialog('login'));
  $('account-btn').addEventListener('click', async () => {
    try { await api('api/logout.php', {}); } catch (e) {}
    location.reload();   // โหลดหน้าใหม่เพื่อล้างเกมที่โหลดไว้ในหน้าออกทั้งหมด
  });
  $('auth-cancel').addEventListener('click', () => { passIn.value = ''; dlg.close(); });
  tabLogin.addEventListener('click', () => setMode('login'));
  tabReg.addEventListener('click', () => setMode('register'));
  [userIn, passIn].forEach((el) => el.addEventListener('input', () => showError('')));

  if (location.protocol === 'file:') {
    showGate('ต้องเปิดผ่าน Apache (XAMPP) ก่อนจึงจะเล่นได้ เช่น http://localhost/<ชื่อโฟลเดอร์>/', true);
  } else {
    api('api/me.php').then((r) => {
      if (r.ok && r.data.user) enter(r.data.user);
      else showGate();
    }).catch(() => showGate('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่แล้วโหลดหน้านี้ใหม่', true));
  }
})();
