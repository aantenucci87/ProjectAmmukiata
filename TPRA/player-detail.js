const PLAYER_DETAIL_CACHE_KEY = "tpra:playerDetail";

function getParam(name, fallback = "") {
  const value = new URLSearchParams(window.location.search).get(name);
  return value && value.trim() !== "" ? value : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pickName(persona, fallback) {
  const parts = [];
  if (persona?.cognome) parts.push(persona.cognome);
  if (persona?.nome) parts.push(persona.nome);
  if (parts.length) return parts.join(" ");
  return persona?.nome_completo || fallback || "Giocatore";
}

function normalizePlayerData(raw, fallback = {}) {
  const root = raw?.result || raw?.results?.[0] || raw?.data || raw?.player || raw?.giocatore || raw || {};
  const persona = root?.persona || root?.giocatore || root;
  const classificaAttuale =
    persona.classifica_attuale ||
    persona.classificaAttuale ||
    root.classifica_attuale ||
    root.classificaAttuale ||
    {};

  const parseClassificaString = (value) => {
    if (!value || typeof value !== "string") return { fascia: "", coeff: "" };
    const parts = value.split(" Fascia - Coeff. ");
    if (parts.length === 2) {
      return { fascia: parts[0].trim(), coeff: parts[1].trim() };
    }
    return { fascia: "", coeff: "" };
  };

  const parsedClassificaString = parseClassificaString(classificaAttuale); // handles string form "4° Fascia - Coeff. 45.00"

  const name = pickName(persona, fallback.name);
  const city = persona.comune || persona.citta || persona.city || fallback.city;
  const province = persona.provincia || persona.province || fallback.province;
  const region = persona.regione || persona.region || fallback.region;

  const historyRaw = root.storico || root.storico_tornei || root.partite || fallback.history || [];
  const history = Array.isArray(historyRaw)
    ? historyRaw.map((item) => ({
        torneo: item.torneo || item.nome_torneo || item.nome || "-",
        circuito: item.circuito || item.nome_circuito || item.circuit || "",
        data: item.data || item.data_torneo || item.data_inizio || item.data_fine || "",
        esito: item.esito || item.fase || item.risultato || item.posizione || "",
        punti: item.punti || item.punteggio || item.tpra_points || item.score || "",
      }))
    : [];

  const palmaresRaw = root.palmares || root.titoli || root.risultati || fallback.palmares || [];
  const palmares = Array.isArray(palmaresRaw)
    ? palmaresRaw.map((item) => ({
        titolo: item.titolo || item.nome || item.torneo || "",
        anno: item.anno || item.year || item.data || "",
        esito: item.esito || item.risultato || item.posizione || "",
      }))
    : [];

  return {
    id: persona.id_persona || persona.id || fallback.id,
    name,
    category:
      classificaAttuale.fascia ||
      classificaAttuale.fascia_attuale ||
      classificaAttuale.categoria ||
      classificaAttuale.classe ||
      parsedClassificaString.fascia ||
      persona.categoria ||
      persona.classe ||
      fallback.category,
    ranking: persona.classifica || persona.classifica_tpra || persona.ranking || fallback.ranking,
    points: persona.punti || persona.punti_tpra || persona.points || fallback.points,
    power: persona.power || persona.power_medio || fallback.power,
    coeff:
      classificaAttuale.coefficiente ||
      classificaAttuale.coefficiente_attuale ||
      classificaAttuale.coeff ||
      parsedClassificaString.coeff ||
      persona.coeff ||
      persona.coefficiente ||
      fallback.coeff,
    club: persona.club || persona.circolo || persona.societa || fallback.club,
    locationLabel: [city, province, region].filter(Boolean).join(" · ") || fallback.locationLabel,
    hand: persona.mano || persona.hand || fallback.hand,
    age: persona.eta || persona.age || fallback.age,
    gender: persona.sesso || persona.gender || fallback.gender,
    city,
    province,
    region,
    history,
    palmares,
  };
}

function readCachedDetail(id) {
  try {
    const raw = sessionStorage.getItem(PLAYER_DETAIL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id && String(parsed.id) === String(id)) {
      return parsed.data;
    }
  } catch (_error) {}
  return null;
}

function cachePlayerDetail(id, data) {
  try {
    sessionStorage.setItem(PLAYER_DETAIL_CACHE_KEY, JSON.stringify({ id, data, ts: Date.now() }));
  } catch (_error) {}
}

async function fetchPlayerDetail(idPersona) {
  const response = await fetch("/api/giocatore-dettaglio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id_settore: 2, id_persona: idPersona }),
  });

  if (!response.ok) {
    throw new Error(`Impossibile recuperare il dettaglio giocatore (HTTP ${response.status})`);
  }

  return response.json();
}

function buildDetailCell(label, value) {
  if (value === undefined || value === null || String(value).trim() === "") return "";
  return `
    <article class="detail-cell">
      <span class="detail-label">${label}</span>
      <div class="detail-value">${escapeHtml(value)}</div>
    </article>
  `;
}

