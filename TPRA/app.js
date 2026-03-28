const MENU_DIRECT_ENDPOINT = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/home/menu/get";
const LOOKUP_DIRECT_ENDPOINT = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/lookup/get";
const PROVINCIE_DIRECT_ENDPOINT = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/lookup/provincie/get";
const TORNEI_DIRECT_ENDPOINT = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/tornei/tornei/list";
const MENU_PAYLOAD = { id_settore: 2 };
const TPRA_BASE_URL = "https://www.tpra.it";

const elements = {
  sidebar: document.getElementById("sidebar"),
  menuList: document.getElementById("menu-list"),
  toggleSidebar: document.getElementById("toggle-sidebar"),
  lockSidebar: document.getElementById("lock-sidebar"),
  heroSection: document.getElementById("hero-section"),
  tabsSection: document.getElementById("tabs-section"),
  tabsTitle: document.getElementById("tabs-title"),
  tabsNav: document.getElementById("tabs-nav"),
  tabsContent: document.getElementById("tabs-content"),
};

const state = {
  isCollapsed: false,
  isLocked: true,
};

const MENU_SOURCES = {
  electron: "electron",
  proxy: "proxy",
  direct: "live-direct",
  fallback: "fallback-local",
  embedded: "fallback-embedded",
};

const EMBEDDED_MENU_FALLBACK = {
  menu_esploso: [
    {
      titolo: "Area Riservata",
      descrizione: "Accedi ai servizi TPRA",
      url: "/Auth/Login",
      sub: [
        { label: "Login", route: "/Auth/Login" },
        { label: "Registrazione", route: "/Auth/Registrazione" },
      ],
    },
    {
      titolo: "Regolamenti",
      descrizione: "Documenti ufficiali e norme di gioco",
      url: "https://www.tpra.it/Home/Regolamenti",
    },
    {
      titolo: "Circuito TPRA",
      descrizione: "Calendario eventi e tornei",
      url: "/Circuito/Calendario",
      sub: [
        { label: "Calendario", route: "/Circuito/Calendario" },
        { label: "Ranking", route: "/Circuito/Ranking" },
      ],
    },
  ],
};

const EMBEDDABLE_FILE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "mp4",
  "webm",
  "ogg",
  "mp3",
  "wav",
  "m4a",
  "txt",
  "json",
  "csv",
  "xml",
]);

// Province statiche indicizzate per codR — usate come fallback offline
const PROVINCES_BY_REGION = {
  1:  ["Alessandria", "Asti", "Biella", "Cuneo", "Novara", "Torino", "Verbano-Cusio-Ossola", "Vercelli"],
  2:  ["Aosta"],
  3:  ["Bergamo", "Brescia", "Como", "Cremona", "Lecco", "Lodi", "Mantova", "Milano", "Monza e Brianza", "Pavia", "Sondrio", "Varese"],
  4:  ["Bolzano", "Trento"],
  5:  ["Belluno", "Padova", "Rovigo", "Treviso", "Venezia", "Verona", "Vicenza"],
  6:  ["Gorizia", "Pordenone", "Trieste", "Udine"],
  7:  ["Genova", "Imperia", "La Spezia", "Savona"],
  8:  ["Bologna", "Ferrara", "Forlì-Cesena", "Modena", "Parma", "Piacenza", "Ravenna", "Reggio Emilia", "Rimini"],
  9:  ["Arezzo", "Firenze", "Grosseto", "Livorno", "Lucca", "Massa-Carrara", "Pisa", "Pistoia", "Prato", "Siena"],
  10: ["Perugia", "Terni"],
  11: ["Ancona", "Ascoli Piceno", "Fermo", "Macerata", "Pesaro e Urbino"],
  12: ["Frosinone", "Latina", "Rieti", "Roma", "Viterbo"],
  13: ["L'Aquila", "Chieti", "Pescara", "Teramo"],
  14: ["Campobasso", "Isernia"],
  15: ["Avellino", "Benevento", "Caserta", "Napoli", "Salerno"],
  16: ["Bari", "Barletta-Andria-Trani", "Brindisi", "Foggia", "Lecce", "Taranto"],
  17: ["Matera", "Potenza"],
  18: ["Catanzaro", "Cosenza", "Crotone", "Reggio Calabria", "Vibo Valentia"],
  19: ["Agrigento", "Caltanissetta", "Catania", "Enna", "Messina", "Palermo", "Ragusa", "Siracusa", "Trapani"],
  20: ["Cagliari", "Nuoro", "Oristano", "Sassari", "Sud Sardegna"],
};

