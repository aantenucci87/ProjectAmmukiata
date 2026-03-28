function getDetailParam(name, fallback = "") {
  const value = new URLSearchParams(window.location.search).get(name);
  return value && value.trim() !== "" ? value : fallback;
}

function buildDetailCell(label, value, options = {}) {
  const isHtml = options.isHtml === true;
  const safeValue = value || "N/D";
  return `
    <article class="detail-cell">
      <span class="detail-label">${label}</span>
      <div class="detail-value">${isHtml ? safeValue : escapeHtml(safeValue)}</div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNameWithSurnameFirst(rawName) {
  if (!rawName || String(rawName).trim() === "") {
    return '<span class="fighter-surname">N/D</span>';
  }

  const normalized = String(rawName).trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");

  if (parts.length === 1) {
    return `<span class="fighter-surname">${escapeHtml(parts[0])}</span>`;
  }

  const surname = parts.pop();
  const givenNames = parts.join(" ");
  const surnameHtml = `<span class="fighter-surname">${escapeHtml(surname)}</span>`;
  const givenHtml = givenNames ? ` ${escapeHtml(givenNames)}` : "";

  return `${surnameHtml}${givenHtml}`;
}

function splitNameParts(rawName) {
  if (!rawName || String(rawName).trim() === "") {
    return { surname: "N/D", given: "" };
  }

  const normalized = String(rawName).trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");

  if (parts.length === 1) {
    return { surname: parts[0], given: "" };
  }

  const surname = parts.pop();
  const given = parts.join(" ");
  return { surname, given };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function loadTournamentFighters(idTorneo) {
  const fightersSection = document.getElementById("detail-fighters");
  setLoading("detail-fighters", true);
  try {
    const payload = { id: idTorneo, id_torneo: idTorneo };
    const data = await postJson("/api/torneo-iscritti", payload);
    const record = Array.isArray(data?.results) ? data.results[0] : data?.result || data?.data || data;
    renderFightersSection(record, fightersSection);
  } catch (error) {
    fightersSection.innerHTML = '<div class="detail-cell"><div class="detail-value">Errore nel caricamento dei fighters.</div></div>';
    console.error(error);
  }
}

async function loadTournamentBracket(idTorneo) {
  const boardSection = document.getElementById("detail-board");
  setLoading("detail-board", true);

  const renderTabsShell = (showGirone = true) => {
    const tabsHtml = showGirone
      ? `
          <button class="board-tab is-active" data-tab="girone" role="tab" aria-selected="true">Girone</button>
          <button class="board-tab" data-tab="finale" role="tab" aria-selected="false">Tabellone Finale</button>
        `
      : `
          <button class="board-tab is-active" data-tab="finale" role="tab" aria-selected="true">Tabellone Finale</button>
        `;

    boardSection.innerHTML = `
      <div class="detail-cell">
        <div class="board-tabs" role="tablist" aria-label="Tabelloni">
          ${tabsHtml}
        </div>
        <div id="board-tab-panel" class="board-panel" role="tabpanel"></div>
      </div>
    `;
    return document.getElementById("board-tab-panel");
  };

  const setPanelLoading = (panel) => {
    panel.innerHTML = '<div class="board-panel-loading">Caricamento...</div>';
  };

  const setPanelError = (panel, message) => {
    panel.innerHTML = `<div class="detail-cell"><div class="detail-value">${escapeHtml(message)}</div></div>`;
  };

  try {
    // Recupera gli ID tabellone partenza/conclusivo dalla scheda torneo (dettaglio)
    const detailPayload = { id: idTorneo, id_torneo: idTorneo };
    const detailResp = await postJson("/api/torneo-dettaglio", detailPayload);
    const rawDetail = detailResp?.result || detailResp?.results || detailResp?.data || detailResp;
    const detailEntry = Array.isArray(rawDetail) ? rawDetail[0] : rawDetail;
    const startId = detailEntry?.id_tabellone_partenza;
    const finalId = detailEntry?.id_tabellone_conclusivo;
    const formulaId = Number(detailEntry?.id_formula_svolgimento);

    if (formulaId !== 1 && formulaId !== 2) {
      boardSection.innerHTML = '<div class="detail-cell"><div class="detail-value">Tabellone e ordine di gioco non disponibili per questa formula.</div></div>';
      return;
    }

    if (formulaId === 1 && !startId && !finalId) {
      boardSection.innerHTML = '<div class="detail-cell"><div class="detail-value">Nessun tabellone disponibile.</div></div>';
      return;
    }

    const showGirone = formulaId === 1;
    const panel = renderTabsShell(showGirone);
    const tabs = boardSection.querySelectorAll(".board-tab");
    
    const loadView = async (type) => {
      tabs.forEach((btn) => {
        const isActive = btn.dataset.tab === type;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      // For formula 2 the finale uses the starting board ID instead of the concluding one
      const idTabellone = type === "girone" ? startId : formulaId === 2 ? startId : finalId;
      if (!idTabellone) {
        setPanelError(panel, type === "girone" ? "Tabellone di partenza non disponibile." : "Tabellone finale non disponibile.");
        return;
      }

      setPanelLoading(panel);
      try {
        const viewPayload = { id_torneo: idTorneo, id_tabellone: idTabellone };

        if (type === "girone") {
          const [tabelloniResp, classificheResp] = await Promise.allSettled([
            postJson("/api/torneo-tabelloni", viewPayload),
            postJson("/api/torneo-gironi-classifiche", viewPayload),
          ]);

          if (tabelloniResp.status !== "fulfilled") {
            setPanelError(panel, "Errore nel caricamento del tabellone.");
            console.error(tabelloniResp.reason);
            return;
          }

          const viewData = tabelloniResp.value;
          const viewContent = viewData?.result || viewData?.results || viewData?.data || viewData;
          const classifiche = classificheResp.status === "fulfilled" ? classificheResp.value : null;
          if (classificheResp.status === "rejected") console.error("Errore classifica gironi", classificheResp.reason);

          renderGironeView(viewContent, panel, classifiche);
        } else {
          const viewData = await postJson("/api/torneo-tabelloni", viewPayload);
          const viewContent = viewData?.result || viewData?.results || viewData?.data || viewData;
          renderFinaleView(viewContent, panel);
        }
      } catch (error) {
        setPanelError(panel, "Errore nel caricamento del tabellone.");
        console.error(error);
      }
    };

    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        loadView(btn.dataset.tab);
      });
    });

    await loadView(showGirone ? "girone" : "finale");
  } catch (error) {
    boardSection.innerHTML = '<div class="detail-cell"><div class="detail-value">Errore nel caricamento del tabellone.</div></div>';
    console.error(error);
  }
}

function renderTableFromArray(items, target, options = {}) {
  const wrapInCell = options.wrapInCell !== false;

  if (!Array.isArray(items) || items.length === 0) {
    target.innerHTML = '<div class="detail-cell"><span class="detail-label">Info</span><div class="detail-value">Nessun dato disponibile.</div></div>';
    return;
  }

  const headers = Object.keys(items[0]);
  const headerRow = headers.map((h) => `<th>${h}</th>`).join("");
  const rows = items
    .map((row) => `<tr>${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`)
    .join("");

  const body = `
    <div class="tournaments-table-wrap">
      <table class="tournaments-table">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  target.innerHTML = wrapInCell ? `<div class="detail-cell">${body}</div>` : body;
}

function renderKeyValueGrid(data, target, options = {}) {
  const wrapInCell = options.wrapInCell !== false;

  if (!data || typeof data !== "object") {
    target.innerHTML = '<div class="detail-cell"><span class="detail-label">Info</span><div class="detail-value">Nessun dato disponibile.</div></div>';
    return;
  }

  const entries = Object.entries(data);
  const content = entries.map(([label, value]) => buildDetailCell(label, value)).join("");
  target.innerHTML = wrapInCell ? content : content;
}

function renderGironeView(data, target, classificheData) {
  const asArray = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  const root = asArray.length > 0 ? asArray[0] : data;
  const fasi = Array.isArray(root?.fasi) ? root.fasi : Array.isArray(data?.fasi) ? data.fasi : [];

  const parseNumber = (value) => {
    if (value === null || value === undefined) return NaN;
    const str = String(value).trim();
    if (!str) return NaN;
    const normalized = str.includes(",") && !str.includes(".") ? str.replace(/,/g, ".") : str;
    const cleaned = normalized.replace(/[^\d.+-]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : NaN;
  };

  const buildClassificaTable = (rows, passPairs = 0) => {
    if (!Array.isArray(rows) || rows.length === 0) return "";

    const keys = Object.keys(rows[0] || {}).filter((k) => k !== "id_giocatore");
    if (!keys.length) return "";

    const formatHeader = (label) =>
      label
        .replace(/_/g, " ")
        .split(" ")
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ""))
        .join(" ");

    const header = keys.map((k) => `<th>${escapeHtml(formatHeader(k))}</th>`).join("");

    const normalizeKey = (value) =>
      (value || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const toNumber = (value) => parseNumber(value);

    const positionKey = keys.find((k) => {
      const nk = normalizeKey(k);
      return (
        nk === "posizione" ||
        nk === "posizione_classifica" ||
        nk === "posizione_girone" ||
        nk === "rank" ||
        nk.startsWith("pos") ||
        nk.includes("_pos")
      );
    });

    const sortedRows = positionKey
      ? [...rows].sort((a, b) => {
          const av = toNumber(a[positionKey]);
          const bv = toNumber(b[positionKey]);
          if (Number.isFinite(av) && Number.isFinite(bv)) return av - bv;
          if (Number.isFinite(av)) return -1;
          if (Number.isFinite(bv)) return 1;
          return 0;
        })
      : rows;

    const colgroup = keys
      .map((k, idx) => {
        const nk = normalizeKey(k);
        const isPlayerCol = nk === "giocatori" || nk === "giocatore";
        const isRankCol = idx === 0 || nk === "posizione" || nk.startsWith("pos") || nk.includes("_pos");
        const colClass = isPlayerCol ? "classifica-col-player" : isRankCol ? "classifica-col-rank" : "classifica-col-metric";
        return `<col class="${colClass}">`;
      })
      .join("");

    const body = sortedRows
      .map((row, idxRow) => {
        const cells = keys
          .map((k, idx) => {
            const value = row[k] ?? "";
            const isPlayerCol = normalizeKey(k) === "giocatori" || normalizeKey(k) === "giocatore";
            const alignClass = isPlayerCol ? "classifica-col-player" : idx === 0 ? "classifica-col-rank" : "classifica-col-center";
            return `<td class="${alignClass}">${escapeHtml(value)}</td>`;
          })
          .join("");
        const qualifies = passPairs > 0 && idxRow < passPairs;
        const qualifiedClass = qualifies ? " classifica-qualified" : "";
        return `<tr class="${qualifiedClass.trim()}">${cells}</tr>`;
      })
      .join("");

    return `
      <div class="tournaments-table-wrap classifica-table-wrap">
        <table class="tournaments-table classifica-table">
          <colgroup>${colgroup}</colgroup>
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  };

  const classificationArray = Array.isArray(classificheData?.results)
    ? classificheData.results
    : Array.isArray(classificheData)
    ? classificheData
    : [];

  const normalizeKey = (value) =>
    (value || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const classificheByName = new Map(
    classificationArray.map((entry, idx) => {
      const key = normalizeKey(entry.nome_girone || entry.nome_fase || entry.nome || idx);
      return [key, entry];
    })
  );

  if (!fasi.length) {
    if (Array.isArray(data)) {
      renderTableFromArray(data, target, { wrapInCell: false });
    } else {
      target.innerHTML = '<div class="detail-cell"><div class="detail-value">Nessuna partita disponibile.</div></div>';
    }
    return;
  }

  const buildTeamBlock = (players) => {
    if (!Array.isArray(players) || players.length === 0) return "";
    const lines = players
      .map((p) => `${escapeHtml(p.cognome || "")} ${escapeHtml(p.nome || "")}`.trim())
      .filter(Boolean)
      .map((line) => `<span class="team-line">${line}</span>`);
    return `<div class="team-block">${lines.join("")}</div>`;
  };

  const buildScore = (match) => {
    const sets = [1, 2, 3, 4, 5]
      .map((i) => {
        const ft = match[`ft_${i}_set`];
        const st = match[`st_${i}_set`];
        if (ft === null || ft === undefined || st === null || st === undefined) return null;
        return `${escapeHtml(ft)}-${escapeHtml(st)}`;
      })
      .filter(Boolean);
    return sets.length ? sets.join(" · ") : "";
  };

  const collectSets = (match) => {
    const sets = [];
    for (let i = 1; i <= 5; i++) {
      const ft = match[`ft_${i}_set`];
      const st = match[`st_${i}_set`];
      if (ft === null && st === null) continue;
      if (ft === undefined && st === undefined) continue;
      sets.push({ ft, st });
    }
    return sets;
  };

  const renderSetColumns = (sets) => {
    if (!Array.isArray(sets) || sets.length === 0) {
      return '<div class="bracket-setcol is-empty"><span class="bracket-set-score">—</span><span class="bracket-set-score">—</span></div>';
    }

    return sets
      .map((set, idx) => {
        const ftNum = parseNumber(set.ft);
        const stNum = parseNumber(set.st);
        const ftHigher = Number.isFinite(ftNum) && Number.isFinite(stNum) && ftNum > stNum;
        const stHigher = Number.isFinite(ftNum) && Number.isFinite(stNum) && stNum > ftNum;
        const ftVal = set.ft !== null && set.ft !== undefined && String(set.ft).trim() !== "" ? escapeHtml(set.ft) : "—";
        const stVal = set.st !== null && set.st !== undefined && String(set.st).trim() !== "" ? escapeHtml(set.st) : "—";
        return `
          <div class="bracket-setcol" aria-label="Set ${idx + 1}">
            <span class="bracket-set-score${ftHigher ? " is-higher" : ""}">${ftVal}</span>
            <span class="bracket-set-score${stHigher ? " is-higher" : ""}">${stVal}</span>
          </div>
        `;
      })
      .join("");
  };

  const renderPartiteTable = (partite) => {
    if (!Array.isArray(partite) || partite.length === 0) return '<div class="detail-cell"><div class="detail-value">Nessuna partita disponibile.</div></div>';

    const colGroup = `
      <col class="board-col-compact board-col-id">
      <col class="board-col-date">
      <col class="board-win-col">
      <col class="board-team-col board-team-col-left">
      <col class="board-col-compact board-vs-col">
      <col class="board-team-col board-team-col-right">
      <col class="board-win-col">
      <col class="board-score-col">
    `;

    const rows = partite
      .map((p) => {
        const team1 = buildTeamBlock(p.giocatori_1);
        const team2 = buildTeamBlock(p.giocatori_2);
        const score = buildScore(p) || (p.ft_win ? "W" : p.st_win ? "W" : "");
        const dataMatch = p.data_partita ? escapeHtml(p.data_partita) : "";
        const win1 = p.ft_win ? '<span class="board-win-icon">&#10003;</span>' : "";
        const win2 = p.st_win ? '<span class="board-win-icon">&#10003;</span>' : "";
        return `<tr>
          <td class="board-col-compact">${escapeHtml(p.contatore_partita ?? "")}</td>
          <td class="board-col-compact">${dataMatch}</td>
          <td class="board-col-compact board-win-col">${win1}</td>
          <td class="board-team-left">${team1 || ""}</td>
          <td class="board-col-compact board-vs-col">vs.</td>
          <td class="board-team-right">${team2 || ""}</td>
          <td class="board-col-compact board-win-col">${win2}</td>
          <td class="board-score-col">${score}</td>
        </tr>`;
      })
      .join("");

    return `
      <div class="tournaments-table-wrap">
        <table class="tournaments-table">
          <colgroup>
            ${colGroup}
          </colgroup>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };
  const html = fasi
    .map((fase) => {
      const titolo = fase.nome_fase || fase.nome || "Girone";
      const table = renderPartiteTable(fase.partite);
      const classificaEntryKey = normalizeKey(titolo);
      const classificaEntry = classificheByName.get(classificaEntryKey) || null;
      const passPairs = Math.max(
        0,
        Math.floor(
          parseNumber(classificaEntry?.numero_giocatori_passati) ||
            parseNumber(classificaEntry?.numero_di_giocatori_passati) ||
            parseNumber(fase?.numero_giocatori_passati) ||
            parseNumber(fase?.numero_di_giocatori_passati) ||
            0
        )
      );
      const classificaHtml = buildClassificaTable(classificaEntry?.gicotori || classificaEntry?.giocatori || [], passPairs);
      const classificaSection = classificaHtml
        ? `<h5 class="board-subtitle">Classifica</h5>${classificaHtml}`
        : "";

      const partiteToggle = table
        ? `<button type="button" class="board-toggle-inline" data-target="partite" aria-expanded="false" title="Mostra/Nascondi partite">▼</button>`
        : "";

      const partiteSection = table
        ? `<div class="board-partite-header"><h5 class="board-subtitle">Partite</h5>${partiteToggle}</div><div class="board-partite is-hidden" data-target="partite">${table}</div>`
        : table;

      return `
        <section class="board-group">
          <h4 class="board-group-title">GIRONE ${escapeHtml(titolo)}</h4>
          ${classificaSection}
          ${partiteSection}
        </section>
      `;
    })
    .join("");

  target.innerHTML = html || '<div class="detail-cell"><div class="detail-value">Nessuna partita disponibile.</div></div>';

  // Setup inline toggle per partite
  const toggleButtons = target.querySelectorAll('.board-toggle-inline');
  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetType = btn.dataset.target;
      const partiteBlock = btn.closest('.board-group')?.querySelector(`.board-partite[data-target="${targetType}"]`);
      if (!partiteBlock) return;
      const isHidden = partiteBlock.classList.toggle('is-hidden');
      btn.classList.toggle('is-active', !isHidden);
      btn.textContent = isHidden ? '▼' : '▲';
      btn.setAttribute('aria-expanded', (!isHidden).toString());
    });
  });
}

