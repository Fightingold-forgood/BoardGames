Games.push({
  id: 'gomoku',
  name: 'โกะโมะคุ',
  emoji: '⚪',
  levels: true,
  desc: 'ต่อหมากให้ได้ 5 เม็ดเรียงกันบนกระดาน 15×15',
  rules: 'ผลัดกันวางหมากบนจุดว่าง ดำเริ่มก่อน ใครเรียงหมากของตัวเองได้ 5 เม็ดติดกัน (แนวตั้ง นอน หรือเฉียง) ก่อนชนะ ระวังแถว 3 และ 4 ที่ปลายเปิดของอีกฝ่าย ต้องรีบปิด',
  create(root, ctx) {
    const N = 15;
    const bot = ctx.mode === 'bot';
    const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const b = Array.from({ length: N }, () => Array(N).fill(0));
    let turn = 1, over = false, alive = true, last = null, winCells = [], moves = 0;

    const label = (p) => (bot ? (p === 1 ? 'คุณ (ดำ)' : 'บอท (ขาว)') : p === 1 ? 'ผู้เล่น 1 (ดำ)' : 'ผู้เล่น 2 (ขาว)');
    const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

    // นับหมากสี p ที่ต่อจาก (r,c) ไปทางเดียว
    function run(r, c, dr, dc, p) {
      let k = 0;
      for (let rr = r + dr, cc = c + dc; inside(rr, cc) && b[rr][cc] === p; rr += dr, cc += dc) k++;
      return k;
    }
    function fiveAt(r, c, p) {
      for (const [dr, dc] of DIRS) {
        const a = run(r, c, dr, dc, p), z = run(r, c, -dr, -dc, p);
        if (a + z + 1 >= 5) {
          const cells = [];
          for (let k = -z; k <= a; k++) cells.push([r + dr * k, c + dc * k]);
          return cells;
        }
      }
      return null;
    }

    // คะแนนถ้าสี p วางที่ (r,c): ยาวและปลายเปิดยิ่งดี
    const LINE = [[0, 0, 0], [0, 2, 10], [0, 20, 120], [0, 300, 5000], [0, 6000, 60000]];
    function cellScore(r, c, p) {
      let s = 0;
      for (const [dr, dc] of DIRS) {
        const a = run(r, c, dr, dc, p), z = run(r, c, -dr, -dc, p);
        const len = a + z + 1;
        if (len >= 5) return 1e7;
        const ea = inside(r + dr * (a + 1), c + dc * (a + 1)) && !b[r + dr * (a + 1)][c + dc * (a + 1)];
        const ez = inside(r - dr * (z + 1), c - dc * (z + 1)) && !b[r - dr * (z + 1)][c - dc * (z + 1)];
        s += LINE[len][(ea ? 1 : 0) + (ez ? 1 : 0)];
      }
      return s;
    }
    // ช่องว่างที่อยู่ใกล้หมากเดิมไม่เกิน 2 ช่อง
    function candidates() {
      if (!moves) return [[7, 7]];
      const out = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (b[r][c]) continue;
        let near = false;
        for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
          if (inside(r + dr, c + dc) && b[r + dr][c + dc]) { near = true; break; }
        }
        if (near) out.push([r, c]);
      }
      return out;
    }
    function ranked(me) {
      const DEF = ctx.level === 'easy' ? 0.5 : 0.9;   // ง่าย: ไม่ค่อยสนใจปิดทางคนเล่น
      return candidates().map(([r, c]) => ({ r, c, s: cellScore(r, c, me) + DEF * cellScore(r, c, 3 - me) }))
        .sort((x, y) => y.s - x.s);
    }
    function botMove() {
      const list = ranked(2);
      if (ctx.level === 'easy') return list[Math.floor(Math.random() * Math.min(5, list.length))];
      if (ctx.level !== 'hard') return list[0];
      // ยาก: ลองตาที่ดีที่สุด 8 ตา แล้วหักคะแนนตาตอบโต้ที่ดีที่สุดของคนเล่น
      let best = list[0], bs = -Infinity;
      for (const m of list.slice(0, 8)) {
        if (m.s >= 1e7) return m;
        b[m.r][m.c] = 2; moves++;
        const reply = ranked(1)[0];
        b[m.r][m.c] = 0; moves--;
        const v = m.s - (reply ? reply.s : 0) * 0.8;
        if (v > bs) { bs = v; best = m; }
      }
      return best;
    }

    root.innerHTML = '<div class="grid gomoku"></div>';
    const grid = root.firstChild, cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const el = document.createElement('button');
      el.className = 'cell';
      el.setAttribute('aria-label', `แถว ${r + 1} คอลัมน์ ${c + 1}`);
      el.addEventListener('click', () => human(r, c));
      grid.appendChild(el);
      cells.push(el);
    }

    function render() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = b[r][c];
        cells[r * N + c].className = 'cell' + (v ? ' p' + v : '')
          + (winCells.some(([wr, wc]) => wr === r && wc === c) ? ' win' : '')
          + (last && last[0] === r && last[1] === c ? ' last' : '');
      }
    }

    function place(r, c, p) {
      if (over || b[r][c]) return false;
      b[r][c] = p; moves++; last = [r, c];
      SFX.play('place');
      FX.ring(cells[r * N + c], p === 1 ? '#1f1a12' : '#f4f4f0');
      const w = fiveAt(r, c, p);
      if (w) {
        over = true; winCells = w;
        ctx.status('🎉 ' + label(p) + ' ชนะ!');
        ctx.finish({ outcome: p === 1 ? 'win' : 'lose' });
      } else if (moves === N * N) {
        over = true; ctx.status('เสมอกัน กระดานเต็มแล้ว'); ctx.finish({ outcome: 'draw' });
      } else {
        turn = 3 - p;
        ctx.status('ตาของ ' + label(turn));
      }
      render();
      return true;
    }

    function human(r, c) {
      if (over || (bot && turn === 2)) return;
      if (!place(r, c, turn)) return;
      if (!over && bot) {
        setTimeout(() => { if (alive && !over) { const m = botMove(); place(m.r, m.c, 2); } }, 400);
      }
    }

    ctx.status('ตาของ ' + label(1));
    render();
    return () => { alive = false; };
  },
});
