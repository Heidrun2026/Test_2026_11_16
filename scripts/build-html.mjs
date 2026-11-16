// Baut den Prototyp zu einer einzigen HTML-Datei (ohne Abhängigkeiten).
//   dist/kapazitaetsplanung.html  – eigenständige Datei zum Öffnen im Browser
//   dist/artifact.html            – Seiteninhalt ohne Dokumentgerüst (für die Veröffentlichung als Artifact)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const stripModule = (src) => src
  .replace(/^import[\s\S]*?from\s+'[^']+';\s*$/gm, '')
  .replace(/^export\s+/gm, '');

const js = ['js/calc.js', 'js/store.js', 'js/app.js'].map((p) => `// ---- ${p} ----\n${stripModule(read(p))}`).join('\n');
if (/<\/script/i.test(js)) throw new Error('JavaScript enthält "</script" – kann nicht eingebettet werden.');
const css = read('css/styles.css');
const icon = `data:image/svg+xml,${encodeURIComponent(read('icons/icon.svg').trim())}`;

const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/\s*<script type="module" src="\.\/js\/app\.js"><\/script>/, '');

const head = `<title>Kapazitätsplanung Team</title>
<meta name="theme-color" content="#00594f">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="${icon}">
<style>
${css}
</style>`;
const script = `<script type="module">\n${js}\n</script>`;

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
// In der Artifact-Ansicht sind Downloads gesperrt: dort nur Kopieren anbieten.
const DL_BUTTON = '\n    <button type="button" class="btn btn-zweit" data-action="export-download">Als Datei herunterladen</button>';
if (!script.includes(DL_BUTTON)) throw new Error('Download-Button im Export-Dialog nicht gefunden.');
writeFileSync(new URL('../dist/artifact.html', import.meta.url), `${head}\n${body.trim()}\n${script.replace(DL_BUTTON, '')}\n`);
writeFileSync(new URL('../dist/kapazitaetsplanung.html', import.meta.url), `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${body.trim()}
${script}
</body>
</html>
`);
console.log('dist/kapazitaetsplanung.html und dist/artifact.html erzeugt.');
