Games.push({
  id: 'reversi',
  name: 'Reversi',
  emoji: '⚫',
  desc: 'วางหมากล้อมแล้วพลิกสีฝั่งตรงข้าม',
  rules: 'วางหมากให้ล้อมหมากฝั่งตรงข้ามไว้ระหว่างหมากของเรา หมากที่ถูกล้อมจะพลิกเป็นสีเรา จุดเล็กๆ คือช่องที่วางได้ ถ้าไม่มีช่องวางจะข้ามตาอัตโนมัติ จบเกมเมื่อวางต่อไม่ได้ทั้งคู่ ใครมีหมากมากกว่าชนะ',
  create(root, ctx) {
    const N = 8;
    const bot = ctx.mode === 'bot';
    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    // ค่าน้ำหนักช่อง ให้บอทชอบมุมและเลี่ยงช่องติดมุม
    const W = [
      [100,-20,10,5,5,10,-20,100],
      [-20,-40,-2,-2,-2,-2,-40,-20],
      [10,-2,1,1,1,1,-2,10],
      [5,-2,1,0,0,1,-2,5],
      [5,-2,1,0,0,1,-2,5],
      [10,-2,1,1,1,1,-2,10],
      [-20,-40,-2,-2,-2,-2,-40,-20],
      [100,-20,10,5,5,10,-20,100],
    ];
    let b = Array.from({ length: N }, () => Array(N).fill(0));
    b[3][3] = 2; b[4][4] = 2; b[3][4] = 1; b[4][3] = 1;
    let turn = 1, over = false, alive = true, busy = false;
    let prev = b.map((row) => row.slice()), lastPlace = [3, 3];   // ไว้เทียบว่าช่องไหนวางใหม่/พลิก

    const label = (p) => (bot ? (p === 1 ? 'คุณ (ดำ)' : 'บอท (ขาว)') : p === 1 ? 'ผู้เล่น 1 (ดำ)' : 'ผู้เล่น 2 (ขาว)');

    function flips(r, c, p) {
      if (b[r][c]) return [];
      const out = [];
      for (const [dr, dc] of DIRS) {
        const line = [];
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === 3 - p) {
          line.push([rr, cc]);
          rr += dr; cc += dc;
        }
        if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === p) out.push(...line);
      }
      return out;
    }
    function moves(p) {
      const m = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const f = flips(r, c, p);
        if (f.length) m.push({ r, c, f });
      }
      return m;
    }
    const count = (p) => b.flat().filter((v) => v === p).length;

    root.innerHTML = '<div class="scorebar"></div><div class="grid rev"></div>';
    const bar = root.children[0], grid = root.children[1];
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const el = document.createElement('button');
      el.className = 'cell';
      el.addEventListener('click', () => human(r, c));
      grid.appendChild(el);
      cells.push(el);
    }

    function render() {
      const mv = !over && !(bot && turn === 2) ? moves(turn) : [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = b[r][c];
        const hint = mv.some((m) => m.r === r && m.c === c);
        let disc = '';
        if (v) {
          const cls = prev[r][c] === v ? '' : prev[r][c] ? ' flip' : ' new';
          const delay = cls === ' flip' ? Math.max(Math.abs(r - lastPlace[0]), Math.abs(c - lastPlace[1])) * 80 : 0;
          disc = `<span class="disc p${v}${cls}" style="animation-delay:${delay}ms"></span>`;
        }
        cells[r * N + c].innerHTML = disc || (hint ? '<span class="hint"></span>' : '');
        cells[r * N + c].setAttribute('aria-label', `แถว ${r + 1} คอลัมน์ ${c + 1}`);
      }
      prev = b.map((row) => row.slice());
      bar.innerHTML = `<span><span class="chip" style="background:#151515"></span>${label(1)}: ${count(1)}</span><span><span class="chip" style="background:#f4f4f0"></span>${label(2)}: ${count(2)}</span>`;
    }

    function finish() {
      over = true;
      const a = count(1), w = count(2);
      ctx.status(a === w ? `เสมอกัน ${a}-${w}` : `🎉 ${label(a > w ? 1 : 2)} ชนะ ${Math.max(a, w)}-${Math.min(a, w)}`);
      ctx.finish({ outcome: a === w ? 'draw' : a > w ? 'win' : 'lose' });
      render();
    }

    function place(r, c, p) {
      const f = flips(r, c, p);
      if (!f.length) return false;
      b[r][c] = p;
      lastPlace = [r, c];
      SFX.play('place');
      new Set(f.map(([fr, fc]) => Math.max(Math.abs(fr - r), Math.abs(fc - c)))).forEach((d) => {
        setTimeout(() => { if (alive) SFX.play('flip'); }, d * 80 + 60);   // เสียงพลิกไล่ตามวง
      });
      f.forEach(([fr, fc]) => { b[fr][fc] = p; });
      turn = 3 - p;
      let note = '';
      if (!moves(turn).length) {
        if (!moves(p).length) { finish(); return true; }
        note = `${label(turn)} ไม่มีช่องวาง ข้ามตา — `;
        turn = p;
      }
      ctx.status(note + 'ตาของ ' + label(turn));
      render();
      schedule();
      return true;
    }

    function schedule() {
      if (over || !bot || turn !== 2) return;
      busy = true;
      setTimeout(() => {
        if (!alive) return;
        busy = false;
        const m = moves(2);
        let best = m[0], bs = -Infinity;
        for (const x of m) {
          const s = W[x.r][x.c] * 3 + x.f.length + Math.random();
          if (s > bs) { bs = s; best = x; }
        }
        place(best.r, best.c, 2);
      }, 600);
    }

    function human(r, c) {
      if (over || busy || (bot && turn === 2)) return;
      place(r, c, turn);
    }

    ctx.status('ตาของ ' + label(1));
    render();
    return () => { alive = false; };
  },
});
