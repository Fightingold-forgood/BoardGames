Games.push({
  id: 'uno',
  name: 'UNO',
  emoji: '🎴',
  desc: 'ลงไพ่ให้หมดมือก่อน สู้บอท 3 ตัว หรือเล่น 2 คน',
  rules: 'แจกไพ่คนละ 7 ใบ ลงไพ่ที่สีหรือเลข/สัญลักษณ์ตรงกับไพ่บนกอง ลงไม่ได้ให้กดกองจั่ว (ถ้าจั่วได้ไพ่ที่ลงได้ จะลงทันทีหรือกด "ผ่าน" ก็ได้) ⊘ ข้ามคนถัดไป ⇄ กลับทิศ +2 คนถัดไปจั่ว 2 ใบและโดนข้าม ★ เลือกสีใหม่ +4 เลือกสีใหม่ คนถัดไปจั่ว 4 ใบและโดนข้าม (ลงได้ทุกเมื่อ) ใครไพ่หมดมือก่อนชนะ โหมดเล่น 2 คนจะซ่อนไพ่ไว้จนกว่าจะแตะ ส่งเครื่องให้อีกฝ่ายทุกครั้งที่ถึงตา',
  create(root, ctx) {
    const bot = ctx.mode === 'bot';
    const n = bot ? 4 : 2;
    const names = bot ? ['คุณ', 'บอท 1', 'บอท 2', 'บอท 3'] : ['ผู้เล่น 1', 'ผู้เล่น 2'];
    const COLS = ['R', 'Y', 'G', 'B'];
    const CN = { R: 'แดง', Y: 'เหลือง', G: 'เขียว', B: 'น้ำเงิน' };
    const HEX = { R: '#d6453d', Y: '#e9b52f', G: '#3a9a5b', B: '#3a6cb5' };
    const SYM = { S: '⊘', V: '⇄', D: '+2', W: '★', F: '+4' };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const rnd = (k) => Math.floor(Math.random() * k);

    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    function makeDeck() {
      const d = [];
      let id = 0;
      for (const c of COLS) {
        d.push({ id: id++, c, v: '0' });
        for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'V', 'D']) {
          d.push({ id: id++, c, v }, { id: id++, c, v });
        }
      }
      for (let i = 0; i < 4; i++) d.push({ id: id++, c: 'W', v: 'W' }, { id: id++, c: 'W', v: 'F' });
      return shuffle(d);
    }
    function cardName(c) {
      if (c.c === 'W') return c.v === 'F' ? 'Wild +4' : 'Wild เปลี่ยนสี';
      return CN[c.c] + ' ' + ({ S: 'ข้าม', V: 'กลับทิศ', D: '+2' }[c.v] || c.v);
    }
    function cardEl(c, tag) {
      const el = document.createElement(tag);
      el.className = 'uno-card c-' + c.c;
      el.innerHTML = `<span>${SYM[c.v] || c.v}</span>`;
      el.setAttribute('aria-label', cardName(c));
      if (tag === 'button') el.type = 'button';
      return el;
    }

    // ---------- สถานะเกม ----------
    let deck = makeDeck(), discard = [];
    const hands = Array.from({ length: n }, () => []);
    for (let k = 0; k < 7; k++) for (let p = 0; p < n; p++) hands[p].push(deck.pop());
    let first = deck.pop();
    while (!/^\d$/.test(first.v)) { deck.unshift(first); first = deck.pop(); }
    discard.push(first);
    let curColor = first.c, dir = 1, turn = 0;
    let drawn = null, pendingWild = null;
    let busy = false, over = false, alive = true, revealed = false;
    const shown = {};

    const nextIdx = (from, steps = 1) => (((from + dir * steps) % n) + n) % n;
    const topCard = () => discard[discard.length - 1];
    const playable = (c) => c.c === 'W' || c.c === curColor || c.v === topCard().v;
    const viewer = () => (bot ? 0 : turn);
    const canAct = () => !over && !busy && !pendingWild && (bot ? turn === 0 : revealed);

    function drawCards(p, k) {
      let got = 0;
      for (let i = 0; i < k; i++) {
        if (!deck.length) {
          const keep = discard.pop();
          deck = shuffle(discard);
          discard = [keep];
        }
        if (!deck.length) break;
        hands[p].push(deck.pop());
        got++;
      }
      if (got) SFX.play('deal');
      return got;
    }

    // ---------- หน้าจอ ----------
    root.innerHTML = `
      <div class="uno">
        <div class="uno-opps"></div>
        <div class="uno-table">
          <button class="uno-card back uno-pile" aria-label="กองจั่ว"><span>UNO</span><small class="uno-left"></small></button>
          <div class="uno-disc"></div>
          <div class="uno-info"><span class="uno-cur"></span><span class="uno-dir" aria-label="ทิศทางการเล่น"></span></div>
        </div>
        <div class="uno-colors" hidden>
          ${COLS.map((c) => `<button class="uno-pick" data-c="${c}" style="background:${HEX[c]}" aria-label="${CN[c]}"></button>`).join('')}
        </div>
        <div class="uno-hand"></div>
        <button class="btn btn-primary uno-cover" hidden></button>
        <button class="btn uno-pass" hidden>ผ่าน (ไม่ลงไพ่ใบนี้)</button>
      </div>`;
    const $q = (s) => root.querySelector(s);
    const oppEl = $q('.uno-opps'), pile = $q('.uno-pile'), leftEl = $q('.uno-left');
    const discEl = $q('.uno-disc'), curEl = $q('.uno-cur'), dirEl = $q('.uno-dir');
    const colorsEl = $q('.uno-colors'), handEl = $q('.uno-hand');
    const coverBtn = $q('.uno-cover'), passBtn = $q('.uno-pass');
    const handMap = new Map();

    function renderHand() {
      const show = bot || revealed;
      coverBtn.hidden = show || over;
      if (!show) {
        handEl.innerHTML = '';
        handMap.clear();
        coverBtn.textContent = `ส่งเครื่องให้ ${names[turn]} แล้วแตะเพื่อดูไพ่`;
        return;
      }
      const h = hands[viewer()];
      const ids = new Set(h.map((c) => c.id));
      for (const [id, el] of handMap) if (!ids.has(id)) { el.remove(); handMap.delete(id); }
      const can = canAct();
      h.forEach((c, idx) => {
        let el = handMap.get(c.id);
        if (!el) {
          el = cardEl(c, 'button');
          el.classList.add('deal');
          el.addEventListener('click', () => onCard(c.id, el));
          handMap.set(c.id, el);
        }
        const ok = can && playable(c) && (!drawn || drawn === c);
        el.classList.toggle('ok', ok);
        el.classList.toggle('dim', !ok);
        if (handEl.children[idx] !== el) handEl.insertBefore(el, handEl.children[idx] || null);
      });
    }

    function render() {
      const v = viewer();
      oppEl.innerHTML = [...Array(n).keys()].filter((i) => i !== v).map((i) => {
        const cnt = hands[i].length;
        const bump = shown[i] !== undefined && shown[i] !== cnt;
        shown[i] = cnt;
        return `<div class="uno-opp${i === turn && !over ? ' on' : ''}"><span>${names[i]}</span> <b class="uno-opp-c${bump ? ' bump' : ''}">🂠 ${cnt}</b></div>`;
      }).join('');

      const top = topCard(), key = top.id + curColor;
      if (discEl.dataset.k !== key) {
        discEl.dataset.k = key;
        discEl.innerHTML = '';
        const el = cardEl(top, 'div');
        el.classList.add('discard');
        el.style.setProperty('--ring', HEX[curColor]);
        discEl.appendChild(el);
      }
      curEl.style.background = HEX[curColor];
      curEl.title = 'สีปัจจุบัน: ' + CN[curColor];
      dirEl.textContent = dir === 1 ? '⟳' : '⟲';
      leftEl.textContent = deck.length;
      pile.disabled = !(canAct() && !drawn);
      passBtn.hidden = !(drawn && canAct());
      colorsEl.hidden = !pendingWild;
      renderHand();
    }

    // ---------- การเล่น ----------
    async function playCard(p, card, color) {
      busy = true;
      hands[p].splice(hands[p].indexOf(card), 1);
      discard.push(card);
      curColor = card.c === 'W' ? color : card.c;
      drawn = null;
      let note = `${names[p]} ลง ${cardName(card)}${card.c === 'W' ? ' เลือกสี' + CN[curColor] : ''}`;
      render();

      const dEl = discEl.firstChild;
      SFX.play(card.v === 'D' || card.v === 'F' ? 'bad' : card.v === 'S' || card.v === 'V' ? 'skip' : card.c === 'W' ? 'wild' : 'card');
      FX.ring(dEl, HEX[curColor]);
      if (card.v === 'D' || card.v === 'F') FX.shake(discEl, 6);
      if (card.v === 'S') FX.float(dEl, '🚫');
      if (card.v === 'V') FX.float(dEl, '🔄');
      if (card.v === 'D') FX.float(dEl, '+2');
      if (card.v === 'F') FX.float(dEl, '+4');
      if (card.c === 'W') FX.burst(dEl);

      if (!hands[p].length) {
        over = true; busy = false; revealed = true;
        render();
        ctx.status(`🎉 ${names[p]} ชนะ!`);
        ctx.finish({ outcome: p === 0 ? 'win' : 'lose' });
        return;
      }
      if (hands[p].length === 1) {
        note += ' — UNO!';
        FX.float(discEl, `UNO! (${names[p]})`);
        setTimeout(() => SFX.play('uno'), 150);
      }

      const nx = nextIdx(p);
      if (card.v === 'V') {
        if (n === 2) turn = p; else { dir = -dir; turn = nextIdx(p); }
        note += n === 2 ? ' ข้ามอีกฝ่าย' : ' กลับทิศ';
      } else if (card.v === 'S') {
        turn = nextIdx(p, 2);
        note += ` ข้าม ${names[nx]}`;
      } else if (card.v === 'D' || card.v === 'F') {
        const k = card.v === 'D' ? 2 : 4;
        drawCards(nx, k);
        turn = nextIdx(p, 2);
        note += ` ${names[nx]} จั่ว ${k} ใบและโดนข้าม`;
      } else {
        turn = nx;
      }
      if (!bot && turn !== p) revealed = false;
      render();
      ctx.status(`${note} | ตาของ ${names[turn]}`);
      await sleep(550);
      if (!alive) return;
      busy = false;
      startTurn();
    }

    function advance() {
      drawn = null;
      turn = nextIdx(turn);
      if (!bot) revealed = false;
      ctx.status('ตาของ ' + names[turn]);
      startTurn();
    }

    function startTurn() {
      render();
      if (over) return;
      if (bot && turn !== 0) botTurn();
    }

    function choose(opts, h) {
      const cnt = { R: 0, Y: 0, G: 0, B: 0 };
      h.forEach((x) => { if (x.c !== 'W') cnt[x.c]++; });
      const nextHand = hands[nextIdx(turn)].length;
      let best = null, bs = -Infinity;
      for (const c of opts) {
        let s = Math.random();
        if (c.c === 'W') s -= h.length <= 2 ? 0 : 6;
        else if ('SVD'.includes(c.v)) s += nextHand <= 3 ? 6 : 2;
        else s += cnt[c.c] * 0.5 + Number(c.v) * 0.1;
        if (s > bs) { bs = s; best = c; }
      }
      return best;
    }
    function botColor(h) {
      const cnt = { R: 0, Y: 0, G: 0, B: 0 };
      h.forEach((x) => { if (x.c !== 'W') cnt[x.c]++; });
      const max = Math.max(...COLS.map((c) => cnt[c]));
      const pool = COLS.filter((c) => cnt[c] === max);
      return pool[rnd(pool.length)];
    }

    async function botTurn() {
      busy = true;
      render();
      await sleep(950);
      if (!alive || over) return;
      const h = hands[turn];
      let opts = h.filter(playable);
      if (!opts.length) {
        const got = drawCards(turn, 1);
        const c = h[h.length - 1];
        render();
        ctx.status(`${names[turn]} จั่วไพ่`);
        await sleep(750);
        if (!alive) return;
        if (got && playable(c)) opts = [c];
        else { busy = false; advance(); return; }
      }
      const pick = choose(opts, h);
      const rest = h.filter((x) => x !== pick);
      await playCard(turn, pick, pick.c === 'W' ? botColor(rest) : null);
    }

    function onCard(id, el) {
      if (!canAct()) return;
      const c = hands[viewer()].find((x) => x.id === id);
      if (!c || !playable(c) || (drawn && drawn !== c)) { FX.shake(el, 5); SFX.play('nope'); return; }
      if (c.c === 'W') {
        pendingWild = c;
        ctx.status('เลือกสีที่ต้องการ');
        render();
        return;
      }
      playCard(turn, c, null);
    }

    async function humanDraw() {
      if (!canAct() || drawn) return;
      busy = true;
      const got = drawCards(turn, 1);
      const c = hands[turn][hands[turn].length - 1];
      render();
      FX.float(pile, '+1');
      await sleep(550);
      if (!alive) return;
      busy = false;
      if (got && playable(c)) {
        drawn = c;
        ctx.status('จั่วได้ไพ่ที่ลงได้ — ลงเลยหรือกด "ผ่าน"');
        render();
      } else {
        ctx.status(got ? 'จั่วได้ไพ่ที่ลงไม่ได้ ผ่านตา' : 'กองจั่วหมด ผ่านตา');
        busy = true;
        render();
        await sleep(700);
        if (!alive) return;
        busy = false;
        advance();
      }
    }

    pile.addEventListener('click', humanDraw);
    passBtn.addEventListener('click', () => { if (drawn && canAct()) advance(); });
    coverBtn.addEventListener('click', () => {
      revealed = true;
      ctx.status('ตาของ ' + names[turn]);
      render();
    });
    colorsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.uno-pick');
      if (!b || !pendingWild) return;
      const c = pendingWild;
      pendingWild = null;
      playCard(turn, c, b.dataset.c);
    });

    ctx.status('ตาของ ' + names[0]);
    startTurn();
    return () => { alive = false; };
  },
});
