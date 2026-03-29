const PLAYER_DETAIL_CACHE_KEY = "tpra:playerDetail";
const HISTORY_PAGE_SIZE = 12;
const historyState = {
  items: [],
  rowSkip: 0,
  fetchRows: HISTORY_PAGE_SIZE,
  loading: false,
  loaded: false,
  hasMore: true,
};

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

async function fetchPlayerPalmares(idGiocatore) {
  const response = await fetch("/api/giocatore-palmares", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id_giocatore: idGiocatore, id_settore: 2 }),
  });

  if (!response.ok) {
    throw new Error(`Impossibile recuperare il palmares (HTTP ${response.status})`);
  }

  return response.json();
}

async function fetchPlayerHistoryApi(idPersona, rowSkip = 0, fetchRows = HISTORY_PAGE_SIZE) {
  const payload = {
    id_persona: idPersona || "199522",
    id_settore: 2,
    tipo: null,
    rowstoskip: rowSkip,
    fetchrows: fetchRows,
  };

  const response = await fetch("/api/giocatore-ultimi-risultati", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Impossibile recuperare gli ultimi risultati (HTTP ${response.status})`);
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

function setHistoryLoadMoreLoading(isLoading) {
  const btn = document.getElementById("load-more-history");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Caricamento..." : "Carica altro";
}

function updateHistoryActionsVisibility(hasResults = historyState.items.length > 0) {
  const actions = document.getElementById("history-actions");
  const historySection = document.getElementById("player-history");
  if (!actions || !historySection) return;
  const historyVisible = !historySection.classList.contains("is-hidden");
  const shouldShow = historyVisible && hasResults && historyState.hasMore;
  actions.classList.toggle("is-hidden", !shouldShow);
}

function renderHistorySection(historyData) {
  const target = document.getElementById("player-history");
  if (!target) return;

  target.classList.add("history-cards");

  const asTournaments = Array.isArray(historyData) && historyData.length && historyData[0]?.matches
    ? historyData
    : Array.isArray(historyData) && historyData.length
    ? [
        {
          torneo: "Ultimi risultati",
          circuito: "",
          data: "",
          matches: historyData,
        },
      ]
    : [];

  if (!asTournaments.length) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Storico tornei non disponibile.</div></div>';
    return;
  }

  const renderMatchesTable = (matches) => {
    if (!Array.isArray(matches) || matches.length === 0) {
      return '<div class="detail-value">Nessuna partita disponibile.</div>';
    }

    const buildTeamBlock = (value) => {
      if (Array.isArray(value)) {
        const lines = value
          .map((entry) => {
            const persona = entry?.persona || entry;
            if (typeof persona === "string") {
              const raw = persona.trim();
              if (raw) return raw;
            }

            const full = persona?.nome_completo || persona?.nomeCompleto || "";
            const cognome = persona?.cognome || persona?.last_name || "";
            const nome = persona?.nome || persona?.first_name || "";
            const name = [cognome, nome].filter(Boolean).join(" ") || full;
            return name && String(name).trim() !== "" ? name : "";
          })
          .filter(Boolean);
        if (!lines.length) return "";
        return `<div class="team-block">${lines.map((line) => `<span class="team-line">${escapeHtml(line)}</span>`).join("")}</div>`;
      }

      if (!value || String(value).trim() === "") return "";
      const parts = String(value).split("/").map((p) => p.trim()).filter(Boolean);
      const lines = parts.length ? parts : [value];
      return `<div class="team-block">${lines.map((line) => `<span class="team-line">${escapeHtml(line)}</span>`).join("")}</div>`;
    };

    const colGroup = `
      <col class="board-win-col">
      <col class="board-team-col board-team-col-left">
      <col class="board-col-compact board-vs-col">
      <col class="board-team-col board-team-col-right">
      <col class="board-win-col">
      <col class="board-score-col">
    `;

    const rows = matches
      .map((match, idx) => {
        const team1 = buildTeamBlock(match.giocatori1 || match.giocatore1);
        const team2 = buildTeamBlock(match.giocatori2 || match.giocatore2);
        const win1 = match.win1 ? '<span class="board-win-icon">&#10003;</span>' : "";
        const win2 = match.win2 ? '<span class="board-win-icon">&#10003;</span>' : "";
        const score = escapeHtml(match.punteggio || "");
        const esito = escapeHtml(match.esito || "");
        return `<tr>
          <td class="board-col-compact board-win-col">${win1}</td>
          <td class="board-team-left">${team1 || "-"}</td>
          <td class="board-col-compact board-vs-col">vs.</td>
          <td class="board-team-right">${team2 || "-"}</td>
          <td class="board-col-compact board-win-col">${win2}</td>
          <td class="board-score-col">${score || esito || ""}</td>
        </tr>`;
      })
      .join("");

    return `
      <div class="tournaments-table-wrap">
        <table class="tournaments-table">
          <colgroup>${colGroup}</colgroup>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  const sections = asTournaments
    .map((tournament) => {
      const subtitleParts = [tournament.circuito].filter(Boolean).join(" · ");
      const showPoints = tournament?.squadre === 0 && tournament?.punti !== undefined && tournament?.punti !== null;
      const pointsTag = showPoints ? `<span class="tournament-points">Punti: ${escapeHtml(tournament.punti)}</span>` : "";
      return `
        <article class="detail-cell history-card">
          <h3 class="detail-group-title">${escapeHtml(tournament.torneo || "Torneo")}${pointsTag ? ` ${pointsTag}` : ""}</h3>
          ${subtitleParts ? `<div class="detail-subtitle">${escapeHtml(subtitleParts)}</div>` : ""}
          ${renderMatchesTable(tournament.matches)}
        </article>
      `;
    })
    .join("");

  target.innerHTML = sections;
}

async function loadHistorySection(idPersona, { append = false } = {}) {
  const target = document.getElementById("player-history");
  if (!target) return;

  const playerId = idPersona || getParam("id", "199522") || "199522";
  if (!playerId) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">ID giocatore mancante.</div></div>';
    updateHistoryActionsVisibility(false);
    return;
  }

  if (historyState.loading) return;

  if (!append) {
    historyState.items = [];
    historyState.rowSkip = 0;
    historyState.hasMore = true;
  }

  historyState.loading = true;
  setHistoryLoadMoreLoading(true);

  if (!append) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Caricamento ultimi risultati...</div></div>';
  }

  try {
    const data = await fetchPlayerHistoryApi(playerId, historyState.rowSkip, historyState.fetchRows);
    const list = Array.isArray(data?.results) ? data.results : data?.result || data?.data || data;
    const pick = (obj, keys, fallback = "") => {
      for (const key of keys) {
        const value = obj?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
      return fallback;
    };

    const tournaments = Array.isArray(list)
      ? list.map((item, idx) => {
          const matchesRaw = item?.partite || item?.matches || item?.incontri || item?.lista_partite || [];

          const pickPlayersArray = (obj, keys) => {
            for (const key of keys) {
              const value = obj?.[key];
              if (Array.isArray(value)) return value;
            }
            return [];
          };

          const matches = Array.isArray(matchesRaw)
            ? matchesRaw.map((match) => ({
                win1: pick(match, ["ft_win", "vittoria_team1", "win1", "winner_team1"], false) === true,
                win2: pick(match, ["st_win", "vittoria_team2", "win2", "winner_team2"], false) === true,
                giocatori1: (() => {
                  const arr =
                    pickPlayersArray(match, ["giocatori1", "giocatori_1", "players1", "team1", "squadra1", "partecipanti1"]) ||
                    pickPlayersArray(match, ["giocatori", "team"]);
                  if (Array.isArray(arr) && arr.length) return arr;
                  return pick(
                    match,
                    [
                      "giocatore1",
                      "giocatori1",
                      "player1",
                      "team1",
                      "tesserato1",
                      "nome_giocatore1",
                      "nome_team1",
                    ],
                    ""
                  );
                })(),
                giocatori2: (() => {
                  const arr =
                    pickPlayersArray(match, ["giocatori2", "giocatori_2", "players2", "team2", "squadra2", "partecipanti2"]) ||
                    pickPlayersArray(match, ["avversari", "opponenti"]);
                  if (Array.isArray(arr) && arr.length) return arr;
                  return pick(
                    match,
                    [
                      "giocatore2",
                      "giocatori2",
                      "player2",
                      "team2",
                      "tesserato2",
                      "nome_giocatore2",
                      "nome_team2",
                    ],
                    ""
                  );
                })(),
                esito: pick(match, ["esito", "risultato", "outcome", "fase"], ""),
                punteggio: pick(match, ["punteggio", "score", "risultato_partita", "punteggio_match", "punteggio_partita"], ""),
                punti: pick(match, ["punti", "tpra_points", "score_totale", "score"], ""),
              }))
            : [];

          return {
            torneo: pick(item, ["denominazione", "torneo", "nome", "nome_torneo", "titolo"], `Torneo ${idx + 1}`),
            circuito: pick(item, ["circuito", "nome_circuito", "circuit"], ""),
            squadre: pick(item, ["squadre", "num_squadre", "numero_squadre"], null),
            punti: pick(item, ["punti", "punteggio", "points"], null),
            matches,
          };
        })
      : [];

    const batchLength = Array.isArray(tournaments) ? tournaments.length : 0;
    historyState.items = append ? historyState.items.concat(tournaments) : tournaments;
    historyState.rowSkip += historyState.fetchRows;
    historyState.loaded = true;
    historyState.hasMore = batchLength > 0;

    renderHistorySection(historyState.items);
    updateHistoryActionsVisibility(historyState.items.length > 0);
  } catch (error) {
    console.error(error);
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Errore nel caricamento degli ultimi risultati.</div></div>';
    historyState.hasMore = false;
    updateHistoryActionsVisibility(false);
  } finally {
    historyState.loading = false;
    setHistoryLoadMoreLoading(false);
  }
}

