Games.push({
  id: 'blocks',
  name: 'ต่อบล็อก',
  emoji: '🧱',
  solo: true,
  desc: 'หมุนและต่อบล็อกที่ตกลงมาให้เต็มแถว เล่นให้ได้คะแนนสูงสุด',
  rules: 'บล็อกตกลงมาเรื่อยๆ ให้เลื่อนและหมุนเพื่อต่อให้เต็มแถว แถวที่เต็มจะหายไปและได้คะแนน ล้างพร้อมกัน 4 แถวได้คะแนนมากที่สุด ทุก 10 แถวจะขึ้นระดับและบล็อกตกเร็วขึ้น เกมจบเมื่อบล็อกกองสูงถึงขอบบน คีย์บอร์ด: ← → เลื่อน, ↓ ตกเร็ว, ↑ หรือ X หมุนขวา, Z หมุนซ้าย, Space ทิ้งลงทันที, C เก็บบล็อกไว้, P หยุดชั่วคราว บนมือถือใช้ปุ่มด้านล่างกระดาน',
  create(root, ctx) {
    const W = 10, H = 20, S = 28;
    const SHAPES = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      O: [[1, 1], [1, 1]],
      T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    };
    const COLORS = { I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#22c55e', Z: '#ef4444', J: '#3b82f6', L: '#f97316' };
    const LINE_SCORE = [0, 100, 300, 500, 800];
    const rnd = (k) => Math.floor(Math.random() * k);
    const KEY = 'bg-blocks-best';
    let best = 0;
    try { best = Number(localStorage.getItem(KEY)) || 0; } catch (e) {}

    root.innerHTML = `
      <div class="blk">
        <canvas class="blk-board" width="${W * S}" height="${H * S}" role="img" aria-label="กระดานเกมต่อบล็อก"></canvas>
        <div class="blk-side">
          <div class="blk-box"><span class="blk-label">ถัดไป</span><canvas class="blk-mini" width="88" height="88" data-k="next"></canvas></div>
          <div class="blk-box"><span class="blk-label">เก็บไว้</span><canvas class="blk-mini" width="88" height="88" data-k="hold"></canvas></div>
          <div class="blk-stat"><span>คะแนน</span><b data-k="score">0</b></div>
          <div class="blk-stat"><span>ระดับ</span><b data-k="level">1</b></div>
          <div class="blk-stat"><span>แถว</span><b data-k="lines">0</b></div>
          <div class="blk-stat"><span>สถิติสูงสุด</span><b data-k="best">${best}</b></div>
          <button class="btn blk-pause">หยุดชั่วคราว</button>
        </div>
        <div class="blk-pad">
          <button class="btn" data-a="left" aria-label="เลื่อนซ้าย">◀</button>
          <button class="btn" data-a="cw" aria-label="หมุน">⟳</button>
          <button class="btn" data-a="right" aria-label="เลื่อนขวา">▶</button>
          <button class="btn" data-a="down" aria-label="ตกเร็ว">▼</button>
          <button class="btn btn-primary" data-a="drop" aria-label="ทิ้งลงทันที">ทิ้งลง</button>
          <button class="btn" data-a="hold" aria-label="เก็บบล็อกไว้">เก็บไว้</button>
        </div>
      </div>`;
    const board = root.querySelector('.blk-board'), g = board.getContext('2d');
    const mini = {};
    root.querySelectorAll('.blk-mini').forEach((c) => { mini[c.dataset.k] = c.getContext('2d'); });
    const stat = {};
    root.querySelectorAll('[data-k]').forEach((el) => { if (el.tagName === 'B') stat[el.dataset.k] = el; });
    const pauseBtn = root.querySelector('.blk-pause');

    // ---------- สถานะ ----------
    let grid, cur, nextT, holdT, canHold, bag = [];
    let score, lines, level, over, paused, clearing, clearT, acc, last, raf, alive = true;

    function draw7() {
      if (!bag.length) {
        bag = Object.keys(SHAPES);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = rnd(i + 1);
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      return bag.pop();
    }
    const rotate = (m, dir) => {
      const n = m.length, out = m.map(() => Array(n).fill(0));
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (dir > 0) out[c][n - 1 - r] = m[r][c]; else out[n - 1 - c][r] = m[r][c];
      }
      return out;
    };
    const spawn = (t) => ({ t, m: SHAPES[t].map((r) => r.slice()), x: Math.floor((W - SHAPES[t].length) / 2), y: t === 'I' ? -1 : 0 });
    function collides(p, m, x, y) {
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
        if (!m[r][c]) continue;
        const gx = x + c, gy = y + r;
        if (gx < 0 || gx >= W || gy >= H) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
      return false;
    }
    const interval = () => Math.max(70, 800 - (level - 1) * 65);

    function setStat(k, v) { stat[k].textContent = v; }

    function newPiece(t) {
      cur = spawn(t || nextT);
      if (!t) nextT = draw7();
      canHold = true;
      if (collides(cur, cur.m, cur.x, cur.y)) finish();
    }

    function reset() {
      grid = Array.from({ length: H }, () => Array(W).fill(''));
      score = 0; lines = 0; level = 1; over = false; paused = false; clearing = null; clearT = 0; acc = 0;
      holdT = null; bag = [];
      nextT = draw7();
      setStat('score', 0); setStat('level', 1); setStat('lines', 0);
      pauseBtn.textContent = 'หยุดชั่วคราว';
      newPiece();
      ctx.status('เริ่มเลย! เลื่อน ← → หมุน ↑');
    }

    // ---------- การกระทำ ----------
    function tryMove(dx, dy) {
      if (collides(cur, cur.m, cur.x + dx, cur.y + dy)) return false;
      cur.x += dx; cur.y += dy;
      return true;
    }
    function tryRotate(dir) {
      const m = rotate(cur.m, dir);
      for (const k of [0, -1, 1, -2, 2]) {   // ถ้าชนขอบ ลองเลื่อนข้างเล็กน้อย
        if (!collides(cur, m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; return; }
      }
    }
    function ghostY() {
      let y = cur.y;
      while (!collides(cur, cur.m, cur.x, y + 1)) y++;
      return y;
    }
    function lock() {
      for (let r = 0; r < cur.m.length; r++) for (let c = 0; c < cur.m.length; c++) {
        if (!cur.m[r][c]) continue;
        const gy = cur.y + r;
        if (gy < 0) { finish(); return; }
        grid[gy][cur.x + c] = cur.t;
      }
      const full = [];
      grid.forEach((row, i) => { if (row.every(Boolean)) full.push(i); });
      if (full.length) {
        clearing = full;
        clearT = 0;
        SFX.play(full.length === 4 ? 'tetris' : 'clear', full.length);
        if (full.length === 4) { FX.flash('#fde047'); FX.shake(board, 7); }
      } else {
        SFX.play('lock');
        newPiece();
      }
    }
    function finishClear() {
      const n = clearing.length;
      grid = grid.filter((_, i) => !clearing.includes(i));
      while (grid.length < H) grid.unshift(Array(W).fill(''));
      clearing = null;
      const gained = LINE_SCORE[n] * level;
      score += gained;
      lines += n;
      setStat('score', score); setStat('lines', lines);
      FX.float(board, n === 4 ? 'TETRIS! +' + gained : '+' + gained);
      if (n === 4) FX.burst(board);
      const lv = 1 + Math.floor(lines / 10);
      if (lv > level) {
        level = lv;
        setStat('level', level);
        ctx.status('ขึ้นระดับ ' + level + ' บล็อกตกเร็วขึ้น');
        setTimeout(() => SFX.play('levelup'), 350);
        FX.stars(board);
      }
      newPiece();
    }
    function finish() {
      over = true;
      let msg = `จบเกม — ${score} คะแนน`;
      if (score > best) {
        best = score;
        setStat('best', best);
        try { localStorage.setItem(KEY, String(best)); } catch (e) {}
        msg = `🎉 สถิติใหม่! ${score} คะแนน`;
      } else if (best) msg += ` (สถิติสูงสุด ${best})`;
      if (!msg.startsWith('🎉')) SFX.play('over');
      ctx.status(msg);
      ctx.finish({ outcome: 'finished', score });
    }

    function act(a) {
      if (over) return;
      if (a === 'pause') { setPause(!paused); return; }
      if (paused || clearing) return;
      if (a === 'left') { if (tryMove(-1, 0)) SFX.play('tick'); }
      else if (a === 'right') { if (tryMove(1, 0)) SFX.play('tick'); }
      else if (a === 'cw') { tryRotate(1); SFX.play('rot'); }
      else if (a === 'ccw') { tryRotate(-1); SFX.play('rot'); }
      else if (a === 'down') {
        if (tryMove(0, 1)) { score += 1; setStat('score', score); acc = 0; SFX.play('tick'); } else lock();
      } else if (a === 'drop') {
        SFX.play('thud');
        const y = ghostY();
        score += 2 * (y - cur.y);
        setStat('score', score);
        cur.y = y;
        FX.restart(board, 'blk-thud');
        lock();
      } else if (a === 'hold' && canHold) {
        SFX.play('swap');
        const t = cur.t;
        const swap = holdT;
        holdT = t;
        if (swap) { cur = spawn(swap); canHold = false; } else { newPiece(); canHold = false; }
      }
    }
    function setPause(p) {
      paused = p;
      pauseBtn.textContent = p ? 'เล่นต่อ' : 'หยุดชั่วคราว';
      ctx.status(p ? 'หยุดชั่วคราว' : 'เล่นต่อ');
    }

    // ---------- วาด ----------
    function cell(c2, x, y, s, color, alpha) {
      c2.globalAlpha = alpha || 1;
      c2.fillStyle = color;
      c2.fillRect(x + 1, y + 1, s - 2, s - 2);
      c2.fillStyle = 'rgba(255,255,255,.3)';
      c2.fillRect(x + 1, y + 1, s - 2, 4);
      c2.fillStyle = 'rgba(0,0,0,.25)';
      c2.fillRect(x + 1, y + s - 5, s - 2, 4);
      c2.globalAlpha = 1;
    }
    function drawMini(c2, t) {
      c2.clearRect(0, 0, 88, 88);
      if (!t) return;
      const m = SHAPES[t], s = 20;
      let r0 = 9, r1 = -1, c0 = 9, c1 = -1;
      m.forEach((row, r) => row.forEach((v, c) => {
        if (v) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
      }));
      const ox = (88 - (c1 - c0 + 1) * s) / 2, oy = (88 - (r1 - r0 + 1) * s) / 2;
      m.forEach((row, r) => row.forEach((v, c) => { if (v) cell(c2, ox + (c - c0) * s, oy + (r - r0) * s, s, COLORS[t]); }));
    }
    function render() {
      g.fillStyle = '#0f172a';
      g.fillRect(0, 0, W * S, H * S);
      g.strokeStyle = 'rgba(255,255,255,.05)';
      g.lineWidth = 1;
      for (let i = 1; i < W; i++) { g.beginPath(); g.moveTo(i * S + .5, 0); g.lineTo(i * S + .5, H * S); g.stroke(); }
      for (let i = 1; i < H; i++) { g.beginPath(); g.moveTo(0, i * S + .5); g.lineTo(W * S, i * S + .5); g.stroke(); }
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (grid[r][c]) cell(g, c * S, r * S, S, COLORS[grid[r][c]]);
      if (clearing) {
        const flash = Math.floor(clearT / 55) % 2 === 0;
        clearing.forEach((r) => {
          g.fillStyle = flash ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.45)';
          g.fillRect(0, r * S, W * S, S);
        });
      } else if (!over) {
        const gy = ghostY();
        for (let r = 0; r < cur.m.length; r++) for (let c = 0; c < cur.m.length; c++) {
          if (!cur.m[r][c]) continue;
          if (gy + r >= 0) cell(g, (cur.x + c) * S, (gy + r) * S, S, COLORS[cur.t], 0.22);
        }
        for (let r = 0; r < cur.m.length; r++) for (let c = 0; c < cur.m.length; c++) {
          if (cur.m[r][c] && cur.y + r >= 0) cell(g, (cur.x + c) * S, (cur.y + r) * S, S, COLORS[cur.t]);
        }
      }
      if (over || paused) {
        g.fillStyle = 'rgba(15,23,42,.72)';
        g.fillRect(0, 0, W * S, H * S);
        g.fillStyle = '#fff';
        g.font = '800 34px "Leelawadee UI","Noto Sans Thai",sans-serif';
        g.textAlign = 'center';
        g.fillText(over ? 'จบเกม' : 'หยุดชั่วคราว', W * S / 2, H * S / 2);
      }
      drawMini(mini.next, nextT);
      drawMini(mini.hold, holdT);
    }

    function frame(ts) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(ts - (last || ts), 100);
      last = ts;
      if (!over && !paused) {
        if (clearing) {
          clearT += dt;
          if (clearT >= 260) finishClear();
        } else {
          acc += dt;
          if (acc >= interval()) {
            acc = 0;
            if (!tryMove(0, 1)) lock();
          }
        }
      }
      render();
    }

    // ---------- ควบคุม ----------
    const KEYS = {
      ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
      ArrowDown: 'down', s: 'down', S: 'down', ArrowUp: 'cw', x: 'cw', X: 'cw', z: 'ccw', Z: 'ccw',
      ' ': 'drop', c: 'hold', C: 'hold', p: 'pause', P: 'pause', Escape: 'pause',
    };
    const REPEAT = { left: 1, right: 1, down: 1 };
    function onKey(e) {
      const t = e.target;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
      const a = KEYS[e.key];
      if (!a) return;
      e.preventDefault();
      if (e.repeat && !REPEAT[a]) return;
      act(a);
    }
    document.addEventListener('keydown', onKey);
    function onHide() { if (document.hidden && !over && !paused) setPause(true); }
    document.addEventListener('visibilitychange', onHide);

    // ปุ่มบนจอ: กดค้างเพื่อเลื่อนซ้ำ
    let holdTimer = 0, holdIv = 0;
    const stopHold = () => { clearTimeout(holdTimer); clearInterval(holdIv); };
    root.querySelectorAll('.blk-pad .btn').forEach((b) => {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        act(a);
        if (REPEAT[a]) {
          holdTimer = setTimeout(() => { holdIv = setInterval(() => act(a), 60); }, 170);
        }
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stopHold));
    });
    pauseBtn.addEventListener('click', () => act('pause'));

    reset();
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stopHold();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  },
});
