Games.push({
  id: 'mancala',
  name: 'หมากหลุม',
  emoji: '🥥',
  levels: true,
  desc: 'หยอดเม็ดลงหลุมทีละเม็ด เก็บเข้าบ้านให้ได้มากที่สุด',
  rules: 'กติกาแบบ Kalah: แต่ละฝ่ายมี 6 หลุม หลุมละ 4 เม็ด และบ้าน 1 หลุมทางขวามือ แตะหลุมฝั่งเราเพื่อหยิบเม็ดทั้งหมดไปหยอดทวนเข็มนาฬิกาทีละเม็ด (ข้ามบ้านฝั่งตรงข้าม) ถ้าเม็ดสุดท้ายลงบ้านตัวเองได้เล่นอีกตา ถ้าลงหลุมว่างฝั่งตัวเองและหลุมตรงข้ามมีเม็ด จะกินทั้งหมดเข้าบ้าน เกมจบเมื่อฝั่งใดหมดเม็ด เม็ดที่เหลือเป็นของฝั่งนั้น ใครมีเม็ดในบ้านมากกว่าชนะ',
  create(root, ctx) {
    // หลุม 0-5 ของผู้เล่น 1 (ล่าง), 6 บ้านผู้เล่น 1, 7-12 ของผู้เล่น 2 (บน), 13 บ้านผู้เล่น 2
    const bot = ctx.mode === 'bot';
    const STORE = { 1: 6, 2: 13 };
    const own = (i, p) => (p === 1 ? i >= 0 && i <= 5 : i >= 7 && i <= 12);
    const pitsOf = (p) => (p === 1 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
    let s = { pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], turn: 1 };
    let over = false, alive = true, busy = false;

    const label = (p) => (bot ? (p === 1 ? 'คุณ' : 'บอท') : 'ผู้เล่น ' + p);

    // คืนสถานะใหม่หลังหยิบหลุม i (ไม่แก้สถานะเดิม)
    function sow(st, i) {
      const pits = st.pits.slice(), p = st.turn;
      let k = pits[i], pos = i;
      pits[i] = 0;
      while (k > 0) {
        pos = (pos + 1) % 14;
        if (pos === STORE[3 - p]) continue;
        pits[pos]++; k--;
      }
      let captured = 0;
      if (own(pos, p) && pits[pos] === 1 && pits[12 - pos] > 0) {
        captured = pits[12 - pos] + 1;
        pits[STORE[p]] += captured;
        pits[pos] = 0; pits[12 - pos] = 0;
      }
      const next = { pits, turn: pos === STORE[p] ? p : 3 - p, captured, extra: pos === STORE[p] };
      // ฝั่งไหนหมดเม็ด เม็ดที่เหลือเข้าบ้านเจ้าของฝั่ง
      if (pitsOf(1).every((j) => !pits[j]) || pitsOf(2).every((j) => !pits[j])) {
        for (const q of [1, 2]) for (const j of pitsOf(q)) { pits[STORE[q]] += pits[j]; pits[j] = 0; }
        next.done = true;
      }
      return next;
    }
    const legal = (st) => pitsOf(st.turn).filter((j) => st.pits[j] > 0);

    // minimax จากมุมมองบอท (ผู้เล่น 2) ตาเล่นซ้ำไม่นับความลึก
    function search(st, depth, alpha, beta) {
      if (st.done || depth === 0) return st.pits[13] - st.pits[6];
      let best = st.turn === 2 ? -Infinity : Infinity;
      for (const j of legal(st)) {
        const n = sow(st, j);
        const v = search(n, n.extra ? depth : depth - 1, alpha, beta);
        if (st.turn === 2) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
        else { best = Math.min(best, v); beta = Math.min(beta, v); }
        if (alpha >= beta) break;
      }
      return best;
    }
    const DEPTH = { easy: 1, normal: 3, hard: 7 }[ctx.level] ?? 3;
    const NOISE = { easy: 4, normal: 0.5, hard: 0.1 }[ctx.level] ?? 0.5;
    function botPick() {
      let best = null, bs = -Infinity;
      for (const j of legal(s)) {
        const n = sow(s, j);
        const v = search(n, n.extra ? DEPTH : DEPTH - 1, -Infinity, Infinity) + Math.random() * NOISE;
        if (v > bs) { bs = v; best = j; }
      }
      return best;
    }

    root.innerHTML = '<div class="scorebar"></div><div class="mancala"></div>';
    const bar = root.children[0], board = root.children[1], els = [];
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('button');
      el.className = 'mpit' + (i === 6 || i === 13 ? ' store' : '');
      // ตำแหน่งบนกระดาน: บ้าน 2 ซ้าย บ้าน 1 ขวา หลุมบนเรียงจากขวาไปซ้าย
      if (i === 13) el.style.gridArea = '1 / 1 / 3 / 2';
      else if (i === 6) el.style.gridArea = '1 / 8 / 3 / 9';
      else if (i < 6) el.style.gridArea = `2 / ${i + 2}`;
      else el.style.gridArea = `1 / ${14 - i}`;
      el.addEventListener('click', () => human(i));
      board.appendChild(el);
      els.push(el);
    }

    function render() {
      const canPlay = !over && !busy && !(bot && s.turn === 2);
      for (let i = 0; i < 14; i++) {
        const el = els[i];
        el.textContent = s.pits[i];
        const store = i === 6 || i === 13;
        el.disabled = store || !canPlay || !own(i, s.turn) || !s.pits[i];
        el.setAttribute('aria-label', (store ? 'บ้านของ ' + label(i === 6 ? 1 : 2) : 'หลุม') + ' ' + s.pits[i] + ' เม็ด');
      }
      bar.innerHTML = `<span>${label(1)}: ${s.pits[6]}</span><span>${label(2)}: ${s.pits[13]}</span>`;
    }

    function play(i) {
      const p = s.turn;
      s = sow(s, i);
      SFX.play(s.captured ? 'capture' : 'place');
      if (s.captured) FX.burst(els[STORE[p]]);
      if (s.done) {
        over = true;
        const a = s.pits[6], z = s.pits[13];
        ctx.status(a === z ? `เสมอกัน ${a}-${z}` : `🎉 ${label(a > z ? 1 : 2)} ชนะ ${Math.max(a, z)}-${Math.min(a, z)}`);
        ctx.finish({ outcome: a === z ? 'draw' : a > z ? 'win' : 'lose' });
      } else {
        ctx.status((s.extra ? label(p) + ' ลงบ้าน ได้เล่นอีกตา — ' : '') + 'ตาของ ' + label(s.turn));
      }
      render();
      if (!over && bot && s.turn === 2) {
        busy = true;
        setTimeout(() => {
          if (!alive) return;
          busy = false;
          play(botPick());
        }, 700);
      }
    }

    function human(i) {
      if (over || busy || (bot && s.turn === 2) || !own(i, s.turn) || !s.pits[i]) return;
      play(i);
    }

    ctx.status('ตาของ ' + label(1));
    render();
    return () => { alive = false; };
  },
});