function renderPalmaresSection(items) {
  const target = document.getElementById("player-palmares");
  if (!target) return;

  if (!Array.isArray(items) || items.length === 0) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Palmares non disponibile.</div></div>';
    return;
  }

  const pick = (obj, keys, fallback = "-") => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  };

  const mapRisultato = (value) => {
    if (!value) return value;
    const key = String(value).trim().toUpperCase();
    const dict = {
      W: "Winner",
      F: "Finale",
      SF: "Semifinale",
      QF: "Qualificato",
    };
    return dict[key] || value;
  };

  const parseDenominazione = (value) => {
    if (!value) return { tipo: "", circuito: "", categoria: "" };

    const text = String(value);
    const lower = text.toLowerCase();

    const levelIdx = lower.indexOf("level");
    let tipo = "";
    if (levelIdx >= 0) {
      const after = text.slice(levelIdx + "level".length);
      const nextSep = after.search(/[-–|]/);
      tipo = (nextSep >= 0 ? after.slice(0, nextSep) : after).trim();
    }

    const fasciaIdx = lower.indexOf("fascia");
    let circuito = "";
    if (fasciaIdx > 0) {
      circuito = text.slice(0, fasciaIdx).replace(/[-–|]+\s*$/g, "").trim();
    }

    const doppioIdx = lower.indexOf("doppio", fasciaIdx >= 0 ? fasciaIdx : 0);
    let categoria = "";
    if (fasciaIdx >= 0 && doppioIdx > fasciaIdx) {
      categoria = text
        .slice(fasciaIdx + "fascia".length, doppioIdx)
        .replace(/^[:\s-]+|[:\s-]+$/g, "")
        .trim();
    }

    return { tipo, circuito, categoria };
  };

  const parseDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    // ISO or native-parsable
    const native = new Date(raw);
    if (!Number.isNaN(native.getTime())) return native.getTime();

    // Year-only (e.g. "2024")
    const yearMatch = raw.match(/^(20\d{2}|19\d{2})$/);
    if (yearMatch) {
      return new Date(Number(yearMatch[1]), 0, 1).getTime();
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = raw.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }

    // MM/DD/YYYY
    const mdy = raw.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (mdy) {
      const [, m, d, y] = mdy;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }

    return null;
  };

  const normalized = items.map((item, idx) => {
    const dataRaw =
      pick(item, ["data_inizio", "data", "inizio", "anno", "year", "data_fine"], "") || "";
    const denominazione = pick(item, ["denominazione", "nome", "titolo", "torneo"], `Torneo ${idx + 1}`);
    const tipoOriginal = pick(item, ["tipo", "tipo_torneo", "tipologia", "categoria"], "");
    const esito = pick(item, ["esito", "posizione", "risultato", "fase"], "");
    const punti = pick(item, ["punti", "punteggio", "score", "tpra_points"], "");
    const circuito = pick(item, ["circuito", "nome_circuito", "circuit"], "");
    const luogo = pick(item, ["citta", "luogo", "location", "comune", "sede"], "");
    const categoria = pick(item, ["categoria", "categoria_torneo", "livello"], "");

    const derived = parseDenominazione(denominazione);

    const tipoFinal = derived.tipo || tipoOriginal;
    const circuitoFinal = derived.circuito || circuito;
    const categoriaFinal = derived.categoria || categoria;
    const risultatoMapped = mapRisultato(tipoOriginal);

    const ts = parseDate(dataRaw);
    const dateLabel = dataRaw || "Data N/D";

    return {
      ts,
      dateLabel,
      denominazione,
      tipo: tipoFinal,
      risultato: risultatoMapped,
      esito,
      punti,
      circuito: circuitoFinal,
      luogo,
      categoria: categoriaFinal,
    };
  });

  normalized.sort((a, b) => {
    const tsA = a.ts ?? -Infinity;
    const tsB = b.ts ?? -Infinity;
    return tsB - tsA;
  });

  const cards = normalized
    .map((item, idx) => {
      const side = idx % 2 === 0 ? "left" : "right";
      const pointsTag = item.punti ? `<span class="timeline-pill">${escapeHtml(item.punti)} pt</span>` : "";
      const title = item.circuito || item.denominazione;

      const detailItems = [
        { label: "Esito", value: item.esito },
        { label: "Luogo", value: item.luogo },
      ]
        .filter((row) => row.value && String(row.value).trim() !== "")
        .map(
          (row) => `
            <div class="timeline-detail">
              <span class="timeline-detail-label">${escapeHtml(row.label)}</span>
              <span class="timeline-detail-value">${escapeHtml(row.value)}</span>
            </div>
          `
        )
        .join("");

      const catTipoBlock =
        item.categoria || item.tipo
          ? `<div class="timeline-detail cat-tipo">
              ${item.categoria ? `<div class="timeline-detail-label">Categoria</div><div class="timeline-detail-value">${escapeHtml(item.categoria)}</div>` : ""}
              ${item.tipo ? `<div class="timeline-detail-label">Tipo</div><div class="timeline-detail-value">${escapeHtml(item.tipo)}</div>` : ""}
             </div>`
          : "";

      const risultatoBlock = item.risultato || pointsTag
        ? `<div class="timeline-detail risultato-block">
             <span class="timeline-detail-label">Risultato</span>
             ${item.risultato ? `<span class="timeline-detail-value">${escapeHtml(item.risultato)}</span>` : ""}
             ${pointsTag ? `<span class="timeline-detail-value pill-row">${pointsTag}</span>` : ""}
           </div>`
        : "";

      return `
        <article class="timeline-item timeline-${side}">
          <span class="timeline-dot" aria-hidden="true"></span>
          <div class="timeline-card">
            <header class="timeline-card-header">
              <div class="timeline-heading">
                <p class="timeline-date">${escapeHtml(item.dateLabel)}</p>
                <h4 class="timeline-title">${escapeHtml(title || "Torneo")}</h4>
              </div>
            </header>
            ${catTipoBlock || risultatoBlock || detailItems
              ? `<div class="timeline-detail-grid">${catTipoBlock}${risultatoBlock}${detailItems}</div>`
              : ""}
          </div>
        </article>
      `;
    })
    .join("");

  target.innerHTML = `
    <div class="detail-group palmares-timeline">
      <h3 class="detail-group-title">Palmares</h3>
      <div class="timeline-list" role="list">${cards}</div>
    </div>
  `;
}

