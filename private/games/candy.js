Games.push({
  id: 'candy',
  name: 'จับคู่ขนม',
  emoji: '🍬',
  solo: true,
  desc: 'สลับขนมให้เรียง 3 ชิ้นขึ้นไป ทำคอมโบให้ได้คะแนนสูงสุด',
  rules: 'แตะขนมแล้วแตะชิ้นข้างๆ หรือลากนิ้ว/เมาส์ไปทางที่ต้องการเพื่อสลับ ต้องสลับแล้วเรียงได้ 3 ชิ้นขึ้นไปในแนวนอนหรือแนวตั้งจึงจะนับเป็น 1 ตา (สลับแล้วไม่ติดจะเด้งกลับและไม่เสียตา) มี 30 ตา เรียง 4 ชิ้นได้ขนมลายทางที่ระเบิดทั้งแถวหรือทั้งคอลัมน์ เรียง 5 ชิ้นขึ้นไปได้ 🌈 ที่สลับกับขนมชนิดไหนก็เก็บขนมชนิดนั้นทั้งกระดาน ขนมที่หล่นลงมาแล้วเรียงกันเองจะเป็นคอมโบ ยิ่งต่อเนื่องคะแนนยิ่งคูณ ทำคะแนนถึง 1,500 / 3,000 / 5,000 ได้ ⭐ 1-3 ดวง ใช้คีย์บอร์ดได้: ลูกศรเลื่อนเคอร์เซอร์ Enter หรือ Space เลือก/สลับ',
  create(root, ctx) {
    const N = 8, MOVES = 30, STARS = [1500, 3000, 5000];
    const TYPES = ['🍓', '🍊', '🍋', '🍏', '🍇', '🍬'];
    const KEY = 'bg-candy-best';
    const rnd = (k) => Math.floor(Math.random() * k);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let best = 0;
    try { best = Number(localStorage.getItem(KEY)) || 0; } catch (e) {}

    root.innerHTML = `
      <div class="cn">
        <div class="cn-hud">
          <div><span>คะแนน</span><b data-k="score">0</b></div>
          <div><span>ตาที่เหลือ</span><b data-k="moves">${MOVES}</b></div>
          <div><span>สถิติสูงสุด</span><b data-k="best">${best}</b></div>
        </div>
        <div class="cn-stars" aria-label="ความคืบหน้าดาว">
          <div class="cn-bar"><i></i></div>
          <span class="cn-star">⭐</span><span class="cn-star">⭐</span><span class="cn-star">⭐</span>
        </div>
        <div class="cn-board" tabindex="0" role="application" aria-label="กระดานจับคู่ขนม ใช้ลูกศรและ Enter">
          <div class="cn-cursor" hidden></div>
          <div class="cn-over" hidden></div>
        </div>
      </div>`;
    const boardEl = root.querySelector('.cn-board'), cursorEl = root.querySelector('.cn-cursor');
    const overEl = root.querySelector('.cn-over'), barEl = root.querySelector('.cn-bar i');
    const starEls = root.querySelectorAll('.cn-star');
    const hud = {};
    root.querySelectorAll('.cn-hud b').forEach((b) => { hud[b.dataset.k] = b; });

    let grid = [], busy = true, alive = true, score = 0, moves = MOVES, sel = null, uid = 0;
    let hintTimer = 0, hintTiles = [], kb = { r: 0, c: 0 }, starsShown = 0;

    // ---------- ตัวขนม ----------
    function paint(tile) {
      tile.el.className = 'cn-tile' + (tile.s === 'b' ? ' bomb' : tile.s ? ' s' + tile.s : '');
      tile.el.textContent = tile.s === 'b' ? '🌈' : TYPES[tile.t];
    }
    function place(tile, r, c) {
      tile.el.style.left = c * 12.5 + '%';
      tile.el.style.top = r * 12.5 + '%';
    }
    function mk(r, c, t) {
      const el = document.createElement('div');
      const tile = { id: ++uid, t, s: null, el };
      tile.el = el;
      paint(tile);
      place(tile, r, c);
      boardEl.appendChild(el);
      return tile;
    }
    const tt = (r, c) => (grid[r][c] && grid[r][c].s !== 'b' ? grid[r][c].t : -1);

    function findMatches() {
      const runs = [];
      for (let r = 0; r < N; r++) {
        let c = 0;
        while (c < N) {
          const t = tt(r, c);
          if (t < 0) { c++; continue; }
          let e = c;
          while (e + 1 < N && tt(r, e + 1) === t) e++;
          if (e - c >= 2) runs.push({ dir: 'h', cells: Array.from({ length: e - c + 1 }, (_, i) => [r, c + i]) });
          c = e + 1;
        }
      }
      for (let c = 0; c < N; c++) {
        let r = 0;
        while (r < N) {
          const t = tt(r, c);
          if (t < 0) { r++; continue; }
          let e = r;
          while (e + 1 < N && tt(e + 1, c) === t) e++;
          if (e - r >= 2) runs.push({ dir: 'v', cells: Array.from({ length: e - r + 1 }, (_, i) => [r + i, c]) });
          r = e + 1;
        }
      }
      const set = new Set();
      runs.forEach((run) => run.cells.forEach(([r, c]) => set.add(r * N + c)));
      return { runs, set };
    }

    function swapData(a, b) {
      const ta = grid[a.r][a.c], tb = grid[b.r][b.c];
      grid[a.r][a.c] = tb; grid[b.r][b.c] = ta;
      place(tb, a.r, a.c); place(ta, b.r, b.c);
    }

    // หาคู่ที่สลับแล้วเดินได้ (ใช้ทั้งตรวจว่ากระดานตันและให้คำใบ้)
    function findMove() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= N || c2 >= N) continue;
          const a = { r, c }, b = { r: r2, c: c2 };
          if (grid[r][c].s === 'b' || grid[r2][c2].s === 'b') return [a, b];
          const ta = grid[r][c], tb = grid[r2][c2];
          grid[r][c] = tb; grid[r2][c2] = ta;
          const ok = findMatches().set.size > 0;
          grid[r][c] = ta; grid[r2][c2] = tb;
          if (ok) return [a, b];
        }
      }
      return null;
    }

    // ---------- เอฟเฟกต์ ----------
    function lineFlash(dir, r, c) {
      SFX.play('whoosh');
      const d = document.createElement('div');
      d.className = 'cn-flash';
      if (dir === 'h') { d.style.left = '0'; d.style.top = r * 12.5 + '%'; d.style.width = '100%'; d.style.height = '12.5%'; }
      else { d.style.top = '0'; d.style.left = c * 12.5 + '%'; d.style.height = '100%'; d.style.width = '12.5%'; }
      boardEl.appendChild(d);
      setTimeout(() => d.remove(), 400);
    }
    function setHud() {
      hud.score.textContent = score;
      hud.moves.textContent = moves;
      barEl.style.width = Math.min(100, score / STARS[2] * 100) + '%';
      const n = STARS.filter((s) => score >= s).length;
      starEls.forEach((el, i) => el.classList.toggle('on', i < n));
      if (n > starsShown) {
        starsShown = n;
        FX.float(boardEl, `⭐ ดาวดวงที่ ${n}!`);
        SFX.play('star');
        FX.stars(boardEl);
      }
    }

    // ---------- เคลียร์ ตกลง เติมใหม่ ----------
    async function pop(clear, keep, combo) {
      const q = [...clear];
      for (let i = 0; i < q.length; i++) {   // ขนมลายทางที่ถูกเคลียร์จะระเบิดต่อทั้งแถว/คอลัมน์
        const idx = q[i], r = (idx / N) | 0, c = idx % N, tl = grid[r][c];
        if (!tl || (tl.s !== 'h' && tl.s !== 'v')) continue;
        for (let k = 0; k < N; k++) {
          const j = tl.s === 'h' ? r * N + k : k * N + c;
          if (!clear.has(j)) { clear.add(j); keep.delete(j); q.push(j); }
        }
        lineFlash(tl.s, r, c);
      }
      score += clear.size * 10 * combo;
      SFX.play('pop', combo);   // คอมโบยิ่งสูง เสียงยิ่งแหลมขึ้น
      if (keep.size) setTimeout(() => SFX.play('special'), 120);
      clear.forEach((idx) => {
        const tl = grid[(idx / N) | 0][idx % N];
        if (!tl) return;
        tl.el.classList.add('pop');
        if (tl.s) FX.burst(tl.el);
      });
      keep.forEach((s, idx) => {
        const tl = grid[(idx / N) | 0][idx % N];
        tl.s = s;
        if (s === 'b') tl.t = -1;
        paint(tl);
        tl.el.classList.add('born');
        FX.burst(tl.el);
      });
      setHud();
      await sleep(240);
      if (!alive) return;
      clear.forEach((idx) => {
        const r = (idx / N) | 0, c = idx % N;
        if (grid[r][c]) { grid[r][c].el.remove(); grid[r][c] = null; }
      });
      const fresh = [];
      for (let c = 0; c < N; c++) {
        let w = N - 1;
        for (let r = N - 1; r >= 0; r--) {
          const tl = grid[r][c];
          if (!tl) continue;
          if (r !== w) { grid[w][c] = tl; grid[r][c] = null; place(tl, w, c); }
          w--;
        }
        const k = w + 1;
        for (let r = w; r >= 0; r--) {
          const tl = mk(r - k, c, rnd(TYPES.length));
          grid[r][c] = tl;
          fresh.push([tl, r, c]);
        }
      }
      void boardEl.offsetWidth;   // ให้เบราว์เซอร์จัดวางตำแหน่งเริ่มต้นก่อน แล้วค่อยเลื่อนลงเป็นแอนิเมชัน
      fresh.forEach(([tl, r, c]) => place(tl, r, c));
      await sleep(320);
    }

    async function cascade(m, swapped, combo) {
      while (m.set.size && alive) {
        if (combo >= 2) FX.float(boardEl, `คอมโบ ×${combo}`);
        if (combo >= 3) { FX.flash('#fff'); FX.shake(boardEl, 3 + combo); }
        const keep = new Map();
        for (const run of m.runs) {
          if (run.cells.length < 4) continue;
          const pos = run.cells.find(([r, c]) => swapped && swapped.some(([a, b]) => a === r && b === c))
            || run.cells[Math.floor(run.cells.length / 2)];
          keep.set(pos[0] * N + pos[1], run.cells.length >= 5 ? 'b' : run.dir === 'h' ? 'v' : 'h');
        }
        swapped = null;
        const clear = new Set(m.set);
        keep.forEach((_, i) => clear.delete(i));
        await pop(clear, keep, combo);
        combo++;
        m = findMatches();
      }
    }

    async function useBomb(a, b) {
      const ta = grid[a.r][a.c], tb = grid[b.r][b.c];
      const bomb = ta.s === 'b' ? ta : tb, other = bomb === ta ? tb : ta;
      const clear = new Set();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const tl = grid[r][c];
        if (tl === bomb || other.s === 'b' || (tl.s !== 'b' && tl.t === other.t)) clear.add(r * N + c);
      }
      FX.float(boardEl, '🌈');
      SFX.play('boom');
      FX.flash('#fff');
      FX.shake(boardEl, 7);
      await pop(clear, new Map(), 1);
      await cascade(findMatches(), null, 2);
    }

    // ---------- ตาเดิน ----------
    function clearHint() {
      clearTimeout(hintTimer);
      hintTiles.forEach((t) => t.el.classList.remove('hint'));
      hintTiles = [];
    }
    function armHint() {
      clearHint();
      hintTimer = setTimeout(() => {
        const mv = findMove();
        if (!mv || busy) return;
        hintTiles = mv.map((p) => grid[p.r][p.c]);
        hintTiles.forEach((t) => t.el.classList.add('hint'));
      }, 7000);
    }
    function select(p) {
      deselect();
      sel = p;
      grid[p.r][p.c].el.classList.add('sel');
    }
    function deselect() {
      if (sel && grid[sel.r][sel.c]) grid[sel.r][sel.c].el.classList.remove('sel');
      sel = null;
    }

    async function trySwap(a, b) {
      if (busy) return;
      clearHint();
      deselect();
      busy = true;
      SFX.play('swap');
      swapData(a, b);
      await sleep(200);
      if (!alive) return;
      const ta = grid[a.r][a.c], tb = grid[b.r][b.c];
      if (ta.s === 'b' || tb.s === 'b') {
        moves--;
        setHud();
        await useBomb(a, b);
      } else {
        const m = findMatches();
        if (!m.set.size) {   // สลับแล้วไม่ติด เด้งกลับ ไม่เสียตา
          swapData(a, b);
          SFX.play('nope');
          [ta, tb].forEach((t) => FX.restart(t.el, 'nope'));
          await sleep(220);
          busy = false;
          armHint();
          return;
        }
        moves--;
        setHud();
        await cascade(m, [[a.r, a.c], [b.r, b.c]], 1);
      }
      if (!alive) return;
      if (moves <= 0) { finish(); return; }
      if (!findMove()) await reshuffle();
      busy = false;
      armHint();
    }

    async function reshuffle() {
      FX.float(boardEl, 'ไม่มีทางเดิน สลับกระดานใหม่');
      SFX.play('whoosh');
      const tiles = grid.flat();
      for (let tries = 0; tries < 60; tries++) {
        for (let i = tiles.length - 1; i > 0; i--) {
          const j = rnd(i + 1);
          [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }
        tiles.forEach((tl, i) => { grid[(i / N) | 0][i % N] = tl; });
        if (!findMatches().set.size && findMove()) break;
      }
      tiles.forEach((tl, i) => place(tl, (i / N) | 0, i % N));
      await sleep(350);
    }

    function finish() {
      busy = true;
      clearHint();
      const stars = STARS.filter((s) => score >= s).length;
      const record = score > best;
      if (record) {
        best = score;
        hud.best.textContent = best;
        try { localStorage.setItem(KEY, String(best)); } catch (e) {}
      }
      overEl.hidden = false;
      overEl.innerHTML = `<b>หมดตาแล้ว</b><span>${'⭐'.repeat(stars) || 'ยังไม่ได้ดาว'}</span><span>${score} คะแนน</span>`;
      const text = `จบเกม — ${score} คะแนน ${'⭐'.repeat(stars)}`;
      if (!record && !stars) SFX.play('over');
      ctx.status(record || stars ? `🎉 ${record ? 'สถิติใหม่! ' : ''}${text}` : text);
      ctx.finish({ outcome: 'finished', score });
    }

    // ---------- การควบคุม ----------
    function cellAt(e) {
      const rect = boardEl.getBoundingClientRect();
      const c = Math.floor((e.clientX - rect.left) / rect.width * N);
      const r = Math.floor((e.clientY - rect.top) / rect.height * N);
      return r >= 0 && r < N && c >= 0 && c < N ? { r, c } : null;
    }
    function tap(p) {
      if (busy) return;
      if (!sel) { select(p); return; }
      if (sel.r === p.r && sel.c === p.c) { deselect(); return; }
      if (Math.abs(sel.r - p.r) + Math.abs(sel.c - p.c) === 1) trySwap(sel, p);
      else select(p);
    }
    let down = null;
    boardEl.addEventListener('pointerdown', (e) => {
      if (busy) return;
      const p = cellAt(e);
      if (p) down = { x: e.clientX, y: e.clientY, p };
    });
    boardEl.addEventListener('pointerup', (e) => {
      const d = down;
      down = null;
      if (!d || busy) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) < 16) { tap(d.p); return; }
      const horiz = Math.abs(dx) > Math.abs(dy);
      const to = { r: d.p.r + (horiz ? 0 : Math.sign(dy)), c: d.p.c + (horiz ? Math.sign(dx) : 0) };
      if (to.r >= 0 && to.r < N && to.c >= 0 && to.c < N) trySwap(d.p, to);
    });
    boardEl.addEventListener('pointercancel', () => { down = null; });

    function moveCursor() {
      cursorEl.hidden = false;
      cursorEl.style.left = kb.c * 12.5 + '%';
      cursorEl.style.top = kb.r * 12.5 + '%';
    }
    boardEl.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (d) {
        e.preventDefault();
        kb.r = Math.max(0, Math.min(N - 1, kb.r + d[0]));
        kb.c = Math.max(0, Math.min(N - 1, kb.c + d[1]));
        moveCursor();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tap({ r: kb.r, c: kb.c });
        moveCursor();
      }
    });
    boardEl.addEventListener('blur', () => { cursorEl.hidden = true; });

    // ---------- เริ่มเกม ----------
    function build() {
      for (let tries = 0; tries < 100; tries++) {
        grid.flat().forEach((tl) => tl && tl.el.remove());
        grid = Array.from({ length: N }, () => Array(N).fill(null));
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          let t;
          do {
            t = rnd(TYPES.length);
          } while ((c >= 2 && tt(r, c - 1) === t && tt(r, c - 2) === t) || (r >= 2 && tt(r - 1, c) === t && tt(r - 2, c) === t));
          grid[r][c] = mk(r, c, t);
        }
        if (findMove()) return;
      }
    }
    build();
    setHud();
    busy = false;
    armHint();
    ctx.status('สลับขนมที่อยู่ติดกันให้เรียง 3 ชิ้นขึ้นไป');
    return () => { alive = false; clearHint(); };
  },
});
