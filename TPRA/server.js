const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

let ProxyAgent;
try {
  ({ ProxyAgent } = require("undici"));
} catch (error) {
  ProxyAgent = null;
}

const PORT = process.env.PORT || 3000;
const TPRA_MENU_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/home/menu/get";
const TPRA_LOOKUP_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/lookup/get";
const TPRA_PROVINCIE_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/lookup/provincie/get";
const TPRA_TORNEI_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/tornei/tornei/list";
const TPRA_TORNEO_DETTAGLIO_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/tornei/dettaglio/view";
const TPRA_TORNEO_ISCRITTI_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/tornei/iscritti/view";
const TPRA_TORNEO_TABELLONI_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/tornei/tabelloni/view";
const TPRA_TORNEO_GIRONI_CLASSIFICHE_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/tornei/gironi_classifiche/list";
const TPRA_GIOCATORE_DETTAGLIO_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/giocatori/dettaglio/view";
const TPRA_GIOCATORE_PALMARES_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/giocatori/palmares/list";
const TPRA_GIOCATORE_ULTIMI_RISULTATI_URL = "https://tpra-prod-frontend-function.azurewebsites.net/api/v1/giocatori/ultimi_risultati/list";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function getProxyDispatcher() {
  const proxyUrl =
    process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || "";

  if (!proxyUrl) {
    return undefined;
  }

  if (!ProxyAgent) {
    console.warn("ProxyAgent non disponibile: installa 'undici' oppure rimuovi le variabili *_PROXY.");
    return undefined;
  }

  try {
    return new ProxyAgent(proxyUrl);
  } catch (error) {
    console.warn("Impossibile creare il ProxyAgent:", error.message);
    return undefined;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function serveFile(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const absolutePath = path.join(__dirname, decodeURIComponent(safePath));

  if (!absolutePath.startsWith(__dirname)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        fs.readFile(path.join(__dirname, "index.html"), (fallbackError, fallbackContent) => {
          if (fallbackError) {
            sendJson(response, 404, { error: "File not found" });
            return;
          }

          response.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
          response.end(fallbackContent);
        });
        return;
      }

      sendJson(response, 500, { error: "Unable to read file" });
      return;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

async function handleProxy(request, response) {
  let rawBody = "";

  request.on("data", (chunk) => {
    rawBody += chunk;
  });

  request.on("end", async () => {
    try {
      let parsedBody = {};

      if (rawBody && rawBody.trim() !== "") {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (parseError) {
          parsedBody = { id_settore: 2 };
        }
      } else {
        parsedBody = { id_settore: 2 };
      }

      const authHeader = request.headers["authorization"] || "Bearer null";
      const dispatcher = getProxyDispatcher();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error("Proxy fetch timeout")), 15000);

      const upstreamResponse = await fetch(TPRA_MENU_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          Accept: "application/json",
        },
        body: JSON.stringify(parsedBody),
        dispatcher,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const rawText = await upstreamResponse.text();
      const contentType = upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8";

      response.writeHead(upstreamResponse.status, {
        "Content-Type": contentType,
      });
      response.end(rawText);
    } catch (error) {
      console.error("Proxy request failed:", error);
      sendJson(response, 502, {
        error: "Proxy request failed",
        detail: error.cause?.message || error.message,
      });
    }
  });
}

async function handleLookupProxy(request, response) {
  return handleGenericProxy(request, response, TPRA_LOOKUP_URL);
}

async function handleGenericProxy(request, response, upstreamUrl) {
  let rawBody = "";

  request.on("data", (chunk) => {
    rawBody += chunk;
  });

  request.on("end", async () => {
    try {
      let parsedBody = {};

      if (rawBody && rawBody.trim() !== "") {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (_) {
          parsedBody = {};
        }
      }

      const dispatcher = getProxyDispatcher();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error("Proxy fetch timeout")), 15000);

      const upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(parsedBody),
        dispatcher,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const rawText = await upstreamResponse.text();
      const contentType = upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8";

      response.writeHead(upstreamResponse.status, { "Content-Type": contentType });
      response.end(rawText);
    } catch (error) {
      console.error("Proxy failed:", error);
      sendJson(response, 502, {
        error: "Proxy request failed",
        detail: error.cause?.message || error.message,
      });
    }
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && requestUrl.pathname === "/api/menu") {
    handleProxy(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/lookup") {
    handleLookupProxy(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/provincie") {
    handleGenericProxy(request, response, TPRA_PROVINCIE_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/tornei") {
    handleGenericProxy(request, response, TPRA_TORNEI_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/torneo-dettaglio") {
    handleGenericProxy(request, response, TPRA_TORNEO_DETTAGLIO_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/torneo-iscritti") {
    handleGenericProxy(request, response, TPRA_TORNEO_ISCRITTI_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/torneo-tabelloni") {
    handleGenericProxy(request, response, TPRA_TORNEO_TABELLONI_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/torneo-gironi-classifiche") {
    handleGenericProxy(request, response, TPRA_TORNEO_GIRONI_CLASSIFICHE_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/giocatore-dettaglio") {
    handleGenericProxy(request, response, TPRA_GIOCATORE_DETTAGLIO_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/giocatore-palmares") {
    handleGenericProxy(request, response, TPRA_GIOCATORE_PALMARES_URL);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/giocatore-ultimi-risultati") {
    handleGenericProxy(request, response, TPRA_GIOCATORE_ULTIMI_RISULTATI_URL);
    return;
  }

  if (request.method === "GET") {
    serveFile(requestUrl.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`TPRA wrapper in ascolto su http://localhost:${PORT}`);
});
