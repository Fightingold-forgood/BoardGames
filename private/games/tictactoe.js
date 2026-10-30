Games.push({
  id: 'ttt',
  name: 'OX',
  emoji: '⭕',
  desc: 'เกมคลาสสิก 3×3 ต่อให้ครบ 3 ช่อง',
  rules: 'ผลัดกันวาง X และ O ใครต่อได้ 3 ช่องติดกัน (แนวตั้ง นอน หรือเฉียง) ก่อนชนะ บอทในโหมดนี้เก่งมาก ลองดูว่าจะเสมอได้ไหม',
  create(root, ctx) {
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const bot = ctx.mode === 'bot';
    let board = Array(9).fill('');
    let turn = 'X', over = false, alive = true;

    function win(b) {
      for (const l of LINES) {
        if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { who: b[l[0]], line: l };
      }
      return null;
    }

    // minimax: บอทเป็น O (ต้องการคะแนนสูง) คนเป็น X
    function score(b, p) {
      const w = win(b);
      if (w) return w.who === 'O' ? 1 : -1;
      if (b.every(Boolean)) return 0;
      const vals = [];
      b.forEach((v, i) => {
        if (v) return;
        b[i] = p;
        vals.push(score(b, p === 'O' ? 'X' : 'O'));
        b[i] = '';
      });
      return p === 'O' ? Math.max(...vals) : Math.min(...vals);
    }

    function botMove() {
      let best = -2, picks = [];
      board.forEach((v, i) => {
        if (v) return;
        board[i] = 'O';
        const s = score(board, 'X');
        board[i] = '';
        if (s > best) { best = s; picks = [i]; } else if (s === best) picks.push(i);
      });
      return picks[Math.floor(Math.random() * picks.length)];
    }

    root.innerHTML = '<div class="grid ttt"></div>';
    const grid = root.firstChild;
    const cells = board.map((_, i) => {
      const c = document.createElement('button');
      c.className = 'cell';
      c.setAttribute('aria-label', 'ช่อง ' + (i + 1));
      c.addEventListener('click', () => play(i));
      grid.appendChild(c);
      return c;
    });

    function render() {
      const w = win(board);
      cells.forEach((c, i) => {
        c.textContent = board[i];
        c.className = 'cell' + (board[i] ? ' ' + board[i].toLowerCase() : '') + (w && w.line.includes(i) ? ' win' : '');
        c.disabled = over || !!board[i];
      });
    }

    function name(p) {
      if (!bot) return 'ผู้เล่น ' + p;
      return p === 'X' ? 'คุณ (X)' : 'บอท (O)';
    }

    function play(i, fromBot) {
      if (over || board[i] || (bot && turn === 'O' && !fromBot)) return;
      board[i] = turn;
      SFX.play(turn === 'X' ? 'placeX' : 'placeO');
      FX.ring(cells[i], turn === 'X' ? '#d6453d' : '#3a6cb5');
      const w = win(board);
      if (w) { over = true; ctx.status('🎉 ' + name(w.who) + ' ชนะ!'); ctx.finish({ outcome: w.who === 'X' ? 'win' : 'lose' }); }
      else if (board.every(Boolean)) { over = true; ctx.status('เสมอกัน'); ctx.finish({ outcome: 'draw' }); }
      else {
        turn = turn === 'X' ? 'O' : 'X';
        ctx.status('ตาของ ' + name(turn));
      }
      render();
      if (!over && bot && turn === 'O') {
        setTimeout(() => { if (alive) play(botMove(), true); }, 450);
      }
    }

    ctx.status('ตาของ ' + name('X'));
    render();
    return () => { alive = false; };
  },
});
