// Design mockups only. Shared header, theme, level switch, search and sample data.
(function () {
  const params = new URLSearchParams(location.search);
  const theme = params.get("theme") || localStorage.getItem("mock-theme") || "light";
  document.documentElement.dataset.theme = theme;

  // Sample prerequisites, drafted for the mockup (the real ones are authored per lesson and verified).
  const PREREQS = {
    "1.3": ["1.2"], "1.4": ["1.3"], "1.7": ["1.5"], "1.8": ["1.3"],
    "1.10": ["1.9"], "1.11": ["2.12"], "1.13": ["1.12", "3.4"], "1.14": ["1.13"], "1.15": ["1.6"], "1.16": ["2.1"],
    "2.2": ["2.1"], "2.3": ["2.2"], "2.4": ["2.3"], "2.5": ["2.2"], "2.7": ["2.6"], "2.9": ["1.7"], "2.10": ["2.4"],
    "2.11": ["2.3"], "2.12": ["2.6"], "2.13": ["2.8", "2.12"], "2.14": ["2.5"], "2.15": ["2.12"], "2.16": ["2.11"],
    "3.3": ["3.2"], "3.4": ["3.2"], "3.5": ["3.4"], "3.6": ["3.5"], "3.7": ["3.5", "2.11"], "3.8": ["3.6", "3.7"],
    "3.9": ["3.6", "2.5"], "3.10": ["3.6"], "3.11": ["3.7"], "3.13": ["3.12"], "3.14": ["3.12"], "3.15": ["3.14"],
    "3.16": ["3.13"], "3.17": ["3.16"], "3.18": ["3.15", "3.17"],
    "4.3": ["4.2"], "4.4": ["4.3"], "4.6": ["4.5"], "4.7": ["4.5"], "4.8": ["4.7", "1.9"], "4.9": ["4.7"],
    "4.10": ["4.4"], "4.11": ["4.6"], "4.12": ["4.9"], "4.13": ["4.11"], "4.14": ["4.7", "5.11"],
    "5.2": ["5.1"], "5.3": ["5.1"], "5.4": ["5.3", "2.1"], "5.5": ["5.3"], "5.6": ["5.3", "2.9", "3.7"],
    "5.7": ["5.6"], "5.8": ["5.7"], "5.9": ["5.8"], "5.10": ["5.5", "5.6"], "5.11": ["5.10"],
    "5.12": ["5.1"], "5.13": ["5.12"], "5.14": ["5.6", "5.8"], "5.15": ["5.6", "3.9"],
    "5.16": ["5.10", "5.15"], "5.17": ["5.11", "5.16"], "5.18": ["5.16"], "5.19": ["5.12", "1.8"],
  };
  // Demo progress so the "understood" state is visible.
  const DONE = new Set(["1.1", "1.2", "1.3", "1.4", "1.5", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "5.1", "5.2", "5.3", "5.4", "3.2", "4.5"]);

  const items = [];
  for (const t of window.AA.topics) for (const i of t.items) items.push({ ...i, topic: t });

  function level() { return localStorage.getItem("mock-level") || "HL"; }

  function header(active) {
    const el = document.createElement("header");
    el.className = "site-header";
    el.innerHTML = `
      <a class="logo" href="index.html">PastPaperPrep</a>
      <nav aria-label="Main">
        <a href="#">Question banks</a><a href="#">Past papers</a><a href="#" aria-current="page">Notes</a><a href="#">Pricing</a>
      </nav>
      <span class="spacer"></span>
      <button class="theme-btn" type="button">${theme === "dark" ? "Light" : "Dark"}</button>`;
    el.querySelector(".theme-btn").addEventListener("click", () => {
      localStorage.setItem("mock-theme", theme === "dark" ? "light" : "dark");
      const u = new URL(location.href); u.searchParams.delete("theme"); location.href = u;
    });
    document.body.prepend(el);
    if (active) {
      const tag = document.createElement("div");
      tag.className = "mock-label"; tag.textContent = active;
      document.body.append(tag);
    }
  }

  function levelSwitch(container, onChange) {
    container.innerHTML = `<div class="level-switch" role="group" aria-label="Level">
      <button type="button" data-l="SL">SL</button><button type="button" data-l="HL">HL</button></div>`;
    const paint = () => container.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.l === level())));
    container.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-l]"); if (!b) return;
      localStorage.setItem("mock-level", b.dataset.l); paint(); onChange && onChange(level());
    });
    paint();
  }

  function searchBox(container, href) {
    container.innerHTML = `<label class="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="search" placeholder="${innerWidth < 600 ? "What are you learning in class?" : "What are you learning in class? Try “2.5”, “by parts” or “Bayes”"}" aria-label="Search lessons"></label>
      <ul class="search-results" hidden></ul>`;
    const input = container.querySelector("input");
    const list = container.querySelector(".search-results");
    const syn = { "by parts": "5.16", "chain rule": "5.6", bayes: "4.13", inverse: "2.5", "de moivre": "1.14", sohcahtoa: "3.2", "sine rule": "3.2", induction: "1.15", "volume": "5.17", "normal": "4.9" };
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { list.hidden = true; return; }
      const hits = items.filter((i) => i.num.startsWith(q) || i.name.toLowerCase().includes(q) || Object.entries(syn).some(([k, v]) => k.includes(q) && v === i.num)).slice(0, 6);
      list.innerHTML = hits.length ? hits.map((i) => `<li><a href="${href(i)}"><span class="mono">${i.num}</span> ${i.name} ${i.level === "AHL" ? '<span class="badge badge-ahl">AHL</span>' : ""}</a></li>`).join("") : `<li class="none">No lesson matches “${input.value}”</li>`;
      list.hidden = false;
    });
  }

  window.MOCK = { items, PREREQS, DONE, level, header, levelSwitch, searchBox, topicVar: (n) => `var(--t${n})`, topicInk: (n) => `var(--t${n}-ink)` };
})();
