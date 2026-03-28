# TPRA Base Pulita

 Pagina statica in HTML, CSS e JavaScript con:

 - menu laterale sinistro minimizzabile e bloccabile
 - chiamata diretta verso `https://tpra-prod-frontend-function.azurewebsites.net/api/v1/home/menu/get`
 - payload inviato: `{ "id_settore": 2 }`
 - nessun fallback: se la chiamata diretta fallisce (es. CORS), viene mostrato l'errore
 - supporto desktop (Electron): la chiamata passa dal main process, quindi niente CORS
 - logo TPRA al centro della pagina

## Note

- Il menu chiama direttamente l'endpoint TPRA `POST https://tpra-prod-frontend-function.azurewebsites.net/api/v1/home/menu/get`.
- In modalità browser la chiamata richiede che l'endpoint esponga gli header CORS; in modalità Electron passa dal main process e non subisce CORS.
- Non c'è fallback locale: se la chiamata fallisce, viene mostrato l'errore.

## Modalità Electron

1. Installa le dipendenze (serve Electron):
	```powershell
	npm install electron --save-dev
	```
2. Avvia l'app desktop:
	```powershell
	npm run electron
	```
- Il rendering è tollerante a diversi formati di risposta (`data`, `result`, `items` o array diretto).
- Il logo centrale usa `images/TPRA-LOGO-NEG-rgb.svg`.

## Avvio

1. Installa le dipendenze con `npm install`
2. Avvia il progetto con `npm start`
3. Apri `http://localhost:3000`
