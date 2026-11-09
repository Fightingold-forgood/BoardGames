Games.push({
  id: 'c4',
  name: 'Connect Four',
  emoji: '🔴',
  levels: true,
  desc: 'หยอดเหรียญให้ได้ 4 เม็ดเรียงกัน',
  rules: 'ผลัดกันหยอดเหรียญลงคอลัมน์ เหรียญจะตกลงถึงช่องล่างสุด ใครเรียงได้ 4 เม็ดติดกัน (แนวตั้ง นอน หรือเฉียง) ก่อนชนะ',
  create(root, ctx) {
    const R = 6, C = 7;
    const bot = ctx.mode === 'bot';
    let b = Array.from({ length: R }, () => Array(C).fill(0));
    let turn = 1, over = false, alive = true, last = null, winCells = [];

    const label = (p) => (bot ? (p === 1 ? 'คุณ (แดง)' : 'บอท (เหลือง)') : p === 1 ? 'ผู้เล่น 1 (แดง)' : 'ผู้เล่น 2 (เหลือง)');

    function drop(col, p) {
      for (let r = R - 1; r >= 0; r--) {
        if (!b[r][col]) { b[r][col] = p; return r; }
      }
      return -1;
    }
    function undo(col) {
      for (let r = 0; r < R; r++) {
        if (b[r][col]) { b[r][col] = 0; return; }
      }
    }
    function findWin(p) {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (b[r][c] !== p) continue;
        for (const [dr, dc] of dirs) {
          const cells = [];
          for (let k = 0; k < 4; k++) {
            const rr = r + dr * k, cc = c + dc * k;
            if (rr < 0 || rr >= R || cc < 0 || cc >= C || b[rr][cc] !== p) break;
            cells.push([rr, cc]);
          }
          if (cells.length === 4) return cells;
        }
      }
      return null;
    }
    const validCols = () => [...Array(C).keys()].filter((c) => !b[0][c]);
    const wins = (col, p) => { drop(col, p); const w = !!findWin(p); undo(col); return w; };

    // ให้คะแนนกระดานจากมุมมองบอท (2): นับทุกหน้าต่าง 4 ช่องที่ยังไม่ถูกอีกฝ่ายปิด
    function evalBoard() {
      let s = 0;
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (b[r][c] === 2 && c === 3) s += 3;   // ชอบคอลัมน์กลาง
        for (const [dr, dc] of dirs) {
          const er = r + dr * 3, ec = c + dc * 3;
          if (er < 0 || er >= R || ec < 0 || ec >= C) continue;
          let me = 0, op = 0;
          for (let k = 0; k < 4; k++) {
            const v = b[r + dr * k][c + dc * k];
            if (v === 2) me++; else if (v === 1) op++;
          }
          if (op === 0) s += [0, 1, 5, 50][me] || 0;
          else if (me === 0) s -= [0, 1, 6, 80][op] || 0;
        }
      }
      return s;
    }
    const ORDER = [3, 2, 4, 1, 5, 0, 6];   // ลองคอลัมน์กลางก่อน ทำให้ตัดกิ่งได้เร็ว
    function search(depth, alpha, beta, p) {
      const cols = ORDER.filter((c) => !b[0][c]);
      if (!cols.length) return 0;
      if (depth === 0) return evalBoard();
      let best = p === 2 ? -Infinity : Infinity;
      for (const c of cols) {
        drop(c, p);
        const v = findWin(p) ? (p === 2 ? 100000 + depth : -100000 - depth) : search(depth - 1, alpha, beta, 3 - p);
        undo(c);
        if (p === 2) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
        else { best = Math.min(best, v); beta = Math.min(beta, v); }
        if (alpha >= beta) break;
      }
      return best;
    }

    function botCol() {
      const cols = validCols();
      if (ctx.level === 'easy' && Math.random() < 0.7) return cols[Math.floor(Math.random() * cols.length)];
      if (ctx.level === 'hard') {
        let bestC = cols[0], bs = -Infinity;
        for (const c of ORDER.filter((x) => !b[0][x])) {
          drop(c, 2);
          const v = findWin(2) ? Infinity : search(5, -Infinity, Infinity, 1);
          undo(c);
          if (v > bs) { bs = v; bestC = c; }
        }
        return bestC;
      }
      for (const c of cols) if (wins(c, 2)) return c;   // ชนะเลย
      for (const c of cols) if (wins(c, 1)) return c;   // บล็อกคนเล่น
      // เลี่ยงช่องที่ทำให้อีกฝ่ายชนะบนเหรียญนี้
      const safe = cols.filter((c) => {
        drop(c, 2);
        const bad = b[0][c] === 0 ? wins(c, 1) : false;
        undo(c);
        return !bad;
      });
      const pool = safe.length ? safe : cols;
      const weights = pool.map((c) => 4 - Math.abs(3 - c) + Math.random() * 2);
      return pool[weights.indexOf(Math.max(...weights))];
    }

    root.innerHTML = '<div class="grid c4"></div>';
    const grid = root.firstChild;
    const cells = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const el = document.createElement('button');
      el.className = 'cell';
      el.setAttribute('aria-label', 'คอลัมน์ ' + (c + 1));
      el.style.setProperty('--r', r);   // ใช้คำนวณระยะที่เหรียญตกลงมา
      el.addEventListener('click', () => human(c));
      grid.appendChild(el);
      cells.push(el);
    }

    function render() {
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const v = b[r][c];
        const isWin = winCells.some(([wr, wc]) => wr === r && wc === c);
        cells[r * C + c].className = 'cell' + (v ? ' p' + v : '') + (isWin ? ' win' : '') + (last && last[0] === r && last[1] === c ? ' last' : '');
      }
    }

    function move(col, p) {
      const r = drop(col, p);
      if (r < 0) return false;
      last = [r, col];
      setTimeout(() => {   // เสียงและวงคลื่นตอนเหรียญกระแทกพื้น (ตรงกับแอนิเมชันตก)
        if (!alive) return;
        SFX.play('drop');
        FX.ring(cells[r * C + col], p === 1 ? '#d6453d' : '#e9b52f');
      }, 330);
      const w = findWin(p);
      if (w) {
        over = true; winCells = w;
        ctx.status('🎉 ' + label(p) + ' ชนะ!');
        ctx.finish({ outcome: p === 1 ? 'win' : 'lose' });
      } else if (!validCols().length) {
        over = true; ctx.status('เสมอกัน กระดานเต็มแล้ว'); ctx.finish({ outcome: 'draw' });
      } else {
        turn = p === 1 ? 2 : 1;
        ctx.status('ตาของ ' + label(turn));
      }
      render();
      return true;
    }

    function human(col) {
      if (over || (bot && turn === 2)) return;
      if (!move(col, turn)) return;
      if (!over && bot && turn === 2) {
        setTimeout(() => { if (alive && !over) move(botCol(), 2); }, 500);
      }
    }

    ctx.status('ตาของ ' + label(1));
    render();
    return () => { alive = false; };
  },
});
