(() => {
  const cfg = window.SKYLINK || {};

  // スマホのメニュー開閉
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
  }

  // 読みもののカテゴリ絞り込み
  const chips = document.querySelectorAll(".chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", c === chip));
      const cat = chip.dataset.cat;
      document.querySelectorAll(".card[data-cat]").forEach((card) => {
        card.hidden = cat !== "all" && card.dataset.cat !== cat;
      });
    });
  });

  // フォーム送信。cfg.endpoint があればそこへPOST、無ければメール作成画面を開く。
  document.querySelectorAll("form[data-form]").forEach((form) => {
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