const TOURNAMENT_TYPE_OPTIONS = [
  { label: "Gruppo", value: null },
  { label: "Fascia Expert Level", value: 12 },
  { label: "Fascia Entry Level", value: 13 },
];

const GROUP_OPTIONS = [
  { label: "Doppio Maschile", value: 3 },
  { label: "Doppio Femminile", value: 4 },
  { label: "Doppio Misto", value: 5 },
];

function toAbsoluteUrl(url) {
  if (!url || url === "#") {
    return "#";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${TPRA_BASE_URL}${url}`;
  }

  return `${TPRA_BASE_URL}/${url}`;
}

function buildTournamentDetailUrl(torneo) {
  const idTorneo = torneo.id_torneo || torneo.idTorneo || torneo.id || torneo.ID || "";
  const params = new URLSearchParams({
    circuit: torneo.nome_circuito || torneo.nomeCircuito || "",
    start: torneo.data_inizio || torneo.dataInizio || "",
    end: torneo.data_fine || torneo.dataFine || "",
    type: torneo.tipologia || "",
    name: torneo.nome_torneo || torneo.nomeTorneo || torneo.nome || torneo.titolo || "",
    enrolled: String(torneo.nr_iscrizioni ?? ""),
    maxEnrolled: String(torneo.iscrizioni_massimale ?? ""),
    points: String(torneo.montepremi_punti ?? torneo.monteprimi_punti ?? ""),
    maxPoints: String(torneo.montepremi_massimale ?? torneo.mentepremi_massimale ?? ""),
    region: torneo.regione || "",
    province: torneo.provincia || "",
    club: torneo.societa || "",
    link: toAbsoluteUrl(torneo.link || "#"),
    id: idTorneo,
  });

  return `./tournament-detail.html?${params.toString()}`;
}

function normalizeMenuItems(payload) {
  if (Array.isArray(payload?.menu_esploso)) {
    return payload.menu_esploso;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.result)) {
    return payload.result;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function pickValue(item, keys, fallback = "") {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildOptions(options, placeholder) {
  const placeholderMarkup = placeholder ? `<option value="">${placeholder}</option>` : "";
  const optionsMarkup = options
    .map((option) => {
      if (typeof option === "object" && option !== null) {
        const value = option.value === null || option.value === undefined ? "" : String(option.value);
        const label = option.label ?? String(option.value ?? "");
        return `<option value="${value}">${label}</option>`;
      }

      return `<option value="${option}">${option}</option>`;
    })
    .join("");

  return `${placeholderMarkup}${optionsMarkup}`;
}

async function fetchLookup(keys) {
  // Electron IPC (se disponibile)
  if (window.api?.fetchLookup) {
    try {
      return await window.api.fetchLookup({ keys });
    } catch (_) {}
  }

  // Proxy locale
  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (response.ok) {
        return response.json();
      }
    } catch (_) {}
  }

  // Endpoint diretto (fallback, soggetto a CORS)
  try {
    const response = await fetch(LOOKUP_DIRECT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ keys }),
    });
    if (response.ok) {
      return response.json();
    }
  } catch (_) {}

  return null;
}

async function fetchProvincie(codR) {
  const payload = { codR: Number(codR) };

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("/api/provincie", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        return response.json();
      }
    } catch (_) {}
  }

  // Fallback diretto
  try {
    const response = await fetch(PROVINCIE_DIRECT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      return response.json();
    }
  } catch (_) {}

  // Fallback statico offline
  const staticProvinces = (PROVINCES_BY_REGION[Number(codR)] || []).map((nome) => ({ codP: nome, nomeP: nome }));
  return { istat_province: staticProvinces };
}

function isRoadToRome(menuTitle) {
  return normalizeText(menuTitle) === "road to rome 2026";
}

function expandSubItems(menuTitle, subItems) {
  let expanded = subItems;

  if (isRoadToRome(menuTitle)) {
    expanded = [];
    for (const subItem of subItems) {
      const subTitle = pickValue(subItem, ["label", "title", "name"], "");
      if (normalizeText(subTitle) === "tornei e classifiche per regione") {
        const route = pickValue(subItem, ["route", "url", "href", "link"], "#");
        expanded.push({ label: "Calendario Tornei", _tpra_type: "road-to-rome-calendar" });
        expanded.push({ label: "Classifica", route, _tpra_type: "road-to-rome-ranking" });
      } else {
        expanded.push(subItem);
      }
    }
  }

  const priorityOrder = ["calendario tornei", "classifica", "regolamento"];
  const priorityBuckets = new Map(priorityOrder.map((key) => [key, []]));
  const remaining = [];

  for (const item of expanded) {
    const label = pickValue(item, ["label", "title", "name"], "");
    const normalized = normalizeText(label);
    if (priorityBuckets.has(normalized)) {
      priorityBuckets.get(normalized).push(item);
    } else {
      remaining.push(item);
    }
  }

  const reordered = priorityOrder.flatMap((key) => priorityBuckets.get(key));
  return [...reordered, ...remaining];
}

function getUrlExtension(url) {
  if (!url || url === "#") {
    return "";
  }

  try {
    const parsedUrl = new URL(url, window.location.href);
    const pathname = parsedUrl.pathname || "";
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : "";
  } catch (_error) {
    const sanitizedUrl = String(url).split("?")[0].split("#")[0];
    const match = sanitizedUrl.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : "";
  }
}

function isEmbeddableFileUrl(url) {
  return EMBEDDABLE_FILE_EXTENSIONS.has(getUrlExtension(url));
}

function getViewerUrl(url) {
  if (getUrlExtension(url) !== "pdf") {
    return url;
  }

  const separator = url.includes("#") ? "&" : "#";
  return `${url}${separator}navpanes=0&toolbar=1`;
}

function renderFileViewer(url, title) {
  const extension = getUrlExtension(url);
  const viewerUrl = getViewerUrl(url);

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return `
      <div class="file-viewer-shell">
        <img class="file-viewer-image" src="${viewerUrl}" alt="${title}" />
      </div>
    `;
  }

  if (["mp4", "webm", "ogg"].includes(extension)) {
    return `
      <div class="file-viewer-shell">
        <video class="file-viewer-media" controls preload="metadata">
          <source src="${viewerUrl}" />
        </video>
      </div>
    `;
  }

  if (["mp3", "wav", "m4a"].includes(extension)) {
    return `
      <div class="file-viewer-shell file-viewer-shell-audio">
        <audio class="file-viewer-audio" controls preload="metadata">
          <source src="${viewerUrl}" />
        </audio>
      </div>
    `;
  }

  return `
    <div class="file-viewer-shell">
      <iframe class="file-viewer-frame" src="${viewerUrl}" title="${title}" loading="lazy"></iframe>
    </div>
  `;
}

function renderRoadToRomeCalendar() {
  return `
    <div class="tab-content-item">
      <div class="filter-header">
        <p class="tab-item-title">Filtri</p>
        <button class="filter-toggle" type="button" aria-label="Toggle filters" data-filter-toggle>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <form class="filter-form" autocomplete="off" data-filter-form>
        <label class="filter-field">
          <span class="filter-label">Data di inizio</span>
          <input class="filter-input" type="date" name="startDate" />
        </label>
        <label class="filter-field">
          <span class="filter-label">Data di fine</span>
          <input class="filter-input" type="date" name="endDate" />
        </label>
        <label class="filter-field">
          <span class="filter-label">Regioni</span>
          <select class="filter-input" name="region" data-region-select disabled>
            <option value="">Caricamento regioni...</option>
          </select>
        </label>
        <label class="filter-field">
          <span class="filter-label">Province</span>
          <select class="filter-input" name="province" data-province-select disabled>
            <option value="">Seleziona prima una regione</option>
          </select>
        </label>
        <label class="filter-field">
          <span class="filter-label">Tipologia</span>
          <select class="filter-input" name="type">
            ${buildOptions(TOURNAMENT_TYPE_OPTIONS, "Seleziona una tipologia")}
          </select>
        </label>
        <label class="filter-field">
          <span class="filter-label">Gruppo</span>
          <select class="filter-input" name="group">
            ${buildOptions(GROUP_OPTIONS, "Seleziona un gruppo")}
          </select>
        </label>
      </form>
      <div class="search-actions">
        <button class="btn-search" type="button" data-search-tournaments>
          Avvia la ricerca
        </button>
      </div>
      <div class="search-results" data-search-results style="display: none;"></div>
    </div>
  `;
}

function renderRoadToRomeRanking(rankingUrl) {
  const isLink = rankingUrl !== "#";
  return `
    <div class="tab-content-item">
      <p class="tab-item-title">Classifica</p>
      <div class="ranking-panel">
        <p class="ranking-copy">Consulta le classifiche aggiornate per la tua regione.</p>
        ${isLink ? `<a href="${rankingUrl}" target="_blank" rel="noreferrer" class="tab-link">Apri Classifica</a>` : "<p class='tab-placeholder'>Nessun link disponibile</p>"}
      </div>
    </div>
  `;
}

function renderStandardTabContent(subTitle, fullSubLink) {
  const isLink = fullSubLink !== "#";
  const isEmbeddableFile = isEmbeddableFileUrl(fullSubLink);
  const viewerMarkup = isEmbeddableFile ? renderFileViewer(fullSubLink, subTitle) : "";

  return `
    <div class="tab-content-item">
      <p class="tab-item-title">${subTitle}</p>
      ${viewerMarkup}
      ${isLink ? `<a href="${fullSubLink}" target="_blank" rel="noreferrer" class="tab-link">Apri in una nuova scheda</a>` : "<p class='tab-placeholder'>Nessun link disponibile</p>"}
    </div>
  `;
}

function renderTabPaneContent(menuTitle, subItem) {
  if (subItem._tpra_type === "road-to-rome-calendar") {
    return renderRoadToRomeCalendar();
  }

  if (subItem._tpra_type === "road-to-rome-ranking") {
    const route = pickValue(subItem, ["route", "url", "href", "link"], "#");
    return renderRoadToRomeRanking(toAbsoluteUrl(route));
  }

  const subTitle = pickValue(subItem, ["label", "title", "name"], "Voce");
  const subLink = pickValue(subItem, ["route", "url", "href", "link"], "#");
  const fullSubLink = toAbsoluteUrl(subLink);

  return renderStandardTabContent(subTitle, fullSubLink);
}

function bindNestedTabGroups() {
  document.querySelectorAll(".nested-tabs-nav").forEach((group) => {
    group.querySelectorAll(".nested-tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        const shell = group.closest(".nested-tabs-shell");
        const target = button.getAttribute("data-nested-tab");

        shell.querySelectorAll(".nested-tab-button").forEach((item) => item.classList.remove("active"));
        shell.querySelectorAll(".nested-tab-pane").forEach((pane) => pane.classList.remove("active"));

        button.classList.add("active");
        shell.querySelector(`[data-nested-pane="${target}"]`)?.classList.add("active");
      });
    });
  });
}

function bindRegionProvinceFilters() {
  document.querySelectorAll("[data-region-select]").forEach((regionSelect) => {
    const form = regionSelect.closest(".filter-form");
    const provinceSelect = form?.querySelector("[data-province-select]");

    fetchLookup("re")
      .then((data) => {
        const regions = data?.result?.[0]?.regioni || [];
        if (regions.length) {
          regionSelect.innerHTML =
            '<option value="">Seleziona una regione</option>' +
            regions.map((r) => `<option value="${r.codR}">${r.nomeR}</option>`).join("");
          regionSelect.disabled = false;
        } else {
          regionSelect.innerHTML = '<option value="">Nessuna regione disponibile</option>';
        }
      })
      .catch(() => {
        regionSelect.innerHTML = '<option value="">Errore caricamento regioni</option>';
      });

    if (!provinceSelect) {
      return;
    }

    regionSelect.addEventListener("change", () => {
      const codR = regionSelect.value;
      if (!codR) {
        provinceSelect.innerHTML = '<option value="">Seleziona prima una regione</option>';
        provinceSelect.disabled = true;
        return;
      }

      provinceSelect.innerHTML = '<option value="">Caricamento province...</option>';
      provinceSelect.disabled = true;

      fetchProvincie(codR)
        .then((data) => {
          const provinces = data?.istat_province || [];
          if (provinces.length) {
            provinceSelect.innerHTML =
              '<option value="">Seleziona una provincia</option>' +
              provinces.map((p) => `<option value="${p.codP}">${p.nomeP}</option>`).join("");
            provinceSelect.disabled = false;
          } else {
            provinceSelect.innerHTML = '<option value="">Nessuna provincia disponibile</option>';
          }
        })
        .catch(() => {
          provinceSelect.innerHTML = '<option value="">Errore caricamento province</option>';
        });
    });
  });
}

function bindDynamicTabContent() {
  bindRegionProvinceFilters();
  
  // Bind filter toggle button
  const filterToggle = document.querySelector('[data-filter-toggle]');
  const filterForm = document.querySelector('[data-filter-form]');
  
  if (filterToggle && filterForm) {
    filterToggle.addEventListener('click', () => {
      filterToggle.classList.toggle('collapsed');
      filterForm.classList.toggle('hidden');
    });
  }
  
  // Bind search tournaments button
  const searchBtn = document.querySelector('[data-search-tournaments]');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchTournaments);
  }
}

function buildTournamentSearchPayload() {
  const form = document.querySelector('[data-filter-form]');
  const regionSelect = document.querySelector('[data-region-select]');
  const provinceSelect = document.querySelector('[data-province-select]');
  const typeSelect = form?.elements.namedItem('type');
  const groupSelect = form?.elements.namedItem('group');
  const startDateInput = form?.elements.namedItem('startDate');
  const endDateInput = form?.elements.namedItem('endDate');
  
  const startDate = startDateInput?.value ? new Date(startDateInput.value).toISOString() : '';
  const endDate = endDateInput?.value ? new Date(endDateInput.value).toISOString() : '';
  const idRegione = regionSelect?.value ? Number(regionSelect.value) : null;
  const idProvincia = provinceSelect?.value ? Number(provinceSelect.value) : null;
  const typeValue = typeSelect?.value || "";
  const groupValue = groupSelect?.value || "";
  
  return {
    id_settore: 2,
    data_inizio: startDate,
    data_fine: endDate,
    id_regione: idRegione,
    id_provincia: idProvincia,
    id_societa: null,
    id_tipologia: groupValue ? Number(groupValue) || null : null,
    id_power_range: null,
    id_circuito: null,
    rowstoskip: 0,
    fetchrows: 12,
    senza_assegnazione_punti: false,
    id_settore_gruppo: typeValue ? Number(typeValue) || null : null
  };
}

async function searchTournaments() {
  const payload = buildTournamentSearchPayload();
  const resultsContainer = document.querySelector('[data-search-results]');
  const searchBtn = document.querySelector('[data-search-tournaments]');
  
  if (!resultsContainer) return;
  
  // Show loading state
  searchBtn.disabled = true;
  searchBtn.textContent = 'Ricerca in corso...';
  resultsContainer.style.display = 'none';
  resultsContainer.innerHTML = '';
  
  try {
    // Try local proxy first
    let response;
    if (window.location.protocol !== "file:") {
      try {
        response = await fetch("/api/tornei", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const data = await response.json();
          displayTournamentResults(data, resultsContainer);
          return;
        }
      } catch (_) {}
    }
    
    // Direct endpoint fallback
    try {
      response = await fetch(TORNEI_DIRECT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        displayTournamentResults(data, resultsContainer);
        return;
      }
    } catch (_) {}
    
    // No results
    resultsContainer.innerHTML = '<p class="search-error">Nessun risultato trovato o errore nella ricerca.</p>';
    resultsContainer.style.display = 'block';
  } catch (error) {
    console.error('Search error:', error);
    resultsContainer.innerHTML = '<p class="search-error">Errore durante la ricerca. Riprova.</p>';
    resultsContainer.style.display = 'block';
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Avvia la ricerca';
  }
}

function displayTournamentResults(data, container) {
  // Check if data has results
  const tornei = data?.results || data?.tornei || data?.result || data || [];
  const torneList = Array.isArray(tornei) ? tornei : [];
  
  if (torneList.length === 0) {
    container.innerHTML = '<p class="search-empty">Nessun torneo trovato con i filtri selezionati.</p>';
  } else {
    const rowsHtml = torneList
      .map((torneo) => {
        const nomeCircuito = torneo.nome_circuito || torneo.nomeCircuito || "N/D";
        const dataInizio = torneo.data_inizio || torneo.dataInizio || "N/D";
        const tipologia = torneo.tipologia || "N/D";
        const nomeTorneo = torneo.nome_torneo || torneo.nomeTorneo || torneo.nome || torneo.titolo || "N/D";
        const iscritti = torneo.nr_iscrizioni ?? "N/D";
        const maxIscritti = torneo.iscrizioni_massimale ?? "N/D";
        const iscrittiMax = `${iscritti}/${maxIscritti}`;
        const punti = torneo.montepremi_punti ?? torneo.monteprimi_punti ?? "N/D";
        const maxPunti = torneo.montepremi_massimale ?? torneo.mentepremi_massimale ?? "N/D";
        const puntiMax = `${punti}/${maxPunti}`;
        const dettaglioLink = buildTournamentDetailUrl(torneo);
        
        return `
          <tr>
            <td data-label="Nome Circuito">${nomeCircuito}</td>
            <td data-label="Data Inizio">${dataInizio}</td>
            <td data-label="Tipologia">${tipologia}</td>
            <td class="col-center" data-label="Iscritti/Max">${iscrittiMax}</td>
            <td class="col-center" data-label="Punti/Max">${puntiMax}</td>
            <td data-label="Nome Torneo">${nomeTorneo}</td>
            <td class="col-action" data-label="Azione"><a class="table-row-action" href="${dettaglioLink}" target="_blank" rel="noreferrer">Apri</a></td>
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="tournaments-table-wrap">
        <table class="tournaments-table">
          <thead>
            <tr>
              <th>Nome Circuito</th>
              <th>Data Inizio</th>
              <th>Tipologia</th>
              <th class="col-center">Iscritti/Max</th>
              <th class="col-center">Punti/Max</th>
              <th>Nome Torneo</th>
              <th class="col-action"></th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }
  
  container.style.display = 'block';
}