function renderFinaleView(data, target) {
  const asArray = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  const root = asArray.length > 0 ? asArray[0] : data;
  const fasi = Array.isArray(root?.fasi) ? root.fasi : Array.isArray(data?.fasi) ? data.fasi : [];

  const parseNumber = (value) => {
    if (value === null || value === undefined) return NaN;
    const str = String(value).trim();
    if (!str) return NaN;
    const normalized = str.includes(",") && !str.includes(".") ? str.replace(/,/g, ".") : str;
    const cleaned = normalized.replace(/[^\d.+-]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : NaN;
  };

  const buildTeamBlock = (players) => {
    if (!Array.isArray(players) || players.length === 0) return "";
    const lines = players
      .map((p) => `${escapeHtml(p.cognome || "")} ${escapeHtml(p.nome || "")}`.trim())
      .filter(Boolean)
      .map((line) => `<span class="team-line">${line}</span>`);
    return `<div class="team-block">${lines.join("")}</div>`;
  };

  const buildScore = (match) => {
    const sets = [1, 2, 3, 4, 5]
      .map((i) => {
        const ft = match[`ft_${i}_set`];
        const st = match[`st_${i}_set`];
        if (ft === null || ft === undefined || st === null || st === undefined) return null;
        return `${escapeHtml(ft)}-${escapeHtml(st)}`;
      })
      .filter(Boolean);
    return sets.length ? sets.join(" · ") : "";
  };

  const normalizePhaseName = (value) => (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  const isFinalPhaseName = (value) => normalizePhaseName(value) === "finale";
  const isSemiPhaseName = (value) => normalizePhaseName(value) === "semifinale";
  const isQuarterPhaseName = (value) => {
    const normalized = normalizePhaseName(value);
    return normalized === "quarti di finale" || normalized === "quarti";
  };

  const formatTeamBlock = (players) => {
    if (!Array.isArray(players) || players.length === 0) return '<div class="team-block"><span class="team-line">Bye</span></div>';
    const lines = players
      .map((p) => `${escapeHtml(p.cognome || "")} ${escapeHtml(p.nome || "")}`.trim())
      .filter(Boolean)
      .map((line) => `<span class="team-line">${line}</span>`)
      .join("");
    return `<div class="team-block">${lines || '<span class="team-line">Bye</span>'}</div>`;
  };

  const collectSets = (match) => {
    const sets = [];
    for (let i = 1; i <= 5; i++) {
      const ft = match[`ft_${i}_set`];
      const st = match[`st_${i}_set`];
      if (ft === null && st === null) continue;
      if (ft === undefined && st === undefined) continue;
      sets.push({ ft, st });
    }
    return sets;
  };

  const renderSetColumns = (sets) => {
    if (!Array.isArray(sets) || sets.length === 0) {
      return '<div class="bracket-setcol is-empty"><span class="bracket-set-score">—</span><span class="bracket-set-score">—</span></div>';
    }

    return sets
      .map((set, idx) => {
        const ftNum = parseNumber(set.ft);
        const stNum = parseNumber(set.st);
        const ftHigher = Number.isFinite(ftNum) && Number.isFinite(stNum) && ftNum > stNum;
        const stHigher = Number.isFinite(ftNum) && Number.isFinite(stNum) && stNum > ftNum;
        const ftVal = set.ft !== null && set.ft !== undefined && String(set.ft).trim() !== "" ? escapeHtml(set.ft) : "—";
        const stVal = set.st !== null && set.st !== undefined && String(set.st).trim() !== "" ? escapeHtml(set.st) : "—";
        return `
          <div class="bracket-setcol" aria-label="Set ${idx + 1}">
            <span class="bracket-set-score${ftHigher ? " is-higher" : ""}">${ftVal}</span>
            <span class="bracket-set-score${stHigher ? " is-higher" : ""}">${stVal}</span>
          </div>
        `;
      })
      .join("");
  };

  const buildBracket = (phases) => {
    if (!Array.isArray(phases) || !phases.length) return "";

    const phaseWeight = (fase) => {
      const name = normalizePhaseName(fase.nome_fase || fase.nome);
      if (isQuarterPhaseName(name)) return 1;
      if (isSemiPhaseName(name)) return 2;
      if (isFinalPhaseName(name)) return 3;
      const ord = parseNumber(fase.ordine_fase);
      return Number.isFinite(ord) ? ord : 99;
    };

    const ordered = [...phases].sort((a, b) => phaseWeight(a) - phaseWeight(b));

    const finalIndexByName = ordered.findIndex((fase) => isFinalPhaseName(fase.nome_fase || fase.nome));
    const finalIndex = finalIndexByName >= 0 ? finalIndexByName : ordered.length - 1;

    const finalPhase = ordered[finalIndex];
    const beforeFinal = ordered.slice(0, finalIndex);
    const afterFinal = ordered.slice(finalIndex + 1);

    const buildRoundColumn = (fase, side) => {
      const matches = (fase.partite || [])
        .map((p) => {
          const team1 = formatTeamBlock(p.giocatori_1);
          const team2 = formatTeamBlock(p.giocatori_2);
          const win1 = p.ft_win === true;
          const win2 = p.st_win === true;
          const date = p.data_partita ? escapeHtml(p.data_partita) : "";
          const sets = collectSets(p);
          const setCols = renderSetColumns(sets);
          const setCount = Math.max(sets.length, 1);
          return `
            <article class="bracket-match">
              <div class="bracket-match-meta">
                <span class="bracket-match-id">#${escapeHtml(p.contatore_partita ?? "")}</span>
                <span class="bracket-match-date">${date}</span>
              </div>
              <div class="bracket-body" style="--set-count:${setCount};">
                <div class="bracket-teamcol">
                  <div class="bracket-team${win1 ? " is-winner" : ""}">${team1}</div>
                  <div class="bracket-team${win2 ? " is-winner" : ""}">${team2}</div>
                </div>
                ${setCols}
              </div>
            </article>
          `;
        })
        .join("");

      const phaseName = normalizePhaseName(fase.nome_fase || fase.nome || "");
      const isFinal = isFinalPhaseName(phaseName);
      const isSemi = isSemiPhaseName(phaseName);
      const sideClass = side ? ` is-${side}` : "";
      const centerClass = side === "center" ? " is-center" : "";
      const extraClass = `${sideClass}${centerClass}${isFinal ? " is-final" : ""}${isSemi ? " is-semi" : ""}`;

      return `
        <div class="bracket-round${extraClass}">
          <h5 class="bracket-round-title">${escapeHtml(fase.nome_fase || fase.nome || "Fase")}</h5>
          ${matches || '<div class="bracket-empty">Nessuna partita</div>'}
        </div>
      `;
    };

    const splitMatches = (fase) => {
      const matches = Array.isArray(fase.partite) ? fase.partite : [];
      const mid = Math.ceil(matches.length / 2);
      const left = { ...fase, partite: matches.slice(0, mid) };
      const right = { ...fase, partite: matches.slice(mid) };
      return [left, right];
    };

    const leftPhases = [];
    const rightPhases = [];

    beforeFinal.forEach((fase) => {
      const [leftHalf, rightHalf] = splitMatches(fase);
      if (leftHalf.partite.length) leftPhases.push(leftHalf);
      if (rightHalf.partite.length) rightPhases.push(rightHalf);
    });

    // Ordine: fasi più lontane verso l'esterno. Esempio: Quarti | Semi | Finale | Semi | Quarti.
    const leftColumns = leftPhases.map((fase) => buildRoundColumn(fase, "left"));
    const centerColumn = buildRoundColumn(finalPhase, "center");
    const rightColumns = rightPhases.reverse().map((fase) => buildRoundColumn(fase, "right"));
    const trailingColumns = afterFinal.map((fase) => buildRoundColumn(fase, "right"));

    const columns = [...leftColumns, centerColumn, ...rightColumns, ...trailingColumns].join("");

    return `
      <section class="board-bracket">
        <div class="detail-cell">
          <div class="bracket-header">
            <h4 class="board-group-title">Tabellone Finale (Grafico)</h4>
            <div class="bracket-zoom-controls" role="group" aria-label="Controlli zoom tabellone">
              <button type="button" class="zoom-btn" data-zoom="out" title="Zoom out">−</button>
              <input type="number" class="zoom-label zoom-input" data-zoom-label value="100" min="40" max="200" step="1" aria-label="Percentuale zoom" />
              <button type="button" class="zoom-btn" data-zoom="in" title="Zoom in">+</button>
              <button type="button" class="zoom-btn" data-zoom="fit" title="Adatta alla larghezza">Adatta</button>
            </div>
          </div>
          <div class="board-bracket-scroller" role="group" aria-label="Tabellone finale">
            <div class="bracket-zoom-layer">
              <div class="bracket-grid">${columns}</div>
            </div>
          </div>
        </div>
      </section>
    `;
  };

  const renderPartiteTable = (partite) => {
    if (!Array.isArray(partite) || partite.length === 0) return '<div class="detail-cell"><div class="detail-value">Nessuna partita disponibile.</div></div>';

    const colGroup = `
      <col class="board-col-compact board-col-id">
      <col class="board-col-date">
      <col class="board-win-col">
      <col class="board-team-col board-team-col-left">
      <col class="board-col-compact board-vs-col">
      <col class="board-team-col board-team-col-right">
      <col class="board-win-col">
      <col class="board-score-col">
    `;

    const rows = partite
      .map((p) => {
        const team1 = buildTeamBlock(p.giocatori_1);
        const team2 = buildTeamBlock(p.giocatori_2);
        const score = buildScore(p) || (p.ft_win ? "W" : p.st_win ? "W" : "");
        const dataMatch = p.data_partita ? escapeHtml(p.data_partita) : "";
        const win1 = p.ft_win ? '<span class="board-win-icon">&#10003;</span>' : "";
        const win2 = p.st_win ? '<span class="board-win-icon">&#10003;</span>' : "";
        return `<tr>
          <td class="board-col-compact">${escapeHtml(p.contatore_partita ?? "")}</td>
          <td class="board-col-compact">${dataMatch}</td>
          <td class="board-col-compact board-win-col">${win1}</td>
          <td class="board-team-left">${team1 || ""}</td>
          <td class="board-col-compact board-vs-col">vs.</td>
          <td class="board-team-right">${team2 || ""}</td>
          <td class="board-col-compact board-win-col">${win2}</td>
          <td class="board-score-col">${score}</td>
        </tr>`;
      })
      .join("");

    return `
      <div class="tournaments-table-wrap">
        <table class="tournaments-table">
          <colgroup>
            ${colGroup}
          </colgroup>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  if (!fasi.length) {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Nessuna partita disponibile.</div></div>';
    return;
  }

  const bracketSection = buildBracket(fasi);

  const listHtml = fasi
    .map((fase) => {
      const titolo = fase.nome_fase || fase.nome || "Fase";
      const table = renderPartiteTable(fase.partite);
      const partiteToggle = table
        ? `<button type="button" class="board-toggle-inline" data-target="partite" aria-expanded="false" title="Mostra/Nascondi partite">▼</button>`
        : "";

      const partiteSection = table
        ? `<div class="board-partite-header"><h5 class="board-subtitle">Partite</h5>${partiteToggle}</div><div class="board-partite is-hidden" data-target="partite">${table}</div>`
        : table;

      return `
        <section class="board-group">
          <h4 class="board-group-title">${escapeHtml(titolo)}</h4>
          ${partiteSection}
        </section>
      `;
    })
    .join("");

  const listSection = `
    <section class="board-final-list">
      <div class="detail-cell">
        <h4 class="board-group-title">Elenco Partite</h4>
        ${listHtml}
      </div>
    </section>
  `;

  target.innerHTML = `${bracketSection}${listSection}`;

  const toggleButtons = target.querySelectorAll('.board-toggle-inline');
  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetType = btn.dataset.target;
      const partiteBlock = btn.closest('.board-group')?.querySelector(`.board-partite[data-target="${targetType}"]`);
      if (!partiteBlock) return;
      const isHidden = partiteBlock.classList.toggle('is-hidden');
      btn.classList.toggle('is-active', !isHidden);
      btn.textContent = isHidden ? '▼' : '▲';
      btn.setAttribute('aria-expanded', (!isHidden).toString());
    });
  });

  // Setup controlli zoom per il tabellone grafico
  const setupBracketZoom = () => {
    const scroller = target.querySelector('.board-bracket-scroller');
    const zoomLayer = target.querySelector('.bracket-zoom-layer');
    const grid = target.querySelector('.bracket-grid');
    const label = target.querySelector('[data-zoom-label]');
    if (!scroller || !zoomLayer || !grid || !label) return;

    const clamp = (value) => Math.min(2, Math.max(0.4, value));
    let zoom = 1;

    const setLabel = (percent) => {
      const value = Math.round(percent);
      if (label.tagName === 'INPUT') {
        label.value = value;
      } else {
        label.textContent = `${value}%`;
      }
    };

    const applyZoom = (value) => {
      zoom = clamp(value);
      zoomLayer.style.transform = `scale(${zoom})`;
      zoomLayer.style.transformOrigin = 'top left';
      setLabel(zoom * 100);
    };

    const fitZoom = () => {
      const available = scroller.clientWidth || 0;
      const needed = grid.scrollWidth || 0;
      if (available > 0 && needed > 0) {
        const ratio = available / needed;
        applyZoom(Math.min(1, ratio));
      } else {
        applyZoom(1);
      }
    };

    const handlers = {
      in: () => applyZoom(zoom + 0.1),
      out: () => applyZoom(zoom - 0.1),
      fit: () => fitZoom(),
    };

    const buttons = target.querySelectorAll('.zoom-btn');
    buttons.forEach((btn) => {
      const mode = btn.dataset.zoom;
      const fn = handlers[mode];
      if (!fn) return;
      btn.addEventListener('click', fn);
    });

    const parseLabel = () => {
      if (label.tagName === 'INPUT') {
        const num = Number(label.value);
        if (Number.isFinite(num)) return num / 100;
      }
      const numeric = parseFloat(label.textContent?.replace('%', '') || '');
      return Number.isFinite(numeric) ? numeric / 100 : zoom;
    };

    const applyFromLabel = () => {
      const next = clamp(parseLabel());
      applyZoom(next);
    };

    if (label.tagName === 'INPUT') {
      label.addEventListener('change', applyFromLabel);
      label.addEventListener('blur', applyFromLabel);
      label.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyFromLabel();
        }
        if (event.key === 'Escape') {
          setLabel(zoom * 100);
          label.blur();
        }
      });
    }

    scroller.addEventListener(
      'wheel',
      (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.05 : -0.05;
        applyZoom(zoom + delta);
      },
      { passive: false }
    );

    fitZoom();
  };

  setupBracketZoom();
}

function buildFightersCards(entries, isDouble) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<div class="detail-cell"><div class="detail-value">Nessun iscritto disponibile.</div></div>';
  }

  const fighterBlock = (name, power, coeff) => {
    const { surname, given } = splitNameParts(name);
    return `
      <div class="fighter-card">
        <div class="fighter-name-block">
          <p class="fighter-surname-line"><span class="fighter-surname">${escapeHtml(surname || "N/D")}</span></p>
          ${given ? `<p class="fighter-given-line">${escapeHtml(given)}</p>` : ""}
        </div>
        <div class="fighter-metrics">
          <span class="fighter-metric">Power ${escapeHtml(power ?? "N/D")}</span>
          <span class="fighter-metric">Coeff ${escapeHtml(coeff ?? "N/D")}</span>
        </div>
      </div>
    `;
  };

  const cards = entries
    .map((item) => {
      const isSeed = Boolean(item.isSeed);
      const seedClass = isSeed ? " is-seed" : "";
      const seedBadge = isSeed ? '<div class="fighter-seed-badge" aria-label="Testa di serie"><span class="seed-icon">&#9733;</span></div>' : "";
      if (isDouble) {
        const player1 = fighterBlock(item.giocatore_1, item.power_1, item.coefficiente_1);
        const player2 = fighterBlock(item.giocatore_2, item.power_2, item.coefficiente_2);
        return `<article class="fighter-master-card${seedClass}">${seedBadge}${player1}${player2}</article>`;
      }

      const single = fighterBlock(item.giocatore_1 || item.giocatore_2, item.power_1 ?? item.power, item.coefficiente_1 ?? item.coefficiente);
      return `<article class="fighter-master-card${seedClass}">${seedBadge}${single}</article>`;
    })
    .join("");

  return `<div class="detail-cell"><div class="fighters-grid">${cards}</div></div>`;
}

function renderFightersSection(record, target) {
  if (!record || typeof record !== "object") {
    target.innerHTML = '<div class="detail-cell"><div class="detail-value">Nessun dato disponibile.</div></div>';
    return;
  }

  const seeds = Array.isArray(record.teste_di_serie) ? record.teste_di_serie : [];
  const iscritti = Array.isArray(record.iscritti) ? record.iscritti : [];

  // Merge seeds first, then other iscritti excluding duplicates by id_iscrizione
  const seedsWithFlag = seeds.map((item) => ({ ...item, isSeed: true }));
  const seedIds = new Set(seeds.map((item) => item.id_iscrizione));
  const others = iscritti.filter((item) => !seedIds.has(item.id_iscrizione));
  const combined = [...seedsWithFlag, ...others];

  const cards = buildFightersCards(combined, record.doppio);

  target.innerHTML = cards;
}

function renderDetailInfo(raw, target, fallbacks = {}) {
  if (!raw || typeof raw !== "object") {
    target.innerHTML = '<div class="detail-cell"><span class="detail-label">Info</span><div class="detail-value">Nessun dato disponibile.</div></div>';
    return;
  }

  const withFallback = (value, fallbackKey) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    return fallbacks[fallbackKey] || "";
  };

  const punti = raw.punti_top ?? fallbacks.points;
  const maxPunti = raw.montepremi_massimale ?? fallbacks.maxPoints;
  const iscritti = fallbacks.enrolled;
  const maxIscritti = fallbacks.maxEnrolled;
  const power = raw.power_medio ?? raw.power;
  const quota = raw.quota_iscrizione_doppio || raw.quota_iscrizione_singolo_doppio || raw.quota_iscrizione_singolo;

  const combineInOut = (coperti, scoperti) => {
    const inVal = coperti !== undefined && coperti !== null && String(coperti).trim() !== "" ? coperti : "N/D";
    const outVal = scoperti !== undefined && scoperti !== null && String(scoperti).trim() !== "" ? scoperti : "N/D";
    if (inVal === "N/D" && outVal === "N/D") return "";
    return `${inVal} / ${outVal}`;
  };

  const group = (title, entries, options = {}) => {
    const items = entries
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
      .map(([label, value, isHtml]) => buildDetailCell(label, value, { isHtml }))
      .join("");
    if (!items) return "";
    const extraClass = options.singleColumn ? " detail-group-full" : "";
    const titleMarkup = options.hideTitle ? "" : `<p class="detail-group-title">${title}</p>`;
    return `
      <div class="detail-group${extraClass}">
        ${titleMarkup}
        <div class="detail-grid-inner">${items}</div>
      </div>
    `;
  };

  const datiTorneo = group("Dati Torneo", [
    ["Torneo", withFallback(raw.torneo, "title")],
    ["Circuito", withFallback(raw.circuito, "circuit")],
    ["Date", raw.data_torneo || raw.data_inizio || fallbacks.date || ""],
    ["Tipologia", withFallback(raw.tipologia_torneo, "type")],
    ["Punti / Max", punti || maxPunti ? `${punti ?? "N/D"} / ${maxPunti ?? "N/D"}` : ""],
    ["Iscritti / Max", iscritti || maxIscritti ? `${iscritti || "N/D"} / ${maxIscritti || "N/D"}` : ""],
    ["Power", power],
    ["Quota iscrizione", quota],
    ["Vincitori", raw.vincitore],
  ], { hideTitle: true });

  const impiantoTorneo = group("Impianto Torneo", [
    ["Impianto", raw.impianto],
    ["Indirizzo", raw.indirizzo_impianto],
    ["Comune/Provincia", raw.comune_e_provincia],
    ["Responsabile", raw.nominativo_responsabile],
    ["Contatto", raw.contatto_responsabile],
    ["Campi IN/OUT", combineInOut(raw.numero_campi_coperti, raw.numero_campi_non_coperti)],
  ], { hideTitle: true });

  const descrizione = group("Descrizione", [
    ["Descrizione", raw.descrizione_torneo || raw.descrizione, true],
  ], { singleColumn: true, hideTitle: true });

  target.innerHTML = [datiTorneo, impiantoTorneo, descrizione].filter(Boolean).join("");
}

function setLoading(sectionId, isLoading) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.dataset.loading = isLoading ? "true" : "false";
  if (isLoading) {
    el.innerHTML = '<div class="detail-cell"><div class="detail-value">Caricamento...</div></div>';
  }
}

async function loadTournamentInfo(idTorneo, fallbacks) {
  const detailGrid = document.getElementById("detail-grid");
  setLoading("detail-grid", true);
  try {
    const payload = { id: idTorneo, id_torneo: idTorneo };
    const data = await postJson("/api/torneo-dettaglio", payload);
    const raw = data?.result || data?.results || data?.data || data;
    const info = Array.isArray(raw)
      ? raw[0]
      : Array.isArray(raw?.results)
        ? raw.results[0]
        : raw;
    renderDetailInfo(info, detailGrid, fallbacks);
  } catch (error) {
    detailGrid.innerHTML = '<div class="detail-cell"><div class="detail-value">Errore nel caricamento dei dati del torneo.</div></div>';
    console.error(error);
  }
}

function showOnlySection(activeId) {
  const sections = ["detail-grid", "detail-fighters", "detail-board"];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === activeId) {
      el.classList.remove("is-hidden");
    } else {
      el.classList.add("is-hidden");
    }
  });
}

function setupSectionTriggers(idTorneo, fallbacks) {
  const infoLink = document.querySelector('a[href="#detail-info"]');
  const fightersLink = document.querySelector('a[href="#detail-fighters"]');
  const boardLink = document.querySelector('a[href="#detail-board"]');

  if (infoLink) {
    infoLink.addEventListener("click", (event) => {
      event.preventDefault();
      showOnlySection("detail-grid");
      loadTournamentInfo(idTorneo, fallbacks);
      document.getElementById("detail-info")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (fightersLink) {
    fightersLink.addEventListener("click", (event) => {
      event.preventDefault();
      showOnlySection("detail-fighters");
      loadTournamentFighters(idTorneo);
      document.getElementById("detail-fighters")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (boardLink) {
    boardLink.addEventListener("click", (event) => {
      event.preventDefault();
      showOnlySection("detail-board");
      loadTournamentBracket(idTorneo);
      document.getElementById("detail-board")?.scrollIntoView({ behavior: "smooth" });
    });
  }
}

async function initTournamentDetailPage() {
  const idTorneo = getDetailParam("id");
  const title = getDetailParam("name", "Torneo");
  const circuit = getDetailParam("circuit", "");
  const region = getDetailParam("region", "");
  const province = getDetailParam("province", "");
  const start = getDetailParam("start", "");
  const end = getDetailParam("end", "");
  const type = getDetailParam("type", "");
  const enrolled = getDetailParam("enrolled", "");
  const maxEnrolled = getDetailParam("maxEnrolled", "");
  const points = getDetailParam("points", "");
  const maxPoints = getDetailParam("maxPoints", "");

  const subtitle = [circuit, region, province].filter(Boolean).join(" · ");
  document.getElementById("detail-title").textContent = title;
  document.getElementById("detail-subtitle").textContent = subtitle || "Scheda riepilogativa del torneo selezionato.";

  if (!idTorneo) {
    document.getElementById("detail-grid").innerHTML = '<div class="detail-cell"><div class="detail-value">ID torneo mancante.</div></div>';
    return;
  }

  const fallbacks = {
    title,
    circuit,
    date: end ? `${start} - ${end}` : start,
    type,
    enrolled,
    maxEnrolled,
    points,
    maxPoints,
  };

  setupSectionTriggers(idTorneo, fallbacks);

  showOnlySection("detail-grid");
  await loadTournamentInfo(idTorneo, fallbacks);
}

initTournamentDetailPage();