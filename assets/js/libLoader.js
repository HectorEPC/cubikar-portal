// assets/js/libLoader.js
// Carga diferida de librerías pesadas (JSZip, SheetJS) con promesa cacheada

const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

const pendingLoads = new Map();

function loadGlobalScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!pendingLoads.has(src)) {
    pendingLoads.set(src, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        if (window[globalName]) {
          resolve(window[globalName]);
        } else {
          pendingLoads.delete(src);
          reject(new Error(`La librería ${globalName} no se inicializó correctamente.`));
        }
      };
      script.onerror = () => {
        pendingLoads.delete(src);
        script.remove();
        reject(new Error(`No se pudo cargar la librería ${globalName}. Revisa tu conexión e inténtalo de nuevo.`));
      };
      document.head.appendChild(script);
    }));
  }
  return pendingLoads.get(src);
}

export const loadJSZip = () => loadGlobalScript(JSZIP_URL, 'JSZip');
export const loadXLSX = () => loadGlobalScript(XLSX_URL, 'XLSX');
