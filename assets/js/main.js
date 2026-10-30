(() => {
  const cfg = window.SKYLINK || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (n) => Math.round(n).toLocaleString("en-AU");

  // 数字をなめらかに書き換える（動きを減らす設定のときは、すぐ書き換える）
  const tween = (el, to, show = fmt, ms = 450) => {
    const from = el._v ?? to;
    el._v = to;
    cancelAnimationFrame(el._raf);
    if (reduce || from === to) return void (el.textContent = show(to));
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = show(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  };

  // スマホのメニュー開閉
  const toggle = $(".nav-toggle");
  const nav = $(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
  }

  // ヘッダー：下へ送ると隠れ、上へ戻すと出る。下の線は読み進んだ量。
  const header = $(".site-header");
  const bar = $(".scroll-bar");
  if (header) {
    let last = scrollY;
    let queued = false;
    const onScroll = () => {
      queued = false;
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.setProperty("--p", max > 0 ? Math.min(1, y / max) : 0);
      const down = y > last + 4;
      const up = y < last - 4;
      if (down && y > 320 && !(nav && nav.classList.contains("open")) && !header.contains(document.activeElement)) header.classList.add("is-hidden");
      else if (up || y < 320) header.classList.remove("is-hidden");
      if (down || up) last = y;
    };
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
    header.addEventListener("focusin", () => header.classList.remove("is-hidden"));
    onScroll();
  }

  // 読みもののカテゴリ絞り込み
  const chips = $$(".chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", c === chip));
      const cat = chip.dataset.cat;
      $$(".card[data-cat]").forEach((card) => {
        card.hidden = cat !== "all" && card.dataset.cat !== cat;
      });
    });
  });

  // トップ：飛行機の窓（3つ）。日よけが下りているあいだに写真を入れ替え、ひと回りごとに背景の色も変える。
  // 止めるボタン・画面の外・別タブのときは進めない。
  $$("[data-wins]").forEach((wins) => {
    const hero = wins.closest(".hero");
    const btn = $(".stage-toggle", wins);
    const cap = $("[data-cap]", wins);
    const win = $$(".win", wins).map((el) => ({ el, img: $("img", el), list: JSON.parse(el.dataset.photos), i: 0 }));
    const TONES = 4;
    const MS = 1900;
    let k = 0;
    let timer = 0;
    let paused = reduce;
    let visible = true;

    const swap = (w) => {
      const n = (w.i + 1) % w.list.length;
      const next = w.list[n];
      const pre = new Image();
      pre.src = next.src;
      w.el.classList.add("is-shut");
      const open = () => {
        w.i = n;
        w.img.src = next.src;
        w.img.alt = next.cap;
        cap.textContent = next.cap;
        setTimeout(() => w.el.classList.remove("is-shut"), 120);
      };
      setTimeout(() => (pre.complete ? open() : (pre.onload = pre.onerror = open)), 540);
    };
    const tick = () => {
      swap(win[k % win.length]);
      k += 1;
      if (k % win.length === 0) hero.dataset.tone = (+hero.dataset.tone + 1) % TONES;
    };
    const plan = () => {
      clearTimeout(timer);
      if (!paused && visible && !document.hidden) timer = setTimeout(() => { tick(); plan(); }, MS);
    };
    const setPaused = (p) => {
      paused = p;
      hero.classList.toggle("is-paused", p);
      btn.setAttribute("aria-label", p ? btn.dataset.play : btn.dataset.pause);
      plan();
    };
    btn.addEventListener("click", () => setPaused(!paused));
    document.addEventListener("visibilitychange", plan);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; plan(); }, { threshold: 0.15 }).observe(wins);
    setPaused(paused);
  });

  // 流れる写真帯。一定の速さで流し、止めるボタンで止められる。止めているあいだは自分で横に送れる。
  $$("[data-strip]").forEach((strip) => {
    const btn = $(".strip-toggle", strip.parentElement);
    if (reduce) return; // 動きを減らす設定のときは、横スクロールのまま
    const track = $(".strip-track", strip);
    const items = [...track.children];
    items.forEach((li) => {
      const c = li.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      $$("img", c).forEach((im) => (im.alt = ""));
      track.appendChild(c);
    });
    const size = () => strip.style.setProperty("--dur", Math.max(20, track.scrollWidth / 2 / 42) + "s"); // 1秒に42px
    size();
    addEventListener("load", size);
    strip.classList.add("is-run");
    new IntersectionObserver(([e]) => strip.classList.toggle("is-off", !e.isIntersecting)).observe(strip);
    if (btn) {
      btn.hidden = false;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        const p = !strip.classList.contains("is-paused");
        strip.classList.toggle("is-paused", p);
        btn.setAttribute("aria-pressed", p);
        btn.setAttribute("aria-label", p ? btn.dataset.play : btn.dataset.pause);
      });
    }
  });

  // 実績の横送り。ふつうの横スクロール（トラックパッドの横スワイプ・Shift＋ホイール・指）で動く。
  // 縦スクロールは横に乗っ取らない。マウスならつかんで引っぱることもできる。矢印ボタンは1件ずつ送る。
  $$("[data-carousel]").forEach((root) => {
    const view = $(".wcar-view", root);
    const slides = $$(".wcar-slide", root);
    const prev = $("[data-prev]", root);
    const next = $("[data-next]", root);
    const now = $("[data-now]", root);
    const bar = $(".wcar-bar i", root);
    const step = () => slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : view.clientWidth;
    const go = (d) => view.scrollBy({ left: d * step(), behavior: reduce ? "auto" : "smooth" });
    let queued = false;
    const sync = () => {
      queued = false;
      const max = view.scrollWidth - view.clientWidth;
      const n = Math.min(slides.length - 1, Math.round(view.scrollLeft / step()));
      slides.forEach((s, k) => s.classList.toggle("is-sel", k === n));
      if (now) now.textContent = String(n + 1).padStart(2, "0");
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.max(0.06, view.scrollLeft / max) : 1})`;
      prev.disabled = view.scrollLeft <= 2;
      next.disabled = view.scrollLeft >= max - 2;
    };
    // スクロールが止まったら、いちばん近い実績の頭に合わせる（ブラウザの吸着は、細かい横スクロールを吸い戻すので使わない）
    let settle = 0;
    let settling = false;
    const snap = () => {
      if (drag) return;
      const max = view.scrollWidth - view.clientWidth;
      const target = Math.min(max, Math.round(view.scrollLeft / step()) * step());
      if (Math.abs(target - view.scrollLeft) > 3) { settling = true; view.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" }); }
    };
    view.addEventListener("scroll", () => {
      if (!queued) { queued = true; requestAnimationFrame(sync); }
      clearTimeout(settle);
      if (settling) { settle = setTimeout(() => (settling = false), 120); return; }
      settle = setTimeout(snap, 180);
    }, { passive: true });
    addEventListener("resize", sync);
    prev.addEventListener("click", () => go(-1));
    next.addEventListener("click", () => go(1));
    view.setAttribute("tabindex", "0");
    view.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    });
    // マウスでつかんで引っぱる（指・トラックパッドはブラウザに任せる）
    let drag = null;
    view.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, left: view.scrollLeft, moved: false };
    });
    addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; root.classList.add("is-drag"); }
      if (drag.moved) view.scrollLeft = drag.left - dx;
    });
    addEventListener("pointerup", () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      root.classList.remove("is-drag");
      if (moved) {
        // 離したら、近い実績にぴたっと合わせる
        snap();
        view.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
      }
    });
    view.addEventListener("dragstart", (e) => e.preventDefault());
    // キーボードで中のリンクに移ったら、その実績を見えるところに出す
    slides.forEach((s) => s.addEventListener("focusin", () => view.scrollTo({ left: s.offsetLeft - slides[0].offsetLeft, behavior: reduce ? "auto" : "smooth" })));
    sync();
  });

  // ページの途中のカットイン：画面に入ったら、写真の帯と文字を飛び込ませる（1回だけ）
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.3 });
    $$("[data-cutin]").forEach((el) => io.observe(el));
  } else {
    $$("[data-cutin]").forEach((el) => el.classList.add("in"));
  }

  // 金額の目安 ---------------------------------------------------------------
  const estData = (kind) => {
    const el = $(`[data-est-data="${kind}"]`);
    return el ? JSON.parse(el.textContent) : null;
  };
  const fillRange = (r) => r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min || 1)) * 100 + "%");
  // 円の概算表示。日本語は「約43万円」、英語は「approx. ¥430,000」。
  const yenView = (root, t) => {
    const el = $('[data-out="yen"]', root);
    const b = $("b", el);
    const mini = $('[data-out="yen-mini"] b', root); // 小さい画面で、操作中も見える合計
    return (aud, rate) => {
      const man = Math.round((aud * rate) / 10000);
      t.man ? tween(b, man, (v) => String(Math.round(v))) : tween(b, man * 10000, (v) => fmt(Math.round(v / 10000) * 10000));
      if (mini) mini.textContent = t.man ? man : fmt(man * 10000);
      return man;
    };
  };
  // 試算の内容を、同じページの相談フォームに引き継ぐ
  const carry = (D, lines, picks) => {
    const ta = document.getElementById(D.form.detail);
    if (ta) {
      const head = D.t.summary_head;
      const rest = ta.value.includes(head) ? ta.value.slice(0, ta.value.indexOf(head)).trimEnd() : ta.value.trimEnd();
      ta.value = (rest ? rest + "\n\n" : "") + [head, ...lines].join("\n");
    }
    const form = ta && ta.form;
    if (form) $$("input[type=checkbox]", form).filter((c) => c.name === D.form.group && picks.includes(c.value)).forEach((c) => (c.checked = true));
  };

  // 留学・ワーホリ
  $$('[data-est="study"]').forEach((root) => {
    const D = estData("study");
    if (!D) return;
    const t = D.t;
    const f = (n) => $(`input[name="${n}"]`, root);
    const out = (k) => $(`[data-out="${k}"]`, root);
    const note = (k) => $(`[data-note="${k}"]`, root);
    const school = f("school"), stay = f("stay"), tuition = f("tuition"), rate = f("rate");
    const showYen = yenView(root, t);
    const picked = (n) => $(`input[name="${n}"]:checked`, root).value;
    const weeks = (n) => `${n}${t.weeks}`;
    let last = {};

    const setStyle = () => {
      const s = D.styles[picked("style")];
      [school.min, school.max, school.value] = [s.school[0], s.school[1], s.school[2]];
      school.value = s.school[2];
      root.querySelector('[data-field="stay"]').hidden = !s.stay;
      if (s.stay) { [stay.min, stay.max] = [s.stay[0], s.stay[1]]; stay.value = s.stay[2]; }
    };
    const calc = () => {
      const key = picked("style");
      const s = D.styles[key];
      const w = +school.value;
      const live = s.stay ? +stay.value : w;
      const level = D.levels[picked("level")];
      const perWeek = Math.round(D.livingWeek * level);
      const tu = w * +tuition.value;
      const living = Math.round(D.livingWeek * live * level);
      const total = tu + living + s.visa;
      [school, stay, tuition, rate].forEach(fillRange);
      out("school").textContent = w === 0 ? t.none : weeks(w);
      out("stay").textContent = weeks(live);
      out("tuition").textContent = `A$${fmt(+tuition.value)}`;
      out("rate").textContent = D.lang === "ja" ? `${rate.value}円` : `¥${rate.value}`;
      tween(out("tuition-row"), tu);
      tween(out("living-row"), living);
      tween(out("visa-row"), s.visa);
      tween(out("total"), total);
      note("tuition").textContent = w ? `A$${fmt(+tuition.value)} × ${w}${t.week_unit}` : "";
      note("living").textContent = `A$${fmt(perWeek)} × ${live}${t.week_unit}`;
      note("visa").textContent = `${t.styles[key][1]}${s.verified ? "" : `（${t.unverified}）`}`;
      out("note").textContent = t.notes[key];
      const man = showYen(total, +rate.value);
      [["tuition", tu], ["living", living], ["visa", s.visa]].forEach(([k, v]) => ($(`[data-seg="${k}"]`, root).style.width = (v / total) * 100 + "%"));
      last = { key, w, live, tu, living, visa: s.visa, total, man, rate: +rate.value, tuition: +tuition.value, level: picked("level") };
    };
    // 行の出力先は data-out が controls と重なるので、行側だけ別名にしておく
    $$(".est-rows [data-out]", root).forEach((el) => el.setAttribute("data-out", el.getAttribute("data-out") + "-row"));
    root.addEventListener("input", (e) => { if (e.target.name === "style") setStyle(); calc(); });
    setStyle();
    calc();
    $("[data-est-apply]", root).addEventListener("click", () => {
      const yen = D.lang === "ja" ? `${t.about}${last.man}${t.man}` : `${t.about}¥${fmt(last.man * 10000)}`;
      const lines = [
        `${t.style}: ${t.styles[last.key][0]}（${t.styles[last.key][1]}）`,
        `${t.school}: ${last.w === 0 ? t.none : weeks(last.w)}`,
        ...(D.styles[last.key].stay ? [`${t.stay}: ${weeks(last.live)}`] : []),
        `${t.tuition}: A$${fmt(last.tuition)}`,
        `${t.living}: ${t.levels[last.level][0]}`,
        `${t.total}: ${yen} / A$${fmt(last.total)}（A$1=${last.rate}）`,
      ];
      const form = document.getElementById(D.form.detail)?.form;
      const opts = form ? $$("input[type=checkbox]", form).filter((c) => c.name === D.form.group) : [];
      carry(D, lines, opts[D.form.pick[last.key]] ? [opts[D.form.pick[last.key]].value] : []);
    });
  });

  // 豪州PR
  $$('[data-est="pr"]').forEach((root) => {
    const D = estData("pr");
    if (!D) return;
    const t = D.t, P = D.pr;
    const f = (n) => $(`input[name="${n}"]`, root);
    const out = (k) => $(`[data-out="${k}"]`, root);
    const rate = f("rate"), nights = f("nights");
    const showYen = yenView(root, t);
    let last = {};
    const qty = (it) => Math.max(it.min, Math.min(it.max, Math.round(+f(it.id).value || 0)));

    const calc = () => {
      const q = Object.fromEntries(P.items.map((it) => [it.id, qty(it)]));
      P.items.forEach((it) => {
        f(it.id).value = q[it.id];
        const [minus, plus] = $$(`[data-item="${it.id}"] button`, root);
        minus.disabled = q[it.id] <= it.min;
        plus.disabled = q[it.id] >= it.max;
      });
      const travelOn = f("travel").checked;
      root.querySelector('[data-field="nights"]').hidden = !travelOn;
      const fee = P.items.reduce((sum, it) => sum + q[it.id] * it.unit, 0);
      const appoint = f("appoint").checked ? P.appoint : 0;
      const travel = travelOn ? P.flight + P.hotel * +nights.value : 0;
      const gst = Math.round((fee + appoint + travel) * P.gst);
      const total = fee + appoint + travel + gst;
      [rate, nights].forEach(fillRange);
      out("nights").textContent = `${nights.value}${t.night}`;
      out("rate").textContent = D.lang === "ja" ? `${rate.value}円` : `¥${rate.value}`;
      const parts = { fee, appoint, travel, gst };
      Object.entries(parts).forEach(([k, v]) => {
        tween(out(k), v);
        $(`[data-row="${k}"]`, root).hidden = v === 0 && k !== "fee";
        $(`[data-seg="${k}"]`, root).style.width = total ? (v / total) * 100 + "%" : "0";
      });
      tween(out("total"), total);
      const man = showYen(total, +rate.value);
      last = { q, appoint, travelOn, nights: +nights.value, total, man, rate: +rate.value };
    };
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (!b) return;
      const input = $("input", b.parentElement);
      input.value = (+input.value || 0) + +b.dataset.step;
      calc();
    });
    root.addEventListener("input", calc);
    calc();
    $("[data-est-apply]", root).addEventListener("click", () => {
      const yen = D.lang === "ja" ? `${t.about}${last.man}${t.man}` : `${t.about}¥${fmt(last.man * 10000)}`;
      const quotes = $$('input[name="quote"]:checked', root).map((c) => c.value);
      const lines = [
        ...P.items.filter((it) => last.q[it.id] > 0).map((it) => `${t.items[it.id][0]}: ${last.q[it.id]}${t.day}`),
        ...(last.appoint ? [t.appoint[0]] : []),
        ...(last.travelOn ? [`${t.travel[0]}（${last.nights}${t.night}）`] : []),
        ...(quotes.length ? [`${t.quote_title}: ${quotes.join(" / ")}`] : []),
        `${t.total}: ${yen} / A$${fmt(last.total)}（A$1=${last.rate}）`,
      ];
      const picks = [
        ...(last.q.booth > 0 ? [D.form.booth] : []),
        ...(last.q.visit > 0 || last.appoint ? [D.form.visit] : []),
        ...quotes.map((q) => D.form.quote[q]),
      ];
      carry(D, lines, picks);
    });
  });

  // スクロールに合わせた動き（GSAP）。読み込めないとき・動きを減らす設定のときは、何も隠さない。
  // トップの Mission → Vision：左下から Vision へ上がる線を、カードの位置に合わせて引く。点が線を登る
  const flow = $(".mv-flow");
  if (flow) {
    const svg = $(".mv-graph", flow), line = $(".mv-graph-line", svg), area = $(".mv-graph-area", svg), dot = $(".mv-graph-dot", svg);
    const vis = $(".mv-vision", flow);
    let len = 0, raf = 0, t0 = 0, live = false;
    const pts = $(".mv-graph-pts", svg), goal = $(".mv-graph-goal", svg), mis = $(".mv-mission", flow);
    const draw = () => {
      const W = flow.clientWidth, H = flow.clientHeight, f = flow.getBoundingClientRect(), v = vis.getBoundingClientRect(), m = mis.getBoundingClientRect();
      const L = (r) => ({ l: r.left - f.left, r: r.right - f.left, t: r.top - f.top, b: r.bottom - f.top, w: r.width, h: r.height });
      const V = L(v), M = L(m), side = V.l > M.r; // PC は横並び、スマホは縦並び
      // 始点は Mission の札の端、終点は Vision の札の左下。そのあいだを上下しながら上がる折れ線にする
      const S = side ? { x: M.r, y: M.t + M.h * 0.86 } : { x: M.l + M.w * 0.22, y: M.t };
      const E = side ? { x: V.l, y: V.t + V.h * 0.22 } : { x: V.l + V.w * 0.78, y: V.b };
      const wob = [0, 0.3, -0.12, 0.22, -0.06, 0], amp = (S.y - E.y) * 0.32, N = wob.length - 1;
      const P = wob.map((k, i) => ({ x: S.x + ((E.x - S.x) * i) / N, y: S.y + ((E.y - S.y) * i) / N + k * amp }));
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const d = "M" + P.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L");
      line.setAttribute("d", d);
      area.setAttribute("d", `${d} L${E.x} ${H} L${S.x} ${H} Z`);
      pts.innerHTML = P.slice(1, -1).map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5"/>`).join("");
      goal.setAttribute("cx", E.x); goal.setAttribute("cy", E.y);
      len = line.getTotalLength();
      line.style.strokeDasharray = len;
      if (!flow.classList.contains("is-drawn") && flow.classList.contains("is-ready")) line.style.strokeDashoffset = len;
    };
    const step = (now) => {
      if (!live) return;
      const p = ((now - t0) % 3200) / 3200, e = p < 0.85 ? p / 0.85 : 1; // 登って、少し止まって、また下から
      const pt = line.getPointAtLength(len * (1 - Math.pow(1 - e, 2)));
      dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
      dot.style.opacity = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
      raf = requestAnimationFrame(step);
    };
    draw();
    addEventListener("resize", draw);
    addEventListener("load", draw);
    if (!reduce && "IntersectionObserver" in window) {
      flow.classList.add("is-ready");
      line.style.strokeDashoffset = len;
      new IntersectionObserver((ents) => ents.forEach((e) => {
        if (e.isIntersecting) {
          if (!flow.classList.contains("is-drawn")) {
            line.style.transition = "stroke-dashoffset 1.6s cubic-bezier(0.65, 0, 0.35, 1)";
            line.style.strokeDashoffset = 0;
            setTimeout(() => { flow.classList.add("is-drawn"); line.style.transition = ""; t0 = performance.now(); live = true; raf = requestAnimationFrame(step); }, 1600);
          } else if (!live) { live = true; t0 = performance.now(); raf = requestAnimationFrame(step); }
        } else { live = false; cancelAnimationFrame(raf); }
      }), { threshold: 0.3 }).observe(flow);
    }
  }

  // トップの7つの行動指針：輪の点と一覧を順に光らせ、中心の鶴をその点の方へ向ける。触れた点・行で止まる
  const core = $(".mv-core");
  if (core) {
    const ring = $(".mv-ring", core);
    const rows = $$(".mv-values li", core), nodes = $$(".mv-node", core), spokes = $$(".mv-spoke", core);
    const crane = $(".mv-crane", core);
    const n = rows.length;
    let cur = 0, timer = 0, hold = false, seen = false;
    const set = (i) => {
      cur = i;
      [rows, nodes, spokes].forEach((list) => list.forEach((el, k) => el.classList.toggle("is-on", k === i)));
      // 鶴は左向き。右半分の点へは左右反転して向ける（逆さまにしない）
      const deg = -90 + (i * 360) / n, right = Math.cos((deg * Math.PI) / 180) >= -0.01;
      crane.style.setProperty("--flip", right ? -1 : 1);
      crane.style.setProperty("--rot", `${right ? deg : deg - 180}deg`);
    };
    const loop = () => { clearTimeout(timer); if (!hold && !reduce && seen && !document.hidden) timer = setTimeout(() => { set((cur + 1) % n); loop(); }, 2600); };
    [...rows, ...nodes].forEach((el) => {
      const i = +el.dataset.i;
      const on = () => { hold = true; clearTimeout(timer); set(i); };
      const off = () => { hold = false; loop(); };
      el.addEventListener("mouseenter", on); el.addEventListener("mouseleave", off);
      el.addEventListener("focus", on); el.addEventListener("blur", off);
      el.addEventListener("click", () => set(i));
    });
    set(0);
    if (!reduce && "IntersectionObserver" in window) {
      ring.classList.add("is-ready");
      new IntersectionObserver((ents) => ents.forEach((e) => {
        if (e.isIntersecting) { ring.classList.add("is-in"); seen = true; loop(); } else { seen = false; clearTimeout(timer); }
      }), { threshold: 0.35 }).observe(core);
      document.addEventListener("visibilitychange", loop);
    }
  }

  if (window.gsap && window.ScrollTrigger && !reduce) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);

    // 文字のかたまり：下から少し上がって現れる
    const rise = $$(".sec-title, .sec-lead, .door, .strength, .service, .program, .steps li, .voice, .rows li, .card, .for-list li, .support li, .est-card, .est, .faq details, .case-body, .logos li, .profile-body, .notice, .cta-half, .mvv-statement, .mvv-body, .values li, .culture-item, .story, .mv-card, .mv-core-head, .mv-core-side");
    if (rise.length) {
      gsap.set(rise, { autoAlpha: 0, y: 26 });
      ScrollTrigger.batch(rise, {
        start: "top 90%", once: true,
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.07, overwrite: true }),
      });
    }

    // 写真：上から幕が開くように現れ、少し引いて止まる
    $$(".split-photo, .case-photos figure, .profile figure, .wcar-slide:first-child .wcar-photo").forEach((box) => {
      const im = $("img", box);
      if (!im) return;
      gsap.set(box, { clipPath: "inset(0 0 100% 0)" });
      gsap.set(im, { scale: 1.16 });
      ScrollTrigger.create({
        trigger: box, start: "top 88%", once: true,
        onEnter: () => {
          gsap.to(box, { clipPath: "inset(0 0 0% 0)", duration: 1.15, ease: "power3.inOut", clearProps: "clipPath" });
          gsap.to(im, { scale: 1, duration: 1.7, ease: "power3.out", clearProps: "transform" });
        },
      });
    });

    // 数字：画面に入ったら数え上げる（年は直近から、人数などは0から）
    $$(".facts dd, .est-ex .est-yen b").forEach((el) => {
      const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
      if (!node) return;
      const m = node.textContent.match(/^(\D*)([\d,]+)(.*)$/s);
      if (!m) return;
      const to = +m[2].replace(/,/g, "");
      const comma = m[2].includes(",");
      const state = { v: to >= 1900 && to <= 2100 ? to - 19 : 0 };
      const draw = () => (node.textContent = m[1] + (comma ? fmt(state.v) : Math.round(state.v)) + m[3]);
      draw();
      ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: () => gsap.to(state, { v: to, duration: 1.6, ease: "power2.out", onUpdate: draw }) });
    });

    // 大きな英字：1文字ずつ下から跳ね上がる
    $$(".mega, .foot-mega").forEach((m) => {
      const ch = $$(".ch", m);
      gsap.set(ch, { yPercent: 118, rotate: 9 });
      ScrollTrigger.create({
        trigger: m, start: "top 94%", once: true,
        onEnter: () => gsap.to(ch, { yPercent: 0, rotate: 0, duration: 0.95, ease: "back.out(1.6)", stagger: m.classList.contains("foot-mega") ? 0.07 : 0.032 }),
      });
    });

    // カットインの帯の中の写真：スクロールした分だけ、上下の帯が逆向きに流れる
    $$(".cutin .cut").forEach((cut) => {
      const dir = cut.classList.contains("cut-r") ? 1 : -1;
      gsap.fromTo($(".cut-film", cut), { xPercent: dir < 0 ? 0 : -9 }, { xPercent: dir < 0 ? -9 : 0, ease: "none", scrollTrigger: { trigger: cut.parentElement, start: "top bottom", end: "bottom top", scrub: 0.6 } });
    });

    // トップの窓：スクロールで少しずつずれて、奥行きを出す
    $$(".wins .win").forEach((w, k) => {
      gsap.to(w, { yPercent: -8 - k * 7, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.5 } });
    });
    // 色面のカードの写真：通り過ぎるあいだ、ゆっくり寄る
    $$(".door-photo img").forEach((im) => {
      gsap.fromTo(im, { scale: 1.18 }, { scale: 1, ease: "none", scrollTrigger: { trigger: im, start: "top bottom", end: "bottom top", scrub: 0.6 } });
    });

    // 写真帯の見出しと、濃い帯の中の写真にゆるい視差
    $$(".page-head.has-photo .split-photo img").forEach((im) => {
      gsap.to(im, { yPercent: 6, ease: "none", scrollTrigger: { trigger: im, start: "top top+=120", end: "bottom top", scrub: true } });
    });

    addEventListener("load", () => ScrollTrigger.refresh());
  }

  // フォーム送信。cfg.endpoint があればそこへPOST、無ければメール作成画面を開く。
  $$("form[data-form]").forEach((form) => {
    const msg = form.querySelector(".form-msg");
    const btn = form.querySelector("button[type=submit]");
    const label = btn.textContent;
    const show = (cls, text) => {
      msg.className = "form-msg " + cls;
      msg.textContent = text;
      msg.hidden = false;
      msg.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.elements.website && form.elements.website.value) return; // 迷惑送信よけ

      const data = {};
      new FormData(form).forEach((v, k) => {
        if (k === "website" || k === "agree" || !String(v).trim()) return;
        data[k] = data[k] ? data[k] + " / " + v : v;
      });
      const subject = form.dataset.subject + (data[form.dataset.subjectField] || "");

      // Google Analytics が入っているときだけ、申し込みを記録する（入力内容は送らない）
      const track = (method) => window.gtag && window.gtag("event", "generate_lead", { form_type: form.dataset.form, method });

      if (!cfg.endpoint) {
        const body = Object.entries(data).map(([k, v]) => `■ ${k}\n${v}`).join("\n\n");
        track("mailto");
        window.location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        show("ok", cfg.t.mail_ok);
        return;
      }

      btn.disabled = true;
      btn.textContent = cfg.t.sending;
      try {
        const res = await fetch(cfg.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ _subject: subject, form: form.dataset.form, page: location.href, ...data }),
        });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        track("form");
        show("ok", cfg.t.ok);
      } catch (err) {
        show("ng", cfg.t.ng);
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  });
})();