function renderHeroMeta(data) {
  const containerPrimary = document.getElementById("player-hero-meta");
  const containerSecondary = document.getElementById("player-hero-meta-secondary");

  const renderList = (container, entries) => {
    if (!container) return;
    const rows = entries
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .map(([label, value]) => {
        const row = document.createElement("div");
        row.className = "hero-meta-row";

        const lbl = document.createElement("span");
        lbl.className = "hero-meta-label";
        lbl.textContent = label;

        const val = document.createElement("span");
        val.className = "hero-meta-value";
        val.textContent = value;

        row.append(lbl, val);
        return row;
      });

    container.innerHTML = "";
    rows.forEach((row) => container.appendChild(row));
  };

  renderList(containerPrimary, [
    ["Fascia", data.category],
    ["Coefficiente", data.coeff],
  ]);

  renderList(containerSecondary, [
    ["Età", data.age],
    ["Circolo", data.club],
  ]);
}

function renderStatsSection(data) {
  const target = document.getElementById("player-stats");
  if (!target) return;

  // Placeholder: stats section will be repurposed; hide current metrics
  target.innerHTML = '<div class="detail-cell"><div class="detail-value">Statistiche in arrivo.</div></div>';
}

function renderHistorySection(history) {
  const target = document.getElementById("player-history");
  if (!target) return;

  if (!Array.isArray(history) || history.length === 0) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Storico tornei non disponibile.</div></div>';
    return;
  }

  const header = ["Torneo", "Circuito", "Data", "Esito", "Punti"];
  const rows = history
    .map((item) => {
      const cells = [
        escapeHtml(item.torneo || "-"),
        escapeHtml(item.circuito || "-"),
        escapeHtml(item.data || "-"),
        escapeHtml(item.esito || "-"),
        escapeHtml(item.punti || "-"),
      ]
        .map((value) => `<td>${value}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  target.innerHTML = `
    <div class="detail-cell">
      <h3 class="detail-group-title">Ultimi Risultati</h3>
      <div class="tournaments-table-wrap">
        <table class="tournaments-table">
          <thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPalmaresSection(items) {
  const target = document.getElementById("player-palmares");
  if (!target) return;

  if (!Array.isArray(items) || items.length === 0) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Palmares non disponibile.</div></div>';
    return;
  }

  const rows = items
    .map((item) => {
      const cols = [
        escapeHtml(item.titolo || item.nome || item.torneo || "-"),
        escapeHtml(item.anno || item.year || item.data || ""),
        escapeHtml(item.esito || item.risultato || item.posizione || ""),
      ]
        .map((value) => `<td>${value}</td>`)
        .join("");
      return `<tr>${cols}</tr>`;
    })
    .join("");

  target.innerHTML = `
    <div class="detail-cell">
      <h3 class="detail-group-title">Palmares</h3>
      <div class="tournaments-table-wrap">
        <table class="tournaments-table">
          <thead><tr><th>Evento</th><th>Anno</th><th>Esito</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}
async function initPlayerDetail() {
  const fallback = {
    name: getParam("name", "Giocatore"),
    id: getParam("id", ""),
    club: getParam("club", ""),
    city: getParam("city", ""),
    province: getParam("province", ""),
    region: getParam("region", ""),
    ranking: getParam("ranking", ""),
    points: getParam("points", ""),
    power: getParam("power", ""),
    coeff: getParam("coeff", ""),
    category: getParam("category", ""),
    hand: getParam("hand", ""),
    age: getParam("age", ""),
    gender: getParam("gender", ""),
  };

  const locationLabel = [fallback.city, fallback.province, fallback.region].filter(Boolean).join(" · ");

  const nameEl = document.getElementById("player-name");
  if (nameEl) {
    nameEl.textContent = fallback.name;
  }

  const subtitleEl = document.getElementById("player-subtitle");
  if (subtitleEl) {
    subtitleEl.textContent = fallback.city || locationLabel || "";
  }

  const cached = fallback.id ? readCachedDetail(fallback.id) : null;
  let detail = cached;

  if (!detail && fallback.id) {
    try {
      detail = await fetchPlayerDetail(fallback.id);
      cachePlayerDetail(fallback.id, detail);
    } catch (error) {
      console.error(error);
    }
  }

  const normalized = normalizePlayerData(detail, { ...fallback, locationLabel });
  renderStatsSection(normalized);
  renderHistorySection(normalized.history);
  renderPalmaresSection(normalized.palmares);
  renderHeroMeta(normalized);

  setupNavButtons();
}

initPlayerDetail();

function setupNavButtons() {
  const buttons = Array.from(document.querySelectorAll(".sidebar .menu-item[data-target]"));
  const sections = ["player-stats", "player-history", "player-palmares"];

  const showSection = (id) => {
    sections.forEach((sectionId) => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      el.classList.toggle("is-hidden", sectionId !== id);
    });

    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === id);
    });
  };

  buttons.forEach((btn) => {
    const targetId = btn.dataset.target;
    const el = targetId ? document.getElementById(targetId) : null;
    if (!el) return;
    btn.addEventListener("click", () => {
      showSection(targetId);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.focus?.();
    });
  });

  // Default to first button/section if available
  if (buttons.length) {
    const firstTarget = buttons[0].dataset.target;
    showSection(firstTarget);
  } else {
    sections.forEach((id) => document.getElementById(id)?.classList.add("is-hidden"));
  }
}
