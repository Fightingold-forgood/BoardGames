Games.push({
  id: 'werewolf',
  name: 'มนุษย์หมาป่า',
  emoji: '🐺',
  desc: 'หมาป่าปนอยู่ในหมู่บ้าน ช่วยกันโหวตหาตัวร้ายก่อนจะถูกกัดจนหมด',
  rules: 'ทุกคนได้บทบาทลับ: 🐺 หมาป่า (กลางคืนเลือกกัดชาวบ้าน 1 คน), 🧑‍🌾 ชาวบ้าน (ไม่มีพลังพิเศษ), 🔮 ผู้หยั่งรู้ (ทุกคืนส่องได้ 1 คนว่าเป็นหมาป่าหรือไม่), 🩺 หมอ (ทุกคืนปกป้องได้ 1 คน ถ้าหมาป่ากัดคนนั้นจะรอด) กลางวันทุกคนโหวตประหารคนที่สงสัย ฝ่ายชาวบ้านชนะเมื่อกำจัดหมาป่าหมด ฝ่ายหมาป่าชนะเมื่อมีจำนวนเท่าหรือมากกว่าฝ่ายชาวบ้าน โหมดบอท: คุณกับบอท 6 ตัว (7 คน) โหมด 2 คน: เล่น 4-8 คนผ่านเครื่องเดียว ส่งเครื่องต่อกันและคุยกันจริงๆ ตอนกลางวัน ถ้าคะแนนโหวตเสมอจะไม่มีใครถูกประหาร',
  create(root, ctx) {
    const bot = ctx.mode === 'bot';
    const ROLE = {
      W: { name: 'หมาป่า', emoji: '🐺', tip: 'ตอนกลางคืนเลือกกัดชาวบ้านหนึ่งคน ตอนกลางวันแกล้งเป็นชาวบ้านอย่าให้ใครจับได้' },
      V: { name: 'ชาวบ้าน', emoji: '🧑‍🌾', tip: 'ไม่มีพลังพิเศษ ใช้การสังเกตและการโหวตเพื่อหาหมาป่า' },
      S: { name: 'ผู้หยั่งรู้', emoji: '🔮', tip: 'ทุกคืนส่องดูได้หนึ่งคนว่าเป็นหมาป่าหรือไม่ แต่ระวังอย่าเปิดเผยตัวเร็วเกินไป' },
      D: { name: 'หมอ', emoji: '🩺', tip: 'ทุกคืนเลือกปกป้องหนึ่งคน (รวมตัวเองได้) ถ้าหมาป่ากัดคนนั้นจะรอดชีวิต' },
    };
    const SPEECH = [
      (x) => `ฉันว่า ${x} ท่าทางแปลกๆ นะ`,
      (x) => `${x} เงียบผิดปกติ น่าสงสัยมาก`,
      (x) => `เมื่อคืนฉันได้ยินเสียงหอน แล้ว ${x} ก็ดูไม่น่าไว้ใจเลย`,
      (x) => `ลองโหวต ${x} ดูไหม ฉันรู้สึกไม่ดีกับคนนี้`,
    ];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const rnd = (k) => Math.floor(Math.random() * k);
    const pickOne = (a) => a[rnd(a.length)];
    const shuffle = (a) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    let players = [], day = 1, alive = true;
    const mySeen = {};   // ผลที่ผู้เล่นมนุษย์ (ผู้หยั่งรู้) ส่องได้ในโหมดบอท
    const botSeen = {};  // ผลที่บอทผู้หยั่งรู้ส่องได้

    const ids = (f) => players.map((p, i) => i).filter((i) => f(players[i], i));
    const alivePlayers = () => ids((p) => p.alive);

    // ---------- หน้าจอ ----------
    function roster(all) {
      return '<div class="ww-roster">' + players.map((p, i) => {
        let tag = '';
        if (!p.alive || all) tag = ` (${ROLE[p.role].emoji})`;
        else if (bot && mySeen[i] === true) tag = ' (🐺?)';
        else if (bot && mySeen[i] === false) tag = ' (✅)';
        return `<span class="ww-chip${p.alive ? '' : ' dead'}${bot && i === 0 ? ' me' : ''}">${p.alive ? '🙂' : '💀'} ${p.name}${tag}</span>`;
      }).join('') + '</div>';
    }
    function show(html, theme) {
      const box = alive ? root : document.createElement('div');   // เกมถูกปิดแล้ว ไม่แตะหน้าจอ
      box.innerHTML = `<div class="ww ${theme || 'day'}">${html}</div>`;
      return box.firstChild;
    }
    function notice(title, body, btn, theme) {
      return new Promise((res) => {
        const el = show(`${roster()}<h3>${title}</h3><div class="ww-sub">${body}</div>${btn ? `<button class="btn btn-primary ww-next">${btn}</button>` : ''}`, theme);
        const b = el.querySelector('.ww-next');
        if (b) b.addEventListener('click', res);
      });
    }
    function choose(title, body, cands, theme) {
      return new Promise((res) => {
        const el = show(`${roster()}<h3>${title}</h3><div class="ww-sub">${body}</div><div class="ww-pick">${cands.map((i) => `<button class="btn ww-btn" data-i="${i}">${players[i].name}</button>`).join('')}</div>`, theme);
        el.querySelectorAll('.ww-btn').forEach((b) => b.addEventListener('click', () => res(Number(b.dataset.i))));
      });
    }
    const cover = (name, why) =>
      notice('🔒 ส่งเครื่องให้ ' + name, `คนอื่นหันหน้าไปทางอื่นก่อน ${why}`, `ฉันคือ ${name} แตะเพื่อดู`, 'night');

    // ---------- ตั้งค่าเกม ----------
    function rolesFor(n) {
      const wolves = n >= 7 ? 2 : 1, doctor = n >= 6 ? 1 : 0;
      return [...Array(wolves).fill('W'), 'S', ...Array(doctor).fill('D'), ...Array(n - wolves - 1 - doctor).fill('V')];
    }
    function askCount() {
      return new Promise((res) => {
        const el = show(`<h3>เล่นกี่คน?</h3><div class="ww-sub">ทุกคนใช้เครื่องนี้ส่งต่อกัน ตอนที่เครื่องมาถึงตัวเอง ค่อยแตะเพื่อดูบทบาทและเลือกการกระทำ</div>
          <div class="ww-pick">${[4, 5, 6, 7, 8].map((n) => `<button class="btn ww-btn" data-n="${n}">${n} คน</button>`).join('')}</div>`);
        el.querySelectorAll('.ww-btn').forEach((b) => b.addEventListener('click', () => res(Number(b.dataset.n))));
      });
    }
    const partners = (i) => {
      const mates = ids((p, j) => p.role === 'W' && j !== i).map((j) => players[j].name);
      return mates.length ? `<p>หมาป่าด้วยกัน: <b>${mates.join(', ')}</b></p>` : '<p>คุณเป็นหมาป่าตัวเดียวในหมู่บ้าน</p>';
    };
    const roleCard = (i) => {
      const r = ROLE[players[i].role];
      return `<p>${r.tip}</p>${players[i].role === 'W' ? partners(i) : ''}`;
    };

    function checkWin() {
      const w = players.filter((p) => p.alive && p.role === 'W').length;
      const o = players.filter((p) => p.alive && p.role !== 'W').length;
      if (w === 0) return 'V';
      if (w >= o) return 'W';
      return null;
    }

    // ---------- กลางคืน ----------
    async function nightBot() {
      SFX.play('night');
      const al = alivePlayers();
      const nonW = al.filter((i) => players[i].role !== 'W');
      let target = nonW.length ? pickOne(nonW) : -1, save = -1;
      if (al.some((i) => i !== 0 && players[i].role === 'D')) save = pickOne(al);
      const seerBot = al.find((i) => i !== 0 && players[i].role === 'S');
      if (seerBot !== undefined) {
        const cand = al.filter((i) => i !== seerBot && botSeen[i] === undefined);
        if (cand.length) { const t = pickOne(cand); botSeen[t] = players[t].role === 'W'; }
      }
      const me = players[0];
      if (!me.alive) {
        await notice(`🌙 คืนที่ ${day}`, 'คุณตายแล้ว กำลังดูเกมต่อ…', 'ต่อ', 'night');
      } else if (me.role === 'W') {
        target = await choose('🐺 เลือกเหยื่อคืนนี้', partners(0), nonW, 'night');
      } else if (me.role === 'S') {
        const t = await choose('🔮 ส่องดูใคร', 'เลือกคนที่อยากรู้ว่าเป็นหมาป่าหรือไม่', al.filter((i) => i !== 0), 'night');
        mySeen[t] = players[t].role === 'W';
        SFX.play('mystic');
        await notice('🔮 ผลการส่อง', `<b>${players[t].name}</b> ${mySeen[t] ? 'เป็นหมาป่า! 🐺' : 'ไม่ใช่หมาป่า ✅'}`, 'ต่อ', 'night');
      } else if (me.role === 'D') {
        save = await choose('🩺 ปกป้องใคร', 'ถ้าหมาป่ากัดคนที่คุณเลือก เขาจะรอด (เลือกตัวเองได้)', al, 'night');
      } else {
        await notice('😴 คุณหลับไปทั้งคืน', 'คืนนี้ไม่มีอะไรให้ทำ ภาวนาให้ทุกคนปลอดภัย', 'ตื่นนอน', 'night');
      }
      return { target, save };
    }

    async function nightPvp() {
      SFX.play('night');
      let target = -1, save = -1;
      const al = alivePlayers();
      for (const i of al) {
        const p = players[i], r = p.role;
        await cover(p.name, `แล้ว ${p.name} แตะเพื่อทำหน้าที่ของคืนนี้`);
        if (!alive) return {};
        if (r === 'W') {
          target = await choose(`🐺 ${p.name} เลือกเหยื่อ`, partners(i), al.filter((j) => players[j].role !== 'W'), 'night');
        } else if (r === 'S') {
          const t = await choose(`🔮 ${p.name} ส่องดูใคร`, 'เลือกคนที่อยากรู้ว่าเป็นหมาป่าหรือไม่', al.filter((j) => j !== i), 'night');
          SFX.play('mystic');
          await notice('🔮 ผลการส่อง', `<b>${players[t].name}</b> ${players[t].role === 'W' ? 'เป็นหมาป่า! 🐺' : 'ไม่ใช่หมาป่า ✅'}<br>จำไว้แล้วกดต่อ เครื่องจะถูกส่งให้คนถัดไป`, 'จำได้แล้ว', 'night');
        } else if (r === 'D') {
          save = await choose(`🩺 ${p.name} ปกป้องใคร`, 'ถ้าหมาป่ากัดคนที่เลือก เขาจะรอด (เลือกตัวเองได้)', al, 'night');
        } else {
          await notice('😴 คุณหลับไปทั้งคืน', 'คืนนี้ไม่มีอะไรให้ทำ แตะเพื่อส่งเครื่องต่อ', 'ส่งต่อ', 'night');
        }
        if (!alive) return {};
      }
      return { target, save };
    }

    async function dawn(target, save) {
      const died = target >= 0 && target !== save ? target : -1;
      if (died >= 0) players[died].alive = false;
      ctx.status(`☀️ เช้าวันที่ ${day}`);
      SFX.play(died >= 0 ? 'howl' : 'dawn');
      if (died >= 0) { FX.flash('#b91c1c'); FX.shake(root, 8); }
      const body = died >= 0
        ? `<b>${players[died].name}</b> ถูกหมาป่ากัดตาย! เขาเป็น ${ROLE[players[died].role].emoji} ${ROLE[players[died].role].name}`
        : 'เมื่อคืนไม่มีใครตาย อาจมีคนถูกปกป้องไว้';
      await notice(`☀️ เช้าวันที่ ${day}`, body, 'ต่อ');
    }

    // ---------- กลางวัน ----------
    const argmax = (cands, score) => {
      let best = [], bs = -Infinity;
      for (const c of cands) {
        const s = score(c);
        if (s > bs) { bs = s; best = [c]; } else if (s === bs) best.push(c);
      }
      return pickOne(best);
    };

    async function resolveVotes(votes) {
      const cnt = {};
      Object.values(votes).forEach((t) => { cnt[t] = (cnt[t] || 0) + 1; });
      const max = Math.max(0, ...Object.values(cnt));
      const top = Object.keys(cnt).filter((k) => cnt[k] === max).map(Number);
      const rows = Object.entries(votes).map(([f, t]) => `<p class="ww-line">${players[f].name} → ${players[t].name}</p>`).join('');
      let msg = '<p><b>คะแนนเสมอกัน ไม่มีใครถูกประหาร</b></p>';
      if (top.length === 1) {
        SFX.play('gavel');
        FX.shake(root, 6);
        const v = top[0];
        players[v].alive = false;
        msg = `<p><b>${players[v].name}</b> ถูกประหาร! เขาเป็น ${ROLE[players[v].role].emoji} ${ROLE[players[v].role].name}</p>`;
      }
      await notice('🗳️ ผลโหวต', rows + msg, 'ต่อ');
    }

    async function dayBot() {
      const al = alivePlayers();
      const sus = {};
      al.forEach((i) => { sus[i] = 0; });
      const lines = [];
      for (const i of al) {
        if (i === 0) continue;
        const p = players[i];
        let t = null, line = '';
        if (p.role === 'S') {
          const w = al.find((j) => botSeen[j] === true);
          if (w !== undefined) { t = w; sus[t] += 3; line = `ฉันมีลางสังหรณ์แรงมากว่า ${players[t].name} คือหมาป่า!`; }
        }
        if (t === null) {
          t = pickOne(al.filter((j) => j !== i && (p.role !== 'W' || players[j].role !== 'W')));
          sus[t]++;
          line = pickOne(SPEECH)(players[t].name);
        }
        lines.push(`<p class="ww-line"><b>${p.name}:</b> “${line}”</p>`);
      }
      await notice('💬 ชาวบ้านถกเถียงกัน', lines.join('') || '<p>ไม่มีใครพูดอะไร</p>', 'ไปโหวต');
      if (!alive) return;

      const votes = {};
      if (players[0].alive) votes[0] = await choose('🗳️ โหวตประหาร', 'เลือกคนที่คุณคิดว่าเป็นหมาป่า', al.filter((i) => i !== 0));
      for (const i of al) {
        if (i === 0) continue;
        const p = players[i], others = al.filter((j) => j !== i);
        if (p.role === 'W') {
          votes[i] = argmax(al.filter((j) => players[j].role !== 'W'), (j) => sus[j]);
        } else {
          const known = p.role === 'S' ? others.find((j) => botSeen[j] === true) : undefined;
          votes[i] = known !== undefined ? known : Math.random() < 0.2 ? pickOne(others) : argmax(others, (j) => sus[j]);
        }
      }
      await resolveVotes(votes);
    }

    async function dayPvp() {
      const al = alivePlayers();
      await notice('💬 ถึงเวลาคุยกัน', 'ทุกคนคุยกันจริงๆ ว่าใครน่าสงสัย พร้อมแล้วกดเริ่มโหวต เครื่องจะถูกส่งต่อทีละคน', 'เริ่มโหวต');
      const votes = {};
      for (const i of al) {
        await cover(players[i].name, `แล้ว ${players[i].name} แตะเพื่อโหวต`);
        if (!alive) return;
        votes[i] = await choose(`🗳️ ${players[i].name} โหวตประหารใคร`, 'เลือกคนที่คิดว่าเป็นหมาป่า', al.filter((j) => j !== i), 'night');
        if (!alive) return;
      }
      await resolveVotes(votes);
    }

    // ---------- วงจรเกม ----------
    async function run() {
      ctx.status('เตรียมเกม');
      const n = bot ? 7 : await askCount();
      if (!alive) return;
      players = shuffle(rolesFor(n)).map((role, i) => ({
        role, alive: true, name: bot ? (i === 0 ? 'คุณ' : 'บอท ' + i) : 'ผู้เล่น ' + (i + 1),
      }));

      if (bot) {
        await notice(`${ROLE[players[0].role].emoji} คุณคือ ${ROLE[players[0].role].name}`, roleCard(0), 'เริ่มเกม', 'night');
      } else {
        for (let i = 0; i < n; i++) {
          await cover(players[i].name, `แล้ว ${players[i].name} แตะเพื่อดูบทบาทลับ`);
          await notice(`${ROLE[players[i].role].emoji} คุณคือ ${ROLE[players[i].role].name}`, roleCard(i) + '<p>จำไว้แล้วกดต่อ เครื่องจะถูกส่งให้คนถัดไป</p>', 'จำได้แล้ว', 'night');
          if (!alive) return;
        }
      }

      let winner = null;
      while (!winner) {
        ctx.status(`🌙 คืนที่ ${day}`);
        const { target, save } = bot ? await nightBot() : await nightPvp();
        if (!alive) return;
        await dawn(target, save);
        if (!alive) return;
        winner = checkWin();
        if (winner) break;

        ctx.status(`☀️ วันที่ ${day}`);
        await (bot ? dayBot() : dayPvp());
        if (!alive) return;
        winner = checkWin();
        day++;
      }

      const team = winner === 'W' ? 'หมาป่า' : 'ชาวบ้าน';
      const mine = players[0].role === 'W' ? 'W' : 'V';   // ผู้เล่นคนแรกคือบัญชีที่ login อยู่
      ctx.finish({ outcome: mine === winner ? 'win' : 'lose' });
      if (bot) {
        ctx.status(mine === winner ? `🎉 คุณชนะ! ทีม${team}` : `🎉 บอท (ทีม${team}) ชนะ — คุณแพ้`);
      } else {
        ctx.status(`🎉 ทีม${team}ชนะ!`);
      }
      show(`${roster(true)}<h3>${winner === 'W' ? '🐺' : '🏡'} ทีม${team}ชนะ</h3><div class="ww-sub">กด "เริ่มใหม่" ด้านบนเพื่อเล่นอีกครั้ง</div>`, winner === 'W' ? 'night' : 'day');
    }

    run();
    return () => { alive = false; };
  },
});