function showTabs(title, subItems) {
  elements.heroSection.style.display = "none";
  elements.tabsSection.style.display = "block";
  elements.tabsTitle.textContent = title;

  if (!subItems.length) {
    elements.tabsNav.innerHTML = "";
    elements.tabsContent.innerHTML = '<p class="empty-state">Nessun elemento disponibile.</p>';
    return;
  }

  subItems = expandSubItems(title, subItems);

  const tabsHtml = subItems
    .map((subItem, index) => {
      const subTitle = pickValue(subItem, ["label", "title", "name"], "Voce");
      const activeClass = index === 0 ? "active" : "";
      return `<button class="tab-button ${activeClass}" data-tab-index="${index}">${subTitle}</button>`;
    })
    .join("");

  const contentHtml = subItems
    .map((subItem, index) => {
      const subLink = pickValue(subItem, ["route", "url", "href", "link"], "#");
      const fullSubLink = toAbsoluteUrl(subLink);
      const activeClass = index === 0 ? "active" : "";

      return `
        <div class="tab-pane ${activeClass}" data-tab-index="${index}">
          ${renderTabPaneContent(title, subItem)}
        </div>
      `;
    })
    .join("");

  elements.tabsNav.innerHTML = tabsHtml;
  elements.tabsContent.innerHTML = contentHtml;

  // Aggiungi event listener ai tab button
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", (e) => {
      const tabIndex = e.target.getAttribute("data-tab-index");
      document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      e.target.classList.add("active");
      document.querySelector(`.tab-pane[data-tab-index="${tabIndex}"]`).classList.add("active");
    });
  });

  bindDynamicTabContent();
}

