Games.push({
  id: 'snakes',
  name: 'งูตกบันได',
  emoji: '🐍',
  desc: 'ทอยลูกเต๋า ปีนบันได ระวังงู',
  rules: 'ผลัดกันทอยลูกเต๋าแล้วเดินตามแต้ม ถ้าไปหยุดที่โคนบันไดจะปีนขึ้น ถ้าไปหยุดที่หัวงูจะไถลลง ทอยได้ 6 ได้เล่นอีกครั้ง ต้องไปถึงช่อง 100 พอดี ถ้าแต้มเกินจะอยู่ที่เดิม',
  create(root, ctx) {
    const bot = ctx.mode === 'bot';
    const LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
    const SNAKES = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
    const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const pos = [0, 0];
    let turn = 0, busy = false, over = false, alive = true;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const label = (p) => (bot ? (p === 0 ? 'คุณ (แดง)' : 'บอท (น้ำเงิน)') : p === 0 ? 'ผู้เล่น 1 (แดง)' : 'ผู้เล่น 2 (น้ำเงิน)');

    root.innerHTML = `
      <div class="start-area"></div>
      <div class="grid snk"></div>
      <div class="dice-row"><div class="dice">🎲</div><button class="btn btn-primary roll">ทอยลูกเต๋า</button></div>`;
    const startArea = root.querySelector('.start-area');
    const grid = root.querySelector('.snk');
    const diceEl = root.querySelector('.dice');
    const rollBtn = root.querySelector('.roll');

    // สร้างกระดาน 10x10 เรียงแบบซิกแซก เริ่มจากซ้ายล่าง
    const sq = {};
    for (let row = 0; row < 10; row++) {
      const fromBottom = 9 - row;
      for (let col = 0; col < 10; col++) {
        const n = fromBottom * 10 + (fromBottom % 2 === 0 ? col + 1 : 10 - col);
        const el = document.createElement('div');
        el.className = 'sq' + (LADDERS[n] ? ' ladder' : SNAKES[n] ? ' snake' : '');
        const jump = LADDERS[n] ? `<span class="jump">🪜${LADDERS[n]}</span>` : SNAKES[n] ? `<span class="jump">🐍${SNAKES[n]}</span>` : '';
        el.innerHTML = `${n}${jump}<div class="tokens"></div>`;
        grid.appendChild(el);
        sq[n] = el.querySelector('.tokens');
      }
    }

    function render() {
      Object.values(sq).forEach((t) => { t.innerHTML = ''; });
      startArea.innerHTML = 'ยังไม่ออกตัว: ';
      pos.forEach((p, i) => {
        const t = `<span class="token p${i + 1}"></span>`;
        if (p === 0) startArea.insertAdjacentHTML('beforeend', t);
        else sq[p].insertAdjacentHTML('beforeend', t);
      });
      rollBtn.disabled = busy || over || (bot && turn === 1);
    }

    function status(msg) {
      ctx.status(msg || 'ตาของ ' + label(turn));
    }

    async function roll() {
      if (busy || over) return;
      busy = true;
      render();
      const d = 1 + Math.floor(Math.random() * 6);
      diceEl.classList.add('rolling');
      SFX.play('dice');
      for (let k = 0; k < 8; k++) {   // แอนิเมชันเขย่าลูกเต๋า
        diceEl.textContent = FACES[1 + Math.floor(Math.random() * 6)];
        await sleep(70);
        if (!alive) return;
      }
      diceEl.classList.remove('rolling');
      diceEl.textContent = FACES[d];
      FX.restart(diceEl, 'fx-pop');

      let note = `${label(turn)} ทอยได้ ${d}`;
      if (pos[turn] + d <= 100) {
        for (let k = 0; k < d; k++) {
          pos[turn]++;
          SFX.play('step', k);
          render();
          await sleep(160);
          if (!alive) return;
        }
        const p = pos[turn];
        if (LADDERS[p] || SNAKES[p]) {
          const up = !!LADDERS[p];
          note += up ? ` เจอบันได ปีนขึ้นไปช่อง ${LADDERS[p]} 🪜` : ` เจองู ไถลลงไปช่อง ${SNAKES[p]} 🐍`;
          status(note);
          await sleep(600);
          if (!alive) return;
          pos[turn] = up ? LADDERS[p] : SNAKES[p];
          FX.float(sq[p].parentElement, up ? '🪜' : '🐍');
          FX.float(sq[pos[turn]].parentElement, up ? '✨' : '💥');
          SFX.play(up ? 'up' : 'down');
          if (!up) FX.shake(grid, 6);
        }
      } else {
        note += ' แต้มเกิน อยู่ที่เดิม';
      }

      busy = false;
      if (pos[turn] === 100) {
        over = true;
        render();
        ctx.status(`🎉 ${label(turn)} ถึงเส้นชัยก่อน!`);
        ctx.finish({ outcome: turn === 0 ? 'win' : 'lose' });
        return;
      }
      if (d === 6) note += ' ได้ทอยอีกครั้ง!'; else turn = 1 - turn;
      render();
      status(note + ' | ตาของ ' + label(turn));
      if (bot && turn === 1) {
        await sleep(900);
        if (alive) roll();
      }
    }

    rollBtn.addEventListener('click', () => { if (!(bot && turn === 1)) roll(); });
    status();
    render();
    return () => { alive = false; };
  },
});
