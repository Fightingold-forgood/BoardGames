Games.push({
  id: 'memory',
  name: 'จับคู่ไพ่',
  emoji: '🃏',
  desc: 'เปิดไพ่หาคู่ที่เหมือนกัน ใครได้มากกว่าชนะ',
  rules: 'ผลัดกันเปิดไพ่ทีละ 2 ใบ ถ้าเหมือนกันจะได้คู่นั้นและได้เล่นต่อ ถ้าไม่เหมือนไพ่จะคว่ำลงแล้วเปลี่ยนตา จำตำแหน่งไพ่ให้ดี บอทเองก็จำได้แต่บางครั้งก็ลืม',
  create(root, ctx) {
    const bot = ctx.mode === 'bot';
    const faces = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐙'];
    const cards = [...faces, ...faces];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const matched = Array(16).fill(false);
    const known = new Map();   // ไพ่ที่บอทจำได้
    const score = { 1: 0, 2: 0 };
    let open = [], turn = 1, lock = false, over = false, alive = true;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const label = (p) => (bot ? (p === 1 ? 'คุณ' : 'บอท') : 'ผู้เล่น ' + p);
    const isBot = (p) => bot && p === 2;
    const info = () => `${label(1)} ${score[1]} – ${score[2]} ${label(2)}`;

    root.innerHTML = '<div class="grid mem"></div>';
    const grid = root.firstChild;
    const els = cards.map((_, i) => {
      const el = document.createElement('button');
      el.className = 'card-m';
      el.setAttribute('aria-label', 'ไพ่ใบที่ ' + (i + 1));
      el.addEventListener('click', () => { if (!isBot(turn)) pick(i); });
      grid.appendChild(el);
      return el;
    });

    function status() {
      ctx.status(`ตาของ ${label(turn)}  |  ${info()}`);
    }

    async function pick(i) {
      if (lock || over || matched[i] || open.includes(i)) return;
      SFX.play('flip');
      els[i].textContent = cards[i];
      els[i].classList.add('open');
      open.push(i);
      if (Math.random() < 0.8) known.set(i, cards[i]);
      if (open.length < 2) return;

      lock = true;
      await sleep(800);
      if (!alive) return;
      const [a, c] = open;
      open = [];
      if (cards[a] === cards[c]) {
        matched[a] = matched[c] = true;
        score[turn]++;
        known.delete(a); known.delete(c);
        SFX.play('match');
        [a, c].forEach((k) => { els[k].classList.remove('open'); els[k].classList.add('done'); FX.burst(els[k]); FX.ring(els[k], '#ffd23f'); });
      } else {
        SFX.play('miss');
        [a, c].forEach((k) => els[k].classList.add('miss'));
        await sleep(450);
        if (!alive) return;
        [a, c].forEach((k) => { els[k].classList.remove('open', 'miss'); els[k].textContent = ''; });
        turn = 3 - turn;
      }
      lock = false;

      if (matched.every(Boolean)) {
        over = true;
        ctx.status(score[1] === score[2] ? `เสมอกัน ${info()}` : `🎉 ${label(score[1] > score[2] ? 1 : 2)} ชนะ  |  ${info()}`);
        ctx.finish({ outcome: score[1] === score[2] ? 'draw' : score[1] > score[2] ? 'win' : 'lose' });
        return;
      }
      status();
      if (isBot(turn)) botTurn();
    }

    async function botTurn() {
      await sleep(600);
      if (!alive || over) return;
      // หาคู่ที่จำได้ครบแล้ว
      let first = null;
      const seen = {};
      for (const [i, f] of known) {
        if (matched[i]) continue;
        if (seen[f] !== undefined) { first = seen[f]; break; }
        seen[f] = i;
      }
      const free = [...cards.keys()].filter((i) => !matched[i]);
      const unknown = free.filter((i) => !known.has(i));
      const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
      if (first === null) first = rnd(unknown.length ? unknown : free);
      await pick(first);
      await sleep(700);
      if (!alive || over) return;

      let second = null;
      for (const [i, f] of known) {
        if (i !== first && !matched[i] && f === cards[first]) { second = i; break; }
      }
      if (second === null) {
        const rest = unknown.filter((i) => i !== first);
        second = rnd(rest.length ? rest : free.filter((i) => i !== first));
      }
      await pick(second);
    }

    status();
    return () => { alive = false; };
  },
});