async function loadPalmaresSection(idGiocatore) {
  const target = document.getElementById("player-palmares");
  if (!target) return;
  if (!idGiocatore) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">ID giocatore mancante.</div></div>';
    return;
  }

  target.innerHTML = '<div class="detail-cell"><div class="detail-value">Caricamento palmares...</div></div>';
  try {
    const data = await fetchPlayerPalmares(idGiocatore);
    const list = Array.isArray(data?.results) ? data.results : data?.result || data?.data || data;
    const items = Array.isArray(list) ? list : [];
    renderPalmaresSection(items);
  } catch (error) {
    console.error(error);
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Errore nel caricamento del palmares.</div></div>';
  }
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
  renderPalmaresSection(normalized.palmares);
  renderHeroMeta(normalized);

  setupHistoryLoadMore();
  setupNavButtons();

  const playerId = fallback.id || "199522";
  loadHistorySection(playerId);
}

initPlayerDetail();

function setupHistoryLoadMore() {
  const btn = document.getElementById("load-more-history");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const currentId = getParam("id", "199522") || "199522";
    loadHistorySection(currentId, { append: true });
  });
}

function setupNavButtons() {
  const buttons = Array.from(document.querySelectorAll(".sidebar .menu-item[data-target]"));
  const sections = ["player-stats", "player-history", "player-palmares"];

  let activeSectionId = null;

  const showSection = (id) => {
    activeSectionId = id;
    sections.forEach((sectionId) => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      el.classList.toggle("is-hidden", sectionId !== id);
    });

    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === id);
    });

    updateHistoryActionsVisibility();
  };

  buttons.forEach((btn) => {
    const targetId = btn.dataset.target;
    const el = targetId ? document.getElementById(targetId) : null;
    if (!el) return;
    btn.addEventListener("click", () => {
      showSection(targetId);
      if (targetId === "player-palmares") {
        const currentId = getParam("id", "");
        loadPalmaresSection(currentId);
      } else if (targetId === "player-history") {
        const currentId = getParam("id", "199522") || "199522";
        if (!historyState.loaded) {
          loadHistorySection(currentId);
        }
      }
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