function renderMenu(items) {
  if (!items.length) {
    elements.menuList.innerHTML = '<p class="empty-state">Nessun elemento disponibile nel menu.</p>';
    return;
  }

  const markup = items
    .map((item, index) => {
      const title = pickValue(item, ["titolo", "title", "nome", "name", "label"], `Voce ${index + 1}`);
      const link = pickValue(item, ["url", "link", "href", "permalink", "route"], "#");
      const subItems = Array.isArray(item?.sub) ? item.sub : [];

      const href = toAbsoluteUrl(link);
      const targetAttributes = href !== "#" ? ' target="_blank" rel="noreferrer"' : "";
      const hasSubItems = subItems.length > 0;
      const isDirectFile = isEmbeddableFileUrl(href);
      const mainItemTag = (href === "#" || hasSubItems || isDirectFile) ? "div" : "a";
      const viewMode = hasSubItems ? "tabs" : (isDirectFile ? "file" : "link");
      const subMarkup = subItems.length
        ? `<div class="submenu-list">${subItems
            .map((subItem) => {
              const subTitle = pickValue(subItem, ["label", "title", "name"], "Voce");
              const subLink = pickValue(subItem, ["route", "url", "href", "link"], "#");
              const fullSubLink = toAbsoluteUrl(subLink);
              const subTarget = fullSubLink !== "#" ? ' target="_blank" rel="noreferrer"' : "";

              return `<a class="submenu-item" href="${fullSubLink}"${subTarget}>${subTitle}</a>`;
            })
            .join("")}</div>`
        : "";

      return `
        <${mainItemTag} class="menu-item" data-menu-title="${title}" data-view-mode="${viewMode}" data-route="${href}"${viewMode === "link" && href !== "#" ? ` href="${href}"${targetAttributes}` : ""}>
          <span class="menu-item-title">${title}</span>
        </${mainItemTag}>
        ${subMarkup}
      `;
    })
    .join("");

  elements.menuList.innerHTML = markup;

  document.querySelectorAll('.menu-item[data-view-mode="tabs"]').forEach((menuItem) => {
    menuItem.addEventListener("click", () => {
      const title = menuItem.getAttribute("data-menu-title");
      const subListContainer = menuItem.nextElementSibling;
      let subItems = [];

      if (subListContainer && subListContainer.classList.contains("submenu-list")) {
        const subLinks = subListContainer.querySelectorAll(".submenu-item");
        subItems = Array.from(subLinks).map((link) => ({
          label: link.textContent,
          route: link.getAttribute("href"),
        }));
      }

      showTabs(title, subItems);
    });
  });

  document.querySelectorAll('.menu-item[data-view-mode="file"]').forEach((menuItem) => {
    menuItem.addEventListener("click", () => {
      const title = menuItem.getAttribute("data-menu-title") || "File";
      const route = menuItem.getAttribute("data-route") || "#";

      showTabs(title, [{ label: title, route }]);
    });
  });
}

