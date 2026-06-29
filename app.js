/* ============================================================
   The Hook-Up Game — UI controller
   Depends on riskModel.js (window.RiskModel).
   ============================================================ */
(function () {
  "use strict";
  const M = window.RiskModel;

  // ---- App state ----
  const state = {
    studentAnatomy: null,
    partnerAnatomy: null,
    condoms: null,
    hpvVaccinated: null,
    partnerTier: null,
    partnerCount: 1,
    partners: { partner: 0, friend: 0, acquaintance: 0, stranger: 0 },
  };

  const TIER_PLURAL = {
    partner: "relationship partners",
    friend: "friends",
    acquaintance: "acquaintances",
    stranger: "strangers",
  };
  let lastResult = null; // cached calculateRisk() output for re-rolls

  // ---- Per-STI artwork (one image each) ----
  const STI_IMG = {
    chlamydia:      "img/sti-Chlamydia.png",
    gonorrhea:      "img/sti-Gonorrhea.png",
    trichomoniasis: "img/sti-Trichomoniasis.png",
    hpv:            "img/sti-HPV.png",
    herpes:         "img/sti-HSV.png",
    syphilis:       "img/sti-Syphilis.png",
    hiv:            "img/sti-HIV.png",
  };

  const GET_TESTED =
    "Get tested! Most STIs are symptom-free, so you won't know unless you get tested. Thankfully, most are also curable or manageable. Testing is quick, routine, and often free.";
  const CLEAR_BLURB =
    "You dodged it this round. Luck plays a part — but consistent condoms, fewer concurrent partners, HPV vaccination, and regular testing are what actually move these odds.";

  // ---- Helpers ----
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showScreen(name) {
    $$(".screen").forEach((s) => s.classList.toggle("screen--active", s.dataset.screen === name));
    // Persistent restart visible on every screen except the landing.
    $("#globalRestart").hidden = name === "landing";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Wire simple navigation ([data-go]) ----
  $$("[data-go]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen(btn.dataset.go))
  );

  // ---- Persistent restart button ----
  $("#globalRestart").addEventListener("click", () => {
    resetAll();
    showScreen("landing");
  });

  // ---- Choice buttons (anatomy / partner anatomy / condoms) ----
  $$(".choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field;
      const raw = btn.dataset.value;
      const value = raw === "true" ? true : raw === "false" ? false : raw;
      state[field] = value;

      // visually select within this field's group
      $$(`.choice[data-field="${field}"]`).forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      // enable the relevant Next/Calc button
      const screen = btn.closest(".screen");
      const next = $(".btn--primary", $(".nav-row", screen));
      if (next) next.disabled = false;
    });
  });

  // ---- Next buttons that advance to a named screen ----
  $$("[data-next]").forEach((btn) =>
    btn.addEventListener("click", () => showScreen(btn.dataset.next))
  );

  // ---- Partner tier selection + count ----
  // Only one tier is ever active; we mirror it into state.partners for the model.
  function syncPartners() {
    state.partners = { partner: 0, friend: 0, acquaintance: 0, stranger: 0 };
    if (state.partnerTier) state.partners[state.partnerTier] = state.partnerCount;
  }

  function refreshCount() {
    $("#partnerCount").textContent = state.partnerCount;
    $$("[data-count-btn]").forEach((b) => {
      const d = parseInt(b.dataset.countBtn, 10);
      b.disabled =
        (d < 0 && state.partnerCount <= M.MIN_PARTNERS) ||
        (d > 0 && state.partnerCount >= M.MAX_PARTNERS);
    });
  }

  // Tier picked → reveal count control (the generic .choice handler also sets
  // state.partnerTier, toggles selection, and enables Next).
  $$(".choice--tier").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.partnerTier = btn.dataset.value;
      if (!state.partnerCount || state.partnerCount < M.MIN_PARTNERS) state.partnerCount = 1;
      $("#countControl").hidden = false;
      $("#countLabel").textContent = `How many ${TIER_PLURAL[state.partnerTier]} this year?`;
      refreshCount();
      syncPartners();
    })
  );

  // Count stepper (1–10)
  $$("[data-count-btn]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = state.partnerCount + parseInt(b.dataset.countBtn, 10);
      if (next < M.MIN_PARTNERS || next > M.MAX_PARTNERS) return;
      state.partnerCount = next;
      refreshCount();
      syncPartners();
    })
  );

  // ---- Recompute odds for the current state (no roll) ----
  function recompute() {
    syncPartners();
    lastResult = M.calculateRisk(state);
    renderOdds(lastResult);
  }

  // ---- Calculate → show odds (outcome stays hidden until they roll) ----
  $("#calcBtn").addEventListener("click", () => {
    try {
      recompute();
    } catch (e) {
      alert(e.message);
      showScreen("partners");
      return;
    }
    initRespec();
    // Reset progressive-reveal state: outcome + respec menu hidden until rolled.
    const outcome = $("#outcome");
    outcome.hidden = true;
    outcome.className = "outcome";
    $("#respecSection").hidden = true;
    showScreen("results");
  });

  // ---- Dice roll (inline animation → reveal). Also serves as re-roll. ----
  function rollDice() {
    if (!lastResult) return;
    const box = $("#outcome");
    box.hidden = false;
    box.className = "outcome rolling";
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#rollBtn").disabled = true;
    setTimeout(() => {
      revealOutcome(lastResult);
      $("#respecSection").hidden = false; // tweak panel appears after the first roll
      $("#rollBtn").disabled = false;
    }, 900);
  }

  $("#rollBtn").addEventListener("click", rollDice);

  // ---- Respec menu: live-adjust params on the results screen ----
  function setActivePill(field, value) {
    $$(`.pill[data-respec="${field}"]`).forEach((b) =>
      b.classList.toggle("active", b.dataset.value === String(value))
    );
  }

  function refreshRespecCount() {
    $("#respecCount").textContent = state.partnerCount;
    $$("[data-respec-count]").forEach((b) => {
      const d = parseInt(b.dataset.respecCount, 10);
      b.disabled =
        (d < 0 && state.partnerCount <= M.MIN_PARTNERS) ||
        (d > 0 && state.partnerCount >= M.MAX_PARTNERS);
    });
  }

  // Sync the respec controls to the current state (called when entering results).
  function initRespec() {
    setActivePill("partnerTier", state.partnerTier);
    setActivePill("condoms", state.condoms);
    setActivePill("hpvVaccinated", state.hpvVaccinated);
    refreshRespecCount();
  }

  // Pill changes (tier / condoms / hpv)
  $$(".pill[data-respec]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const field = btn.dataset.respec;
      const raw = btn.dataset.value;
      state[field] = raw === "true" ? true : raw === "false" ? false : raw;
      setActivePill(field, raw);
      recompute();
    })
  );

  // Number-of-partners stepper in the respec menu
  $$("[data-respec-count]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = state.partnerCount + parseInt(b.dataset.respecCount, 10);
      if (next < M.MIN_PARTNERS || next > M.MAX_PARTNERS) return;
      state.partnerCount = next;
      refreshRespecCount();
      recompute();
    })
  );

  // ---- Render the odds meter + breakdown ----
  function renderOdds(result) {
    const pct = Math.round(result.pAny * 100);
    $("#oddsNum").textContent = pct + "%";
    // animate fill on next frame
    $("#oddsFill").style.width = "0%";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $("#oddsFill").style.width = pct + "%";
    }));

    const bars = $("#bars");
    bars.innerHTML = "";
    result.perSTI.forEach((s) => {
      const p = (s.pGet * 100);
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML =
        `<span>${s.label}</span>` +
        `<span class="bar-track"><span class="bar-val" style="width:${Math.min(100, p).toFixed(1)}%"></span></span>` +
        `<span class="bar-pct">${p < 0.1 ? "<0.1" : p.toFixed(1)}%</span>`;
      bars.appendChild(row);
    });
  }

  // ---- Reveal the rolled outcome (may be zero, one, or several STIs) ----
  function revealOutcome(result) {
    const outcome = M.rollOutcome(result);
    const box = $("#outcome");
    const art = $("#outcomeArt");
    const title = $("#outcomeTitle");
    const blurb = $("#outcomeBlurb");
    const microbeWrap = $("#microbeWrap");
    microbeWrap.innerHTML = "";

    if (!outcome.contracted) {
      box.className = "outcome clear";
      art.src = "img/result-clear.png";
      title.textContent = "You stayed STI-free this year 🎉";
      blurb.textContent = CLEAR_BLURB;
      microbeWrap.hidden = true;
    } else {
      box.className = "outcome hit";
      art.src = "img/result-sti.png";
      title.textContent =
        outcome.stis.length === 1
          ? `You contracted ${outcome.stis[0].label}`
          : "You contracted multiple STIs";
      blurb.textContent = GET_TESTED;
      microbeWrap.hidden = false;
      outcome.stis.forEach((s) => {
        const item = document.createElement("div");
        item.className = "microbe-item";
        const img = document.createElement("div");
        img.className = "microbe-img";
        img.style.backgroundImage = `url("${STI_IMG[s.key]}")`;
        const name = document.createElement("span");
        name.className = "microbe-name";
        name.textContent = s.label;
        item.append(img, name);
        microbeWrap.appendChild(item);
      });
    }
  }

  // ---- Reset ----
  function resetAll() {
    state.studentAnatomy = null;
    state.partnerAnatomy = null;
    state.condoms = null;
    state.hpvVaccinated = null;
    state.partnerTier = null;
    state.partnerCount = 1;
    state.partners = { partner: 0, friend: 0, acquaintance: 0, stranger: 0 };
    lastResult = null;
    $$(".choice.selected").forEach((b) => b.classList.remove("selected"));
    $$(".screen .btn--primary").forEach((b) => {
      // re-disable the per-step primary buttons (not reroll/restart on results)
      if (["calcBtn"].includes(b.id) || b.dataset.next) b.disabled = true;
    });
    $("#countControl").hidden = true;
    refreshCount();
  }

  // ---- Init ----
  refreshCount();
})();
