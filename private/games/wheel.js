Games.push({
  id: 'wheel',
  name: 'วงล้อสุ่ม',
  emoji: '🎡',
  solo: true,
  desc: 'ใส่ตัวเลือกเอง แล้วหมุนให้วงล้อเลือกให้',
  rules: 'พิมพ์ตัวเลือกในกล่องข้อความ บรรทัดละ 1 อย่าง (2-24 ตัวเลือก) แล้วกด "หมุนวงล้อ" ผลที่เข็มชี้คือคำตอบ ติ๊ก "เอาตัวเลือกที่ออกแล้วออก" ถ้าอยากสุ่มทีละคนไปเรื่อยๆ ตัวเลือกที่พิมพ์จะถูกจำไว้ในเครื่องนี้',
  create(root, ctx) {
    const DEFAULT = ['พิซซ่า', 'ข้าวมันไก่', 'ส้มตำ', 'ก๋วยเตี๋ยว', 'หมูกระทะ', 'ชาบู'];
    const TAU = Math.PI * 2;
    let text = DEFAULT.join('\n'), removeWinner = false;
    try {
      text = localStorage.getItem('bg-wheel-items') || text;
      removeWinner = localStorage.getItem('bg-wheel-remove') === '1';
    } catch (e) {}

    root.innerHTML = `
      <div class="wheel-wrap">
        <div class="wheel-pointer" aria-hidden="true"></div>
        <canvas class="wheel-canvas" width="480" height="480" role="img" aria-label="วงล้อสุ่ม"></canvas>
      </div>
      <button class="btn btn-primary wheel-spin">หมุนวงล้อ</button>
      <label class="wheel-edit">ตัวเลือก (บรรทัดละ 1 อย่าง)
        <textarea rows="7" spellcheck="false"></textarea>
      </label>
      <label class="wheel-opt"><input type="checkbox"> เอาตัวเลือกที่ออกแล้วออก</label>`;
    const canvas = root.querySelector('canvas'), g = canvas.getContext('2d');
    const spinBtn = root.querySelector('.wheel-spin');
    const area = root.querySelector('textarea');
    const chk = root.querySelector('input[type=checkbox]');
    area.value = text;
    chk.checked = removeWinner;

    const pointer = root.querySelector('.wheel-pointer');
    let items = [], angle = 0, spinning = false, alive = true, raf = 0, hl = -1, tickIdx = -1;

    function parse() {
      items = area.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 24);
      spinBtn.disabled = spinning || items.length < 2;
      if (items.length < 2) ctx.status('ใส่ตัวเลือกอย่างน้อย 2 อย่าง');
      else if (!spinning) ctx.status('กดหมุนได้เลย');
      draw();
    }

    function draw() {
      const s = canvas.width, c = s / 2, R = c - 6;
      g.clearRect(0, 0, s, s);
      const n = Math.max(items.length, 1), slice = TAU / n;
      g.font = '600 26px "Segoe UI","Noto Sans Thai",sans-serif';
      g.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const a = angle + i * slice;
        g.beginPath();
        g.moveTo(c, c);
        g.arc(c, c, R, a, a + slice);
        g.closePath();
        g.fillStyle = `hsl(${(i * 360 / n + 10) % 360}, 65%, 76%)`;
        g.fill();
        g.strokeStyle = i === hl ? '#fff' : 'rgba(0,0,0,.25)';
        g.lineWidth = i === hl ? 8 : 2;
        g.stroke();
        if (!items[i]) continue;
        g.save();
        g.translate(c, c);
        g.rotate(a + slice / 2);
        g.textAlign = 'right';
        g.fillStyle = '#22201c';
        let t = items[i];
        while (t.length > 1 && g.measureText(t).width > R - 50) t = t.slice(0, -2) + '…';
        g.fillText(t, R - 18, 0);
        g.restore();
      }
      g.beginPath();
      g.arc(c, c, 18, 0, TAU);
      g.fillStyle = '#fff';
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.stroke();
    }

    // เข็มชี้ที่ด้านบน (มุม -90°)
    function indexAt(a) {
      const slice = TAU / items.length;
      const rel = (((-Math.PI / 2 - a) % TAU) + TAU) % TAU;
      return Math.floor(rel / slice) % items.length;
    }

    function spin() {
      if (spinning || items.length < 2) return;
      spinning = true;
      hl = -1;
      spinBtn.disabled = area.disabled = chk.disabled = true;
      ctx.status('กำลังหมุน…');
      const slice = TAU / items.length;
      const win = Math.floor(Math.random() * items.length);
      const within = (Math.random() - 0.5) * slice * 0.8;
      const target = -Math.PI / 2 - (win + 0.5) * slice + within;
      const start = angle;
      const delta = (((target - start) % TAU) + TAU) % TAU + TAU * (5 + Math.floor(Math.random() * 3));
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dur = reduce ? 1 : 4500;
      const t0 = performance.now();
      (function frame(now) {
        if (!alive) return;
        const t = Math.min((now - t0) / dur, 1);
        angle = start + delta * (1 - Math.pow(1 - t, 3));
        const ti = indexAt(angle);
        if (ti !== tickIdx) { tickIdx = ti; FX.restart(pointer, 'tick'); SFX.play('tick'); }   // เข็มกระดกทุกครั้งที่ผ่านช่อง
        draw();
        if (t < 1) { raf = requestAnimationFrame(frame); return; }
        angle = ((angle % TAU) + TAU) % TAU;
        done(indexAt(angle));
      })(t0);
    }

    function done(i) {
      const name = items[i];
      spinning = false;
      area.disabled = chk.disabled = false;
      hl = i;
      draw();
      if (chk.checked) {
        const lines = area.value.split('\n');
        const k = lines.findIndex((l) => l.trim() === name);
        if (k >= 0) lines.splice(k, 1);
        area.value = lines.join('\n');
        save();
      }
      if (chk.checked) hl = -1;   // รายการเปลี่ยนแล้ว ไม่ต้องไฮไลต์
      parse();
      ctx.status('🎉 ' + name);
    }

    function save() {
      try { localStorage.setItem('bg-wheel-items', area.value); } catch (e) {}
    }

    area.addEventListener('input', () => { save(); parse(); });
    chk.addEventListener('change', () => {
      try { localStorage.setItem('bg-wheel-remove', chk.checked ? '1' : '0'); } catch (e) {}
    });
    spinBtn.addEventListener('click', spin);

    parse();
    return () => { alive = false; cancelAnimationFrame(raf); };
  },
});