async function loadMenu() {
  elements.menuList.innerHTML = '<p class="empty-state">Recupero voci menu...</p>';

  let liveError = null;
  let data = null;
  let source = "";

  // In file:// il browser blocca spesso le fetch locali/remote per policy di sicurezza.
  if (window.location.protocol === "file:") {
    data = EMBEDDED_MENU_FALLBACK;
    source = MENU_SOURCES.embedded;
  }

  // Se presente (Electron), usa la fetch di backend esposta via preload per evitare CORS.
  if (!data && window.api?.fetchMenu) {
    try {
      data = await window.api.fetchMenu(MENU_PAYLOAD);
      source = MENU_SOURCES.electron;
    } catch (error) {
      liveError = error;
    }
  }

  // Prima scelta in ambiente browser: stesso host (proxy locale con server.js)
  if (!data) {
    try {
      const proxyResponse = await fetch("/api/menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json,text/plain, */*",
          Authorization: "Bearer null",
        },
        body: JSON.stringify(MENU_PAYLOAD),
      });

      if (!proxyResponse.ok) {
        throw new Error(`HTTP ${proxyResponse.status}`);
      }

      data = await proxyResponse.json();
      source = MENU_SOURCES.proxy;
    } catch (error) {
      liveError = error;
    }
  }

  // Altrimenti, fallback alla fetch diretta (richiede CORS lato server)
  if (!data) {
    try {
      const response = await fetch(MENU_DIRECT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json,text/plain, */*",
          Authorization: "Bearer null",
        },
        body: JSON.stringify(MENU_PAYLOAD),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      data = await response.json();
      source = MENU_SOURCES.direct;
    } catch (error) {
      liveError = error;
    }
  }

  // Ultimo fallback: menu statico locale, utile quando il live non e raggiungibile.
  if (!data) {
    try {
      const fallbackResponse = await fetch("./menu-fallback.json", {
        headers: {
          Accept: "application/json,text/plain, */*",
        },
      });

      if (!fallbackResponse.ok) {
        throw new Error(`HTTP ${fallbackResponse.status}`);
      }

      data = await fallbackResponse.json();
      source = MENU_SOURCES.fallback;
    } catch (error) {
      liveError = error;
    }
  }

  if (!data) {
    elements.menuList.innerHTML = `
      <p class="empty-state">
        Impossibile recuperare il menu TPRA.<br />
        Errore live: ${liveError ? liveError.message : "n/d"}
      </p>
    `;
    return;
  }

  const items = normalizeMenuItems(data);
  renderMenu(items);

  const sourceLabelMap = {
    [MENU_SOURCES.electron]: "live (electron)",
    [MENU_SOURCES.proxy]: "live (proxy)",
    [MENU_SOURCES.direct]: "live (direct)",
    [MENU_SOURCES.fallback]: "fallback locale",
    [MENU_SOURCES.embedded]: "fallback file://",
  };
}


