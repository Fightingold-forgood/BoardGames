(function () {
  const $ = (id) => document.getElementById(id);
  const lobby = $('lobby'), gameView = $('game'), stage = $('stage'), statusEl = $('status');
  let current = null;   // เกมที่เปิดอยู่
  let destroy = null;   // ฟังก์ชันเก็บกวาดของเกมที่เปิดอยู่
  let mode = 'bot';
  let reported = false;   // กันการบันทึกซ้ำในรอบเดียวกัน
  try { mode = localStorage.getItem('bg-mode') || 'bot'; } catch (e) {}

  // สีประจำเกม (เหมือนสีฝากล่อง) และจำนวนผู้เล่น
  const META = {
    ttt: { color: '#2bb3c0', players: '1–2 คน' },
    c4: { color: '#2e86de', players: '1–2 คน' },
    reversi: { color: '#2a8f6a', players: '1–2 คน' },
    memory: { color: '#8e5ad7', players: '1–2 คน' },
    snakes: { color: '#e0488b', players: '1–2 คน' },
    chess: { color: '#8b5e3c', players: '1–2 คน' },
    uno: { color: '#d6453d', players: '2–4 คน' },
    werewolf: { color: '#5a4fcf', players: '1 หรือ 4–8 คน' },
    blocks: { color: '#7cb518', players: '1 คน' },
    candy: { color: '#14b8a6', players: '1 คน' },
    wheel: { color: '#f08a4b', players: 'ไม่จำกัด' },
  };
  const meta = (g) => META[g.id] || { color: '#2a8f6a', players: '' };

  // ไอคอนเกมเป็น SVG วาดเอง (ไม่ใช้ emoji)
  const ICONS = {
    ttt: '<svg viewBox="0 0 66 66"><path d="M12 12l16 16M28 12L12 28M38 38l16 16M54 38L38 54" stroke="#fbf5e6" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="20" r="9" fill="none" stroke="#fbf5e6" stroke-width="5"/></svg>',
    c4: '<svg viewBox="0 0 66 66"><rect x="6" y="14" width="54" height="40" rx="6" fill="#fbf5e6"/><circle cx="16" cy="25" r="5" fill="#d6453d"/><circle cx="28" cy="25" r="5" fill="#f2b134"/><circle cx="40" cy="25" r="5" fill="#d6453d"/><circle cx="52" cy="25" r="5" fill="#f2b134"/></svg>',
    reversi: '<svg viewBox="0 0 66 66"><rect x="6" y="6" width="54" height="54" rx="4" fill="#1c4a3c"/><circle cx="24" cy="33" r="11" fill="#fbf5e6"/><circle cx="42" cy="33" r="11" fill="#1f1a12"/></svg>',
    memory: '<svg viewBox="0 0 66 66"><rect x="10" y="8" width="30" height="42" rx="5" fill="#fbf5e6" transform="rotate(-10 25 29)"/><rect x="26" y="14" width="30" height="42" rx="5" fill="#f2b134" transform="rotate(8 41 35)"/><path d="M36 33l3 3 6-7" stroke="#8e5ad7" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    snakes: '<svg viewBox="0 0 66 66"><path d="M10 56h10V44h10V32h10V20h10V8h16" stroke="#fbf5e6" stroke-width="6" fill="none" stroke-linejoin="round"/><path d="M22 14c8 0 4 10-2 14" stroke="#fbf5e6" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
    chess: '<svg viewBox="0 0 66 66"><path d="M33 8l-8 10h16zM24 20h18l4 26H20zM16 50h34v6H16z" fill="#fbf5e6"/></svg>',
    uno: '<svg viewBox="0 0 66 66"><rect x="14" y="10" width="26" height="38" rx="4" fill="#fbf5e6" transform="rotate(-12 27 29)"/><rect x="26" y="14" width="26" height="38" rx="4" fill="#f2b134" transform="rotate(10 39 33)"/></svg>',
    werewolf: '<svg viewBox="0 0 66 66"><path d="M33 10l18 12v16c0 11-8 17-18 20-10-3-18-9-18-20V22z" fill="#fbf5e6"/><path d="M26 34l7-6 7 6" stroke="#5a4fcf" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    blocks: '<svg viewBox="0 0 66 66"><rect x="8" y="34" width="22" height="22" rx="3" fill="#fbf5e6"/><rect x="30" y="34" width="22" height="22" rx="3" fill="#fbf5e6"/><rect x="19" y="12" width="22" height="22" rx="3" fill="#f2b134"/></svg>',
    candy: '<svg viewBox="0 0 66 66"><circle cx="22" cy="22" r="10" fill="#fbf5e6"/><circle cx="44" cy="22" r="10" fill="#f2b134"/><circle cx="22" cy="44" r="10" fill="#f2b134"/><circle cx="44" cy="44" r="10" fill="#fbf5e6"/></svg>',
    wheel: '<svg viewBox="0 0 66 66"><circle cx="33" cy="33" r="26" fill="#fbf5e6"/><path d="M33 33L33 7A26 26 0 0 1 55 45Z" fill="#f2b134"/><path d="M33 33L55 45A26 26 0 0 1 11 45Z" fill="#d6453d"/><circle cx="33" cy="33" r="5" fill="#1f1a12"/></svg>',
  };

  // จุดแสดงจำนวนผู้เล่นสูงสุด (1 จุด = 1 คน) ไม่มีจุดถ้าไม่จำกัด
  function pips(text) {
    const nums = (text || '').match(/\d+/g);
    const n = nums ? Math.max(...nums.map(Number)) : 0;
    const dots = Array.from({ length: Math.min(n, 8) }, () => '<i></i>').join('');
    return `<span class="pips">${dots}<span>${text}</span></span>`;
  }

  // การ์ดเลือกเกมในหน้า lobby
  Games.forEach((g, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.style.animationDelay = i * 45 + 'ms';
    b.style.setProperty('--tint', meta(g).color);
    b.innerHTML = `<span class="card-art">${ICONS[g.id] || ''}</span>
      <span class="card-body"><span class="name">${g.name}</span><span class="desc">${g.desc}</span>
        <span class="foot">${pips(meta(g).players)}<span class="play">เล่น</span></span></span>`;
    b.addEventListener('click', () => open(g));
    $('cards').appendChild(b);
  });

  // ข้อความที่ขึ้นต้นด้วย 🎉 คือมีผู้ชนะ: ถ้าบอทชนะให้จอสั่นพร้อมเสียงแพ้ นอกนั้นฉลองเต็มรูปแบบ
  function react(t) {
    if (!t) return;
    if (t.startsWith('🎉')) {
      if (/^🎉 บอท/.test(t)) { FX.shake(stage, 10); SFX.play('lose'); }
      else FX.win();
    } else if (/^เสมอ/.test(t)) {
      SFX.play('draw');
    }
  }

  // บันทึกผลเกมที่จบแล้ว (1 ครั้งต่อการเล่น 1 รอบ) ส่งให้บัญชีที่ login อยู่เท่านั้น
  function report(r) {
    if (reported || !current || !window.Account) return;
    reported = true;
    window.Account.api('api/game_result.php', {
      game: current.id,
      mode: current.solo ? 'solo' : mode,
      outcome: r.outcome,
      score: r.score ?? null,
    }).catch(() => {});
  }

  function start() {
    if (destroy) destroy();
    stage.innerHTML = '';
    statusEl.textContent = '';
    reported = false;
    destroy = current.create(stage, {
      mode,
      status: (t) => {
        statusEl.textContent = t;
        FX.restart(statusEl, 'fx-pop');
        react(t);
      },
      finish: report,
    });
  }

  function open(g) {
    current = g;
    $('game-title').textContent = g.name;
    $('rules').textContent = g.rules;
    gameView.style.setProperty('--tint', meta(g).color);
    $('mode-bot').parentElement.hidden = !!g.solo;   // เกมเล่นคนเดียวไม่ต้องมีปุ่มเลือกโหมด
    lobby.hidden = true;
    gameView.hidden = false;
    syncMode();
    start();
  }

  function close() {
    if (destroy) destroy();
    destroy = null;
    stage.innerHTML = '';
    gameView.hidden = true;
    lobby.hidden = false;
    loadHistory();
  }

  // ประวัติการเล่นของบัญชีที่ login อยู่ (ข้อความทั้งหมดใส่ด้วย textContent)
  const OUTCOME = { win: 'ชนะ', lose: 'แพ้', draw: 'เสมอ', finished: 'จบเกม' };
  const MODE = { bot: 'กับบอท', pvp: '2 คนบนเครื่อง', solo: 'เล่นคนเดียว' };
  function loadHistory() {
    const list = $('history-list');
    if (!list || !window.Account) return;
    window.Account.api('api/history.php').then((r) => {
      list.replaceChildren();
      const items = (r.ok && r.data.items) || [];
      if (!items.length) {
        const empty = document.createElement('li');
        empty.className = 'history-empty';
        empty.textContent = 'ยังไม่มีประวัติการเล่น เล่นให้จบสักเกมแล้วจะขึ้นที่นี่';
        list.appendChild(empty);
        return;
      }
      items.forEach((it) => {
        const li = document.createElement('li');
        li.className = 'history-row';
        const game = (window.Games || []).find((g) => g.id === it.game_id);
        const cells = [
          ['history-game', game ? game.name : it.game_id],
          ['history-outcome outcome-' + it.outcome, OUTCOME[it.outcome] || it.outcome],
          ['history-mode', MODE[it.mode] || ''],
          ['history-score', it.score !== null ? it.score + ' คะแนน' : ''],
          ['history-time', new Date(it.played_at * 1000).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })],
        ];
        cells.forEach(([cls, text]) => {
          const s = document.createElement('span');
          s.className = cls;
          s.textContent = text;
          li.appendChild(s);
        });
        list.appendChild(li);
      });
    });
  }

  function syncMode() {
    $('mode-bot').setAttribute('aria-pressed', mode === 'bot');
    $('mode-pvp').setAttribute('aria-pressed', mode === 'pvp');
  }

  function setMode(m) {
    mode = m;
    try { localStorage.setItem('bg-mode', m); } catch (e) {}
    syncMode();
    start();
  }

  $('back').addEventListener('click', close);
  $('restart').addEventListener('click', start);
  $('mode-bot').addEventListener('click', () => setMode('bot'));
  $('mode-pvp').addEventListener('click', () => setMode('pvp'));
  loadHistory();
})();
