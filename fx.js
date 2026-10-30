// เอฟเฟกต์ภาพกลางที่ทุกเกมใช้ร่วมกัน: confetti หลายรูปทรง, ระเบิดประกาย/อีโมจิ, วงคลื่น,
// แฟลชหน้าจอ, ข้อความลอย, สั่นจอ, ริปเปิลตอนกดปุ่ม และพื้นหลังที่มีไอคอนเกมลอยเบาๆ
window.FX = (function () {
  const COLORS = ['#ff4d6d', '#ffd23f', '#2ec4b6', '#3a86ff', '#ff9f1c', '#9b5de5', '#06d6a0'];
  const TAU = Math.PI * 2;
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let cv = null, g = null, parts = [], raf = 0;

  function onResize() {
    if (!cv) return;
    cv.width = innerWidth;
    cv.height = innerHeight;
  }
  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'fx-canvas';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    g = cv.getContext('2d');
    onResize();
    addEventListener('resize', onResize);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    removeEventListener('resize', onResize);
    if (cv) cv.remove();
    cv = null;
    parts = [];
  }

  function star(s) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.25 : s * 0.6, a = (i / 10) * TAU - Math.PI / 2;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }

  function tick() {
    g.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 60);
    for (const p of parts) {
      p.vy += p.g;
      p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.flip += 0.25; p.life--;
      g.save();
      g.translate(p.x, p.y);
      g.globalAlpha = Math.min(1, p.life / 18);
      if (p.type === 'emoji') {
        g.font = `${p.s * 2.4}px serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.rotate(p.rot * 0.3);
        g.fillText(p.emoji, 0, 0);
      } else {
        g.rotate(p.rot);
        g.fillStyle = p.color;
        if (p.type === 'circle') { g.beginPath(); g.arc(0, 0, p.s / 2, 0, TAU); g.fill(); }
        else if (p.type === 'star') star(p.s);
        else { g.scale(1, Math.abs(Math.cos(p.flip)) * 0.9 + 0.1); g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); }
      }
      g.restore();
    }
    if (!parts.length) { stop(); return; }
    raf = requestAnimationFrame(tick);
  }

  function emit(x, y, count, power, angle, spread, life, o) {
    o = o || {};
    ensure();
    const types = o.types || ['rect', 'rect', 'circle', 'star'];
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = power * (0.35 + Math.random() * 0.65);
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.gravity === undefined ? 0.25 : o.gravity,
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4, flip: Math.random() * TAU,
        s: (o.size || 7) + Math.random() * (o.size || 7), life: life + Math.random() * 30,
        color: COLORS[(Math.random() * COLORS.length) | 0], type: types[(Math.random() * types.length) | 0], emoji: o.emoji,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  };

  function restart(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  const api = {
    restart,
    // ฉลองชัยชนะ: ปืนใหญ่ confetti สองข้าง + ฝนกระดาษจากด้านบน
    confetti() {
      if (reduced()) return;
      const w = innerWidth, h = innerHeight;
      emit(w * 0.1, h * 0.85, 90, 21, -Math.PI / 2 + 0.5, 0.8, 100);
      emit(w * 0.9, h * 0.85, 90, 21, -Math.PI / 2 - 0.5, 0.8, 100);
      for (let i = 0; i < 6; i++) {
        setTimeout(() => emit(Math.random() * w, -20, 14, 2, Math.PI / 2, 1.2, 170, { gravity: 0.12 }), 200 + i * 160);
      }
    },
    // ประกายเล็กๆ รอบองค์ประกอบ ใส่ n = จำนวน, emoji = ใช้อีโมจิแทนกระดาษสี
    burst(el, n, emoji) {
      if (reduced() || !el) return;
      const c = center(el);
      emit(c.x, c.y, n || 16, 5.5, 0, TAU, 30, emoji ? { types: ['emoji'], emoji, size: 6 } : {});
    },
    stars(el) {
      api.burst(el, 8, '⭐');
      api.burst(el, 6, '✨');
    },
    // วงคลื่นขยายออกจากองค์ประกอบ
    ring(el, color) {
      if (reduced() || !el) return;
      const c = center(el), d = Math.max(c.w, c.h);
      const ring = document.createElement('div');
      ring.className = 'fx-ring';
      ring.style.cssText = `left:${c.x}px;top:${c.y}px;width:${d}px;height:${d}px;border-color:${color || '#fff'}`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 600);
    },
    // วาบทั้งหน้าจอ
    flash(color) {
      if (reduced()) return;
      const f = document.createElement('div');
      f.className = 'fx-flash';
      f.style.background = color || '#fff';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 500);
    },
    // ชนะ: confetti + แฟลชทอง + เสียงเฉลิมฉลอง
    win() {
      api.confetti();
      api.flash('#ffd54a');
      if (window.SFX) SFX.play('win');
    },
    // ข้อความ/อีโมจิลอยขึ้นจากองค์ประกอบ
    float(el, text) {
      if (reduced() || !el) return;
      const c = center(el);
      const s = document.createElement('span');
      s.className = 'fx-float';
      s.textContent = text;
      s.setAttribute('aria-hidden', 'true');
      s.style.left = c.x + 'px';
      s.style.top = c.y + 'px';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    },
    shake(el, amp) {
      if (!el) return;
      el.style.setProperty('--amp', (amp || 8) + 'px');
      restart(el, 'fx-shake');
      setTimeout(() => el.classList.remove('fx-shake'), 500);
    },
  };

  // ริปเปิลวงกลมตอนกดปุ่ม/การ์ด
  document.addEventListener('click', (e) => {
    if (reduced()) return;
    const b = e.target.closest && e.target.closest('.btn,.seg-btn,.card,.pill,.tab');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
    const cx = e.clientX || e.clientY ? e.clientX - r.left : r.width / 2;
    const cy = e.clientX || e.clientY ? e.clientY - r.top : r.height / 2;
    const s = document.createElement('span');
    s.className = 'fx-ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${cx - size / 2}px;top:${cy - size / 2}px`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }, true);

  // พื้นหลัง: ไอคอนเกมลอยขึ้นช้าๆ จางๆ
  function bgFloat() {
    if (reduced() || document.querySelector('.bg-float')) return;
    const wrap = document.createElement('div');
    wrap.className = 'bg-float';
    wrap.setAttribute('aria-hidden', 'true');
    const E = ['🎲', '♞', '🎴', '🐺', '🧱', '🍬', '🃏', '🎡', '🐍', '⚫', '🔴', '⭕'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.textContent = E[i % E.length];
      s.style.cssText = `left:${Math.random() * 96}%;font-size:${32 + Math.random() * 50}px;animation-duration:${26 + Math.random() * 30}s;animation-delay:${-Math.random() * 50}s`;
      wrap.appendChild(s);
    }
    document.body.prepend(wrap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bgFloat);
  else bgFloat();

  return api;
})();
