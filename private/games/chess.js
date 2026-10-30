Games.push({
  id: 'chess',
  name: 'หมากรุกสากล',
  emoji: '♞',
  desc: 'หมากรุกสากล (Chess) สู้กับบอทหรือเพื่อน',
  rules: 'ขาวเดินก่อน แตะหมากของเราเพื่อดูช่องที่เดินได้ แล้วแตะช่องปลายทาง รองรับกติกาเต็ม: เข้าป้อม (castling), กินผ่าน (en passant) และเบี้ยเลื่อนขั้นเป็นฝ่าเสมอ ฝ่ายที่รุกจนอีกฝ่ายไม่มีทางหนีคือผู้ชนะ (รุกจน) ถ้าไม่มีตาเดินแต่ไม่ถูกรุกคือเสมอ (stalemate) บอทเล่นสีดำ',
  create(root, ctx) {
    const bot = ctx.mode === 'bot';
    const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
    const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
    const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const DG = [[-1,-1],[-1,1],[1,-1],[1,1]];
    const ST = [[-1,0],[1,0],[0,-1],[0,1]];

    const init = () => {
      const b = Array(64).fill(null);
      const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
      for (let c = 0; c < 8; c++) {
        b[c] = 'b' + back[c]; b[8 + c] = 'bP';
        b[48 + c] = 'wP'; b[56 + c] = 'w' + back[c];
      }
      return { b, turn: 'w', rights: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1 };
    };

    const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

    function attacked(b, sq, by) {
      const r = (sq >> 3), c = sq & 7;
      const pr = by === 'w' ? r + 1 : r - 1;
      for (const dc of [-1, 1]) if (inb(pr, c + dc) && b[pr * 8 + c + dc] === by + 'P') return true;
      for (const [dr, dc] of KN) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'N') return true;
      for (const [dr, dc] of KG) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'K') return true;
      for (const [dirs, kinds] of [[DG, 'BQ'], [ST, 'RQ']]) {
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (inb(rr, cc)) {
            const p = b[rr * 8 + cc];
            if (p) { if (p[0] === by && kinds.includes(p[1])) return true; break; }
            rr += dr; cc += dc;
          }
        }
      }
      return false;
    }
    const kingSq = (b, col) => b.indexOf(col + 'K');
    const inCheck = (s, col) => attacked(s.b, kingSq(s.b, col), col === 'w' ? 'b' : 'w');

    function pseudo(s) {
      const { b, turn, rights, ep } = s, foe = turn === 'w' ? 'b' : 'w', out = [];
      for (let i = 0; i < 64; i++) {
        const p = b[i];
        if (!p || p[0] !== turn) continue;
        const r = i >> 3, c = i & 7, t = p[1];
        if (t === 'P') {
          const d = turn === 'w' ? -1 : 1, start = turn === 'w' ? 6 : 1, last = turn === 'w' ? 0 : 7;
          const add = (to, extra) => out.push(Object.assign({ from: i, to, promo: (to >> 3) === last }, extra));
          if (inb(r + d, c) && !b[(r + d) * 8 + c]) {
            add((r + d) * 8 + c);
            if (r === start && !b[(r + 2 * d) * 8 + c]) add((r + 2 * d) * 8 + c);
          }
          for (const dc of [-1, 1]) {
            if (!inb(r + d, c + dc)) continue;
            const to = (r + d) * 8 + c + dc;
            if (b[to] && b[to][0] === foe) add(to);
            else if (to === ep) add(to, { ep: true });
          }
        } else if (t === 'N' || t === 'K') {
          for (const [dr, dc] of t === 'N' ? KN : KG) {
            if (!inb(r + dr, c + dc)) continue;
            const to = (r + dr) * 8 + c + dc;
            if (!b[to] || b[to][0] === foe) out.push({ from: i, to });
          }
          if (t === 'K') {
            const home = turn === 'w' ? 60 : 4;
            if (i === home && !attacked(b, home, foe)) {
              if (rights[turn + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === turn + 'R' && !attacked(b, home + 1, foe))
                out.push({ from: i, to: home + 2, castle: 'K' });
              if (rights[turn + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === turn + 'R' && !attacked(b, home - 1, foe))
                out.push({ from: i, to: home - 2, castle: 'Q' });
            }
          }
        } else {
          const dirs = t === 'B' ? DG : t === 'R' ? ST : KG;
          for (const [dr, dc] of dirs) {
            let rr = r + dr, cc = c + dc;
            while (inb(rr, cc)) {
              const to = rr * 8 + cc;
              if (b[to]) { if (b[to][0] === foe) out.push({ from: i, to }); break; }
              out.push({ from: i, to });
              rr += dr; cc += dc;
            }
          }
        }
      }
      return out;
    }

    function apply(s, m) {
      const b = s.b.slice(), p = b[m.from], col = s.turn;
      const rights = Object.assign({}, s.rights);
      b[m.to] = m.promo ? col + 'Q' : p;
      b[m.from] = null;
      if (m.ep) b[(m.from >> 3) * 8 + (m.to & 7)] = null;
      if (m.castle) {
        const home = m.from;
        if (m.castle === 'K') { b[home + 1] = b[home + 3]; b[home + 3] = null; }
        else { b[home - 1] = b[home - 4]; b[home - 4] = null; }
      }
      if (p[1] === 'K') rights[col + 'K'] = rights[col + 'Q'] = 0;
      for (const sq of [m.from, m.to]) {
        if (sq === 63) rights.wK = 0;
        if (sq === 56) rights.wQ = 0;
        if (sq === 7) rights.bK = 0;
        if (sq === 0) rights.bQ = 0;
      }
      const dbl = p[1] === 'P' && Math.abs(m.to - m.from) === 16;
      return { b, turn: col === 'w' ? 'b' : 'w', rights, ep: dbl ? (m.from + m.to) / 2 : -1 };
    }

    function legal(s) {
      return pseudo(s).filter((m) => !inCheck(apply(s, m), s.turn));
    }

    // ---------- บอท ----------
    function evalW(b) {
      let sc = 0;
      for (let i = 0; i < 64; i++) {
        const p = b[i];
        if (!p) continue;
        const r = i >> 3, c = i & 7, t = p[1], w = p[0] === 'w';
        let v = VAL[t];
        const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
        if (t === 'N' || t === 'B') v += centre * 8;
        else if (t === 'P') v += (w ? 6 - r : r - 1) * 6 + centre * 3;
        else if (t === 'Q') v += centre * 2;
        sc += w ? v : -v;
      }
      return sc;
    }
    function ordered(s) {
      return legal(s).map((m) => {
        const cap = s.b[m.to];
        return { m, k: (cap ? VAL[cap[1]] * 10 - VAL[s.b[m.from][1]] : 0) + (m.promo ? 800 : 0) };
      }).sort((x, y) => y.k - x.k).map((x) => x.m);
    }
    function search(s, depth, alpha, beta, ply) {
      const ms = ordered(s);
      if (!ms.length) return inCheck(s, s.turn) ? -100000 + ply : 0;
      if (depth === 0) return (s.turn === 'w' ? 1 : -1) * evalW(s.b);
      let best = -Infinity;
      for (const m of ms) {
        const v = -search(apply(s, m), depth - 1, -beta, -alpha, ply + 1);
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    function pickMove(s) {
      let best = null, bs = -Infinity;
      for (const m of ordered(s)) {
        const v = -search(apply(s, m), 2, -Infinity, Infinity, 1) + Math.random() * 6;
        if (v > bs) { bs = v; best = m; }
      }
      return best;
    }

    // ---------- UI ----------
    let s = init(), sel = -1, targets = [], last = null, over = false, alive = true, busy = false;
    let slideMove = null;   // ตาที่เพิ่งเดิน ใช้เล่นแอนิเมชันหมากเลื่อน
    const name = (col) => (bot ? (col === 'w' ? 'คุณ (ขาว)' : 'บอท (ดำ)') : col === 'w' ? 'ขาว' : 'ดำ');

    root.innerHTML = '<div class="grid chess" role="grid"></div>';
    const grid = root.firstChild, cells = [];
    for (let i = 0; i < 64; i++) {
      const el = document.createElement('button');
      el.className = 'sq ' + ((((i >> 3) + (i & 7)) & 1) ? 'd' : 'l');
      el.addEventListener('click', () => click(i));
      grid.appendChild(el);
      cells.push(el);
    }

    function render() {
      const chk = inCheck(s, s.turn) ? kingSq(s.b, s.turn) : -1;
      for (let i = 0; i < 64; i++) {
        const p = s.b[i], el = cells[i];
        el.className = 'sq ' + ((((i >> 3) + (i & 7)) & 1) ? 'd' : 'l')
          + (i === sel ? ' sel' : '') + (targets.includes(i) ? (p ? ' cap' : ' tgt') : '')
          + (last && (i === last.from || i === last.to) ? ' last' : '') + (i === chk ? ' chk' : '');
        // สร้างตัวหมากใหม่เฉพาะเมื่อช่องเปลี่ยน เพื่อให้แอนิเมชันเล่นแค่ตอนหมากลงช่อง
        if (el._k !== (p || '')) {
          el._k = p || '';
          el.innerHTML = p ? `<span class="pc ${p[0]}">${GLYPH[p[1]]}︎</span>` : '';
        }
        const file = 'abcdefgh'[i & 7], rank = 8 - (i >> 3);
        el.setAttribute('aria-label', file + rank + (p ? ' ' + (p[0] === 'w' ? 'ขาว' : 'ดำ') + ' ' + p[1] : ''));
      }
      if (slideMove) {   // หมากเลื่อนจากช่องเดิมไปช่องใหม่
        const m = slideMove, pc = cells[m.to].firstChild;
        slideMove = null;
        if (pc && pc.animate) {
          const a = cells[m.from].getBoundingClientRect(), b = cells[m.to].getBoundingClientRect();
          cells[m.to].style.zIndex = 5;
          pc.animate(
            [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(1.18)` }, { transform: 'translate(0, 0) scale(1)' }],
            { duration: 260, easing: 'cubic-bezier(.3,.7,.4,1)' }
          ).onfinish = () => { cells[m.to].style.zIndex = ''; };
        }
      }
    }

    function after() {
      const ms = legal(s), chk = inCheck(s, s.turn);
      if (!ms.length) {
        over = true;
        ctx.status(chk ? `🎉 ${name(s.turn === 'w' ? 'b' : 'w')} ชนะ — รุกจน!` : 'เสมอ (ไม่มีตาเดิน)');
        ctx.finish({ outcome: !chk ? 'draw' : s.turn === 'b' ? 'win' : 'lose' });
      } else if (s.b.every((p) => !p || p[1] === 'K')) {
        over = true;
        ctx.status('เสมอ (หมากไม่พอรุกจน)');
        ctx.finish({ outcome: 'draw' });
      } else {
        ctx.status((chk ? 'รุก! ' : '') + 'ตาของ ' + name(s.turn));
        if (chk) setTimeout(() => { if (alive) { SFX.play('check'); FX.shake(grid, 4); } }, 220);
      }
      render();
      if (!over && bot && s.turn === 'b') {
        busy = true;
        setTimeout(() => {
          if (!alive) return;
          const m = pickMove(s);
          busy = false;
          if (m) play(m);
        }, 80);
      }
    }

    function play(m) {
      const captured = s.b[m.to] || m.ep;
      s = apply(s, m);
      SFX.play(captured ? 'capture' : 'move');
      if (m.castle) setTimeout(() => SFX.play('move'), 120);
      if (m.promo) setTimeout(() => SFX.play('special'), 150);
      if (captured) {
        FX.burst(cells[m.to]);
        FX.ring(cells[m.to], '#d6453d');
      }
      slideMove = m;
      last = m; sel = -1; targets = [];
      after();
    }

    function click(i) {
      if (over || busy || (bot && s.turn === 'b')) return;
      const mv = legal(s).filter((m) => m.from === sel && m.to === i)[0];
      if (mv) return play(mv);
      const p = s.b[i];
      if (p && p[0] === s.turn) {
        sel = i;
        targets = legal(s).filter((m) => m.from === i).map((m) => m.to);
      } else { sel = -1; targets = []; }
      render();
    }

    ctx.status('ตาของ ' + name('w'));
    render();
    return () => { alive = false; };
  },
});
