// เสียงเอฟเฟกต์ทั้งหมดสังเคราะห์ด้วย Web Audio (ไม่ใช้ไฟล์เสียง) + ปุ่มเปิด/ปิดเสียง
// ใช้: SFX.play('ชื่อเสียง', ค่าเสริม?)  ผู้ใช้ปิดเสียงแล้วจะไม่มีทั้งเสียงและการสั่น
window.SFX = (function () {
  let ac = null, master = null, noiseBuf = null, muted = false, btn = null;
  const lastAt = {};
  try { muted = localStorage.getItem('bg-muted') === '1'; } catch (e) {}
  const hz = (n) => 261.63 * Math.pow(2, n / 12);   // n = จำนวนครึ่งเสียงจาก C4

  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.7;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(o) {
    const t0 = ac.currentTime + (o.t || 0), d = o.d || 0.15, v = o.v || 0.3, a = o.a || 0.005;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + d + 0.05);
  }

  function noise(o) {
    const t0 = ac.currentTime + (o.t || 0), d = o.d || 0.15, v = o.v || 0.2;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + d + 0.05);
  }

  // เล่นโน้ตไล่เรียง notes = จำนวนครึ่งเสียงจาก C4
  function arp(notes, o) {
    o = o || {};
    notes.forEach((n, i) => tone({ f: hz(n + (o.up === undefined ? 12 : o.up)), t: i * (o.step || 0.07), d: o.d || 0.22, type: o.type || 'triangle', v: o.v || 0.24, a: o.a }));
  }

  const S = {
    tap: () => tone({ f: 880, f2: 620, d: 0.07, type: 'triangle', v: 0.12 }),
    click: () => { tone({ f: 600, d: 0.05, type: 'triangle', v: 0.14 }); tone({ f: 900, t: 0.05, d: 0.09, type: 'triangle', v: 0.14 }); },
    placeX: () => { tone({ f: 330, f2: 200, d: 0.12, v: 0.35 }); noise({ d: 0.05, v: 0.08, f: 2500, type: 'bandpass' }); },
    placeO: () => { tone({ f: 494, f2: 300, d: 0.12, v: 0.35 }); noise({ d: 0.05, v: 0.08, f: 3000, type: 'bandpass' }); },
    place: () => { tone({ f: 280, f2: 160, d: 0.12, v: 0.4 }); noise({ d: 0.05, v: 0.1, f: 2000, type: 'bandpass' }); },
    drop: () => { tone({ f: 180, f2: 70, d: 0.16, v: 0.45 }); noise({ d: 0.07, v: 0.12, f: 900 }); },
    flip: () => { noise({ d: 0.06, v: 0.1, type: 'bandpass', f: 3000 }); tone({ f: 700, f2: 1000, d: 0.06, type: 'triangle', v: 0.12 }); },
    match: () => arp([0, 4, 7, 12], { step: 0.07, d: 0.24, v: 0.25 }),
    miss: () => tone({ f: 220, f2: 120, d: 0.22, type: 'sawtooth', v: 0.12 }),
    nope: () => { tone({ f: 200, d: 0.08, type: 'square', v: 0.1 }); tone({ f: 150, t: 0.09, d: 0.12, type: 'square', v: 0.1 }); },
    dice: () => { for (let i = 0; i < 6; i++) noise({ t: i * 0.05 + Math.random() * 0.02, d: 0.035, v: 0.16, type: 'bandpass', f: 1500 + Math.random() * 1800 }); },
    step: (k) => tone({ f: hz(12 + ((k || 0) % 12)), d: 0.07, type: 'square', v: 0.07 }),
    up: () => arp([0, 4, 7, 12, 16], { step: 0.06, d: 0.2, v: 0.22 }),
    down: () => tone({ f: 900, f2: 120, d: 0.6, type: 'sawtooth', v: 0.14 }),
    move: () => { tone({ f: 220, f2: 120, d: 0.09, type: 'triangle', v: 0.4 }); noise({ d: 0.04, v: 0.1, type: 'highpass', f: 2500 }); },
    capture: () => { tone({ f: 180, f2: 80, d: 0.14, v: 0.5 }); noise({ d: 0.1, v: 0.25, type: 'bandpass', f: 1500 }); },
    check: () => { tone({ f: 988, d: 0.12, type: 'square', v: 0.11 }); tone({ f: 740, t: 0.12, d: 0.16, type: 'square', v: 0.11 }); },
    card: () => { noise({ d: 0.07, v: 0.14, type: 'bandpass', f: 2200 }); tone({ f: 420, f2: 300, d: 0.07, type: 'triangle', v: 0.15 }); },
    deal: () => noise({ d: 0.05, v: 0.12, type: 'bandpass', f: 3000 }),
    skip: () => { tone({ f: 320, d: 0.09, type: 'square', v: 0.1 }); tone({ f: 320, t: 0.12, d: 0.09, type: 'square', v: 0.1 }); },
    bad: () => { tone({ f: 140, f2: 90, d: 0.35, type: 'sawtooth', v: 0.2 }); noise({ d: 0.25, v: 0.12, type: 'lowpass', f: 600 }); },
    wild: () => arp([0, 5, 9, 14], { step: 0.05, d: 0.2, type: 'sine', v: 0.22 }),
    uno: () => arp([7, 11, 14], { step: 0.1, d: 0.25, v: 0.3 }),
    night: () => { tone({ f: 110, d: 1.2, a: 0.3, v: 0.2 }); tone({ f: 165, d: 1.2, a: 0.4, v: 0.12 }); },
    dawn: () => arp([0, 4, 7, 12], { up: 24, step: 0.12, d: 0.9, type: 'sine', v: 0.16, a: 0.02 }),
    howl: () => { tone({ f: 300, f2: 760, d: 0.55, a: 0.08, v: 0.2 }); tone({ f: 760, f2: 330, t: 0.55, d: 0.6, a: 0.02, v: 0.2 }); },
    gavel: () => { noise({ d: 0.1, v: 0.3, type: 'lowpass', f: 700 }); tone({ f: 140, f2: 60, d: 0.18, v: 0.5 }); },
    mystic: () => arp([0, 7, 12, 19, 24], { step: 0.09, d: 0.6, type: 'sine', v: 0.15 }),
    tick: () => tone({ f: 1300, d: 0.025, type: 'square', v: 0.05 }),
    rot: () => tone({ f: 520, f2: 760, d: 0.05, type: 'triangle', v: 0.14 }),
    thud: () => { tone({ f: 130, f2: 45, d: 0.18, v: 0.55 }); noise({ d: 0.1, v: 0.2, type: 'lowpass', f: 500 }); },
    lock: () => tone({ f: 260, f2: 200, d: 0.06, type: 'triangle', v: 0.2 }),
    clear: (n) => arp([0, 4, 7, 12, 16].slice(0, Math.max(2, (n || 1) + 1)), { step: 0.06, d: 0.2, v: 0.24 }),
    tetris: () => { arp([0, 4, 7, 12, 16, 19, 24], { step: 0.055, d: 0.3, v: 0.26 }); noise({ d: 0.5, v: 0.2, type: 'lowpass', f: 3000, f2: 200 }); },
    levelup: () => arp([0, 4, 7, 12, 16, 19], { step: 0.07, d: 0.25, type: 'square', v: 0.1 }),
    swap: () => tone({ f: 420, f2: 760, d: 0.09, type: 'triangle', v: 0.2 }),
    whoosh: () => noise({ d: 0.35, v: 0.18, type: 'bandpass', f: 800, f2: 3500 }),
    pop: (combo) => {
      const k = Math.min(combo || 1, 8);
      tone({ f: hz(4 + k * 2), f2: hz(4 + k * 2) * 1.7, d: 0.13, type: 'sine', v: 0.3 });
      noise({ d: 0.04, v: 0.08, type: 'highpass', f: 4000 });
    },
    special: () => arp([12, 16, 19, 24, 28], { step: 0.05, d: 0.3, type: 'sine', v: 0.16 }),
    boom: () => { noise({ d: 0.6, v: 0.5, type: 'lowpass', f: 1800, f2: 80 }); tone({ f: 100, f2: 30, d: 0.5, v: 0.6 }); },
    ding: () => { tone({ f: 1318, d: 0.8, v: 0.25 }); tone({ f: 1976, d: 0.5, v: 0.1 }); },
    star: () => arp([7, 12, 16, 19], { step: 0.07, d: 0.5, type: 'sine', v: 0.2 }),
    win: () => {
      arp([0, 4, 7, 12], { step: 0.11, d: 0.3, v: 0.28 });
      [12, 16, 19, 24].forEach((n) => tone({ f: hz(n + 12), t: 0.5, d: 0.9, type: 'triangle', v: 0.16 }));
    },
    lose: () => arp([7, 5, 3, 0], { step: 0.18, d: 0.35, type: 'sawtooth', v: 0.1, up: 0 }),
    draw: () => { tone({ f: 392, d: 0.25, v: 0.2 }); tone({ f: 392, t: 0.28, d: 0.35, v: 0.2 }); },
    over: () => tone({ f: 440, f2: 80, d: 0.9, type: 'sawtooth', v: 0.14 }),
  };
  const HAPTIC = { win: [30, 40, 60], lose: [120], capture: [25], thud: [18], boom: [50], nope: [40], tetris: [40, 30, 40], howl: [60] };

  function play(name, arg) {
    if (muted || !S[name]) return;
    const now = performance.now();
    if (now - (lastAt[name] || 0) < 30) return;   // กันเสียงเดิมรัวซ้อนกัน
    lastAt[name] = now;
    if (!audio()) return;
    try { S[name](arg); } catch (e) {}
    if (HAPTIC[name] && navigator.vibrate) { try { navigator.vibrate(HAPTIC[name]); } catch (e) {} }
  }

  function paint() {
    if (!btn) return;
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(muted));
    btn.setAttribute('aria-label', muted ? 'เปิดเสียง' : 'ปิดเสียง');
    btn.title = muted ? 'เปิดเสียง' : 'ปิดเสียง';
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('bg-muted', m ? '1' : '0'); } catch (e) {}
    paint();
    if (!m) play('tap');
  }

  function build() {
    btn = document.createElement('button');
    btn.className = 'snd-btn';
    btn.type = 'button';
    btn.addEventListener('click', () => setMuted(!muted));
    document.body.appendChild(btn);
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  // เบราว์เซอร์ต้องมีการแตะ/กดคีย์ก่อนจึงจะเริ่มเสียงได้
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { if (!muted) audio(); }, { passive: true }));

  // เสียงกดปุ่มกลางสำหรับทุกปุ่ม ปุ่มลำโพงเล่นเสียงเองใน setMuted
  // ในกระดานเกม (#stage) ให้เสียงเฉพาะ .btn/.seg-btn เพราะปุ่มเกมอื่นๆ มีเสียงของตัวเอง
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button,.card');
    if (!b || b.disabled || b === btn || b.closest('.blk-pad')) return;
    if (b.closest('#stage') && !b.matches('.btn,.seg-btn')) return;
    play(b.classList.contains('card') ? 'click' : 'tap');
  }, true);

  return { play, isMuted: () => muted, setMuted };
})();