function applySidebarState() {
  elements.sidebar.classList.toggle("is-collapsed", state.isCollapsed);
  elements.sidebar.classList.toggle("is-locked", state.isLocked);
  elements.toggleSidebar.textContent = state.isCollapsed ? "▶" : "◀";
  elements.toggleSidebar.setAttribute("aria-expanded", String(!state.isCollapsed));
  elements.lockSidebar.setAttribute("aria-pressed", String(state.isLocked));
  elements.lockSidebar.textContent = state.isLocked ? "📌" : "📍";
}

function bindEvents() {
  elements.toggleSidebar.addEventListener("click", () => {
    state.isCollapsed = !state.isCollapsed;
    applySidebarState();
  });

  elements.lockSidebar.addEventListener("click", () => {
    state.isLocked = !state.isLocked;
    applySidebarState();
  });

  elements.sidebar.addEventListener("mouseenter", () => {
    if (!state.isLocked) {
      state.isCollapsed = false;
      applySidebarState();
    }
  });

  elements.sidebar.addEventListener("mouseleave", () => {
    if (!state.isLocked) {
      state.isCollapsed = true;
      applySidebarState();
    }
  });
}

function init() {
  state.isCollapsed = false;
  applySidebarState();
  bindEvents();
  loadMenu();
}

init();
