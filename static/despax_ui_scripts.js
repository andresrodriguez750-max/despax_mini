
// --- SISTEMA DE R2 CLOUDFLARE ---
async function uploadFileToR2(file) {
  // 1. Pedir URL prefirmada
  const reqUrl = await fetch('/api/r2/presign-upload', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({filename: file.name})
  });
  const data = await reqUrl.json();
  if (!data.ok) throw new Error(data.error || 'Error solicitando URL de subida');

  // 2. Subir directo a Cloudflare R2 con PUT
  const uploadRes = await fetch(data.upload_url, {
    method: 'PUT',
    headers: {'Content-Type': 'application/pdf'},
    body: file
  });

  if (!uploadRes.ok) throw new Error('Fallo al subir a la nube');
  return data.object_key;
}

const API = '';
let pdfEtiquetas = null;
let modoExcelSeleccionado = 'cantidad';

const THEME_STORAGE_KEY = 'despax-theme';
function aplicarTema(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

const temaGuardado = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
aplicarTema(temaGuardado);

const CACHE_ARCHIVOS_DB = 'despax-archivos-temporales';
const CACHE_ARCHIVOS_KEY = 'seleccion-pendiente';

function abrirCacheArchivos() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(CACHE_ARCHIVOS_DB, 1);
    solicitud.onupgradeneeded = () => solicitud.result.createObjectStore('archivos');
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function guardarArchivosEnCache() {
  const db = await abrirCacheArchivos();
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction('archivos', 'readwrite');
    transaccion.objectStore('archivos').put({
      etiquetas: pdfEtiquetas,
    }, CACHE_ARCHIVOS_KEY);
    transaccion.oncomplete = () => { db.close(); resolve(); };
    transaccion.onerror = () => { db.close(); reject(transaccion.error); };
  });
}

async function restaurarArchivosDesdeCache() {
  try {
    const db = await abrirCacheArchivos();
    const seleccion = await new Promise((resolve, reject) => {
      const transaccion = db.transaction('archivos', 'readwrite');
      const store = transaccion.objectStore('archivos');
      const solicitud = store.get(CACHE_ARCHIVOS_KEY);
      solicitud.onsuccess = () => {
        if (solicitud.result) store.delete(CACHE_ARCHIVOS_KEY);
        resolve(solicitud.result);
      };
      solicitud.onerror = () => reject(solicitud.error);
      transaccion.oncomplete = () => db.close();
    });

    if (!seleccion) return;

    pdfEtiquetas = seleccion.etiquetas || null;

    if (pdfEtiquetas) {
      const etiquetasTransfer = new DataTransfer();
      etiquetasTransfer.items.add(pdfEtiquetas);
      document.getElementById('etiquetasIn').files = etiquetasTransfer.files;
      document.getElementById('dzEtiquetasName').innerHTML =
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>${pdfEtiquetas.name} (${(pdfEtiquetas.size / 1024).toFixed(1)} KB)`;
      const btnNueva = document.getElementById('btnNuevaTanda');
      if (btnNueva) btnNueva.style.display = 'inline-flex';
      ejecutarDiagnosticoEtiquetas(pdfEtiquetas);
    }
    checkButtons();
  } catch (error) {
    console.warn('No se pudieron restaurar los archivos temporales:', error);
  }
}

// ── Funciones de utilidad ───────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ── Modal de Instalación de Extensión ──────────────────────────────────────
let extensionDetected = false;

function abrirModalExtension() {
  const modal = document.getElementById('modalInstalarExtension');
  if (modal) {
    modal.classList.add('show');
    verificarEstadoExtension();
  }
}

function cerrarModalExtension(e) {
  if (e && e.target && e.target.closest && e.target.closest('#modalInstalarExtensionCard') && !e.target.closest('.btn-modal-cancel') && !e.target.closest('[aria-label="Cerrar"]')) {
    return;
  }
  const modal = document.getElementById('modalInstalarExtension');
  if (modal) modal.classList.remove('show');
}

window.abrirModalExtension = abrirModalExtension;
window.cerrarModalExtension = cerrarModalExtension;

function copiarUrlExtensiones() {
  const input = document.getElementById('chromeExtUrlInput');
  const btn = document.getElementById('btnCopiarExtUrl');
  if (!input) return;
  
  navigator.clipboard.writeText(input.value).then(() => {
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#39d98a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiado!`;
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
    toast('Enlace copiado al portapapeles');
  }).catch(() => {
    input.select();
    document.execCommand('copy');
    toast('Enlace copiado');
  });
}
window.copiarUrlExtensiones = copiarUrlExtensiones;

function marcarExtensionConectada(version) {
  extensionDetected = true;
  const badge = document.getElementById('headerExtBadge');
  const banner = document.getElementById('extStatusBanner');
  const msg = document.getElementById('extStatusMsg');
  const dot = document.getElementById('extStatusDot');
  
  if (badge) {
    badge.textContent = `v${version || '1.0.0'} Activa`;
    badge.classList.add('online');
  }
  if (banner) {
    banner.className = 'ext-status-banner detected';
  }
  if (dot) {
    dot.style.background = 'var(--green, #39d98a)';
  }
  if (msg) {
    msg.innerHTML = `<strong>¡Extensión Despax vinculada y activa!</strong> (v${version || '1.0.0'}). Ya podés ingresar a Tiendanube u OCA para rotular tus etiquetas con 1 clic.`;
  }
}

function verificarEstadoExtension() {
  if (document.documentElement.getAttribute('data-despax-extension-installed')) {
    const ver = document.documentElement.getAttribute('data-despax-extension-installed');
    marcarExtensionConectada(ver);
    return;
  }
  
  // Enviar ping al content script
  window.postMessage({ type: 'DESPAX_EXTENSION_PING' }, '*');
  
  setTimeout(() => {
    if (!extensionDetected) {
      const msg = document.getElementById('extStatusMsg');
      if (msg) msg.textContent = 'Extensión aún no detectada. Seguí los pasos a continuación para instalarla en tu navegador.';
    }
  }, 800);
}

// Escuchar eventos de la extensión
window.addEventListener('despax-extension-ready', (e) => {
  marcarExtensionConectada(e.detail?.version);
});
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'DESPAX_EXTENSION_PONG') {
    marcarExtensionConectada(e.data.version);
  }
});

// ── Modal de Generar Excel ──────────────────────────────────────────────────
function abrirModalExcel() {
  const modal = document.getElementById('modalExcel');
  if (modal) modal.classList.add('show');
}

function cerrarModalExcel() {
  const modal = document.getElementById('modalExcel');
  if (modal) modal.classList.remove('show');
}

function setCantidadPill(val) {
  const inp = document.getElementById('tnCantidadInput');
  if (inp) inp.value = val;
}

const modalExcelEl = document.getElementById('modalExcel');
if (modalExcelEl) {
  modalExcelEl.addEventListener('click', (e) => {
    if (e.target === modalExcelEl) cerrarModalExcel();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModalExcel();
});

// ── Selector de Modo para Excel Tiendanube ──────────────────────────────────
function setModoExcel(modo) {
  modoExcelSeleccionado = modo;
  const btnCant = document.getElementById('btnModoCantidad');
  const btnFech = document.getElementById('btnModoFechas');
  const secCant = document.getElementById('seccionCantidad');
  const secFech = document.getElementById('seccionFechas');
  if (modo === 'cantidad') {
    btnCant.classList.add('active');
    btnFech.classList.remove('active');
    secCant.style.display = 'flex';
    secFech.style.display = 'none';
  } else {
    btnFech.classList.add('active');
    btnCant.classList.remove('active');
    secCant.style.display = 'none';
    secFech.style.display = 'flex';
    const fDesde = document.getElementById('fechaDesde');
    const fHasta = document.getElementById('fechaHasta');
    if (!fHasta.value) {
      fHasta.value = new Date().toISOString().split('T')[0];
    }
    if (!fDesde.value) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      fDesde.value = d.toISOString().split('T')[0];
    }
  }
}

// ── Feedback Sonoro Sutil (Web Audio API) ──────────────────────────────────
let audioCtx = null;
const SONIDO_STORAGE_KEY = 'despax_sound_enabled';
let sonidoHabilitado = localStorage.getItem(SONIDO_STORAGE_KEY) !== 'false'; // default ON

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function reproducirSonidoExito() {
  if (!sonidoHabilitado) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Acorde o doble campanada ascendente limpia y sutil (C5 -> E5 -> G5)
    const notas = [523.25, 659.25, 783.99];
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.46);
    });
  } catch (err) {
    console.warn('[Sonido] No se pudo reproducir chime de éxito:', err);
  }
}

function reproducirSonidoAlerta() {
  if (!sonidoHabilitado) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Doble tono suave descendente de advertencia/atención (E4 -> C#4)
    const tonos = [329.63, 277.18];
    tonos.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);

      gain.gain.setValueAtTime(0, now + i * 0.14);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.36);
    });
  } catch (err) {
    console.warn('[Sonido] No se pudo reproducir tono de alerta:', err);
  }
}

function actualizarBotonSonidoUI() {
  const btn = document.getElementById('btnToggleSonido');
  if (!btn) return;
  if (sonidoHabilitado) {
    btn.classList.add('sound-active');
    btn.title = 'Sonido de depósito activo (clic para silenciar)';
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
      <span>Sonido: ON</span>
    `;
  } else {
    btn.classList.remove('sound-active');
    btn.title = 'Sonido silenciado (clic para activar)';
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
      <span>Sonido: OFF</span>
    `;
  }
}

function toggleSonidoFeedback() {
  sonidoHabilitado = !sonidoHabilitado;
  localStorage.setItem(SONIDO_STORAGE_KEY, sonidoHabilitado ? 'true' : 'false');
  actualizarBotonSonidoUI();
  if (sonidoHabilitado) {
    reproducirSonidoExito();
    toast('Sonido de confirmación y alertas activado');
  } else {
    toast('Sonido silenciado');
  }
}
window.toggleSonidoFeedback = toggleSonidoFeedback;

// ── Carga y Limpieza Unificada de PDFs ─────────────────────────────────────
function cargarPdfDesdeArchivo(f, origen = 'archivo') {
  if (!f) return;
  const esPdf = (f.type === 'application/pdf') || (f.name && f.name.toLowerCase().endsWith('.pdf'));
  if (!esPdf) {
    toast('El archivo debe ser un PDF válido (.pdf)');
    return;
  }

  let archivoPdf = f;
  if (!archivoPdf.name || archivoPdf.name === 'blob' || !archivoPdf.name.toLowerCase().endsWith('.pdf')) {
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    archivoPdf = new File([f], `etiquetas_pegadas_${stamp}.pdf`, { type: 'application/pdf' });
  }

  pdfEtiquetas = archivoPdf;

  const input = document.getElementById('etiquetasIn');
  if (input) {
    const dt = new DataTransfer();
    dt.items.add(archivoPdf);
    input.files = dt.files;
  }

  const dz = document.getElementById('dzEtiquetas');
  if (dz) dz.classList.add('ok');

  const dzName = document.getElementById('dzEtiquetasName');
  if (dzName) {
    dzName.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>${archivoPdf.name} (${(archivoPdf.size/1024).toFixed(1)} KB)`;
  }

  const btnNueva = document.getElementById('btnNuevaTanda');
  if (btnNueva) btnNueva.style.display = 'inline-flex';

  checkButtons();
  ejecutarDiagnosticoEtiquetas(archivoPdf);

  if (origen === 'pegar') {
    toast('¡PDF cargado desde el portapapeles!');
  }
}
window.cargarPdfDesdeArchivo = cargarPdfDesdeArchivo;

async function limpiarNuevaTanda(silencioso = false) {
  pdfEtiquetas = null;
  ultimoDiagnostico = null;
  visorDatos = {
    a4_previews: [],
    thermal_previews: [],
    total: 0,
    paginaActual: 0
  };

  const input = document.getElementById('etiquetasIn');
  if (input) input.value = '';

  const dz = document.getElementById('dzEtiquetas');
  if (dz) dz.classList.remove('ok');

  const dzName = document.getElementById('dzEtiquetasName');
  if (dzName) dzName.innerHTML = '';

  const btnNueva = document.getElementById('btnNuevaTanda');
  if (btnNueva) btnNueva.style.display = 'none';

  // Limpiar IndexedDB cache
  try {
    const db = await abrirCacheArchivos();
    const trans = db.transaction('archivos', 'readwrite');
    trans.objectStore('archivos').delete(CACHE_ARCHIVOS_KEY);
    trans.oncomplete = () => db.close();
  } catch (_) {}

  // Resetear estados visuales del diagnóstico
  const sIdle = document.getElementById('diagStateIdle');
  const sLoading = document.getElementById('diagStateLoading');
  const sResult = document.getElementById('diagStateResult');
  const btnRe = document.getElementById('btnReinspeccionar');
  if (sIdle) sIdle.style.display = 'flex';
  if (sLoading) sLoading.style.display = 'none';
  if (sResult) sResult.style.display = 'none';
  if (btnRe) btnRe.style.display = 'none';

  const totalEl = document.getElementById('diagTotalEtiquetas');
  const ordenesEl = document.getElementById('diagOrdenesIdentificadas');
  const transpEl = document.getElementById('diagTransportistas');
  const tamanoEl = document.getElementById('diagTamanoHoja');
  if (totalEl) totalEl.textContent = '—';
  if (ordenesEl) ordenesEl.textContent = '—';
  if (transpEl) transpEl.textContent = '—';
  if (tamanoEl) tamanoEl.textContent = '—';

  const ordContainer = document.getElementById('diagOrdersContainer');
  const ordList = document.getElementById('diagOrdersList');
  if (ordContainer) ordContainer.style.display = 'none';
  if (ordList) ordList.innerHTML = '';

  const chk = document.getElementById('diagChecklist');
  if (chk) chk.innerHTML = '';

  const vEmpty = document.getElementById('visorEmptyState');
  const mA4 = document.getElementById('mockupA4');
  const mThermal = document.getElementById('mockupThermal');
  const pager = document.getElementById('visorPagination');
  if (mA4) mA4.style.display = 'none';
  if (mThermal) mThermal.style.display = 'none';
  if (pager) pager.style.display = 'none';
  if (vEmpty) {
    vEmpty.innerHTML = `
      <div style="width: 44px; height: 44px; border-radius: 10px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; border: 1px solid var(--border); color: var(--accent2);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      </div>
      <h4 style="font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 5px;">Visualizador de Hoja Real</h4>
      <p style="font-size: 11.5px; line-height: 1.45; color: var(--muted); max-width: 280px; margin: 0;">
        Arrastrá tu PDF de etiquetas a la izquierda para previsualizar aquí la hoja con tus etiquetas reales y las comandas al pie.
      </p>
    `;
    vEmpty.style.display = 'flex';
  }

  switchPanel2View('diagnostico');
  checkButtons();

  if (!silencioso) {
    toast('Visor limpio. Listo para una nueva tanda.');
  }
}
window.limpiarNuevaTanda = limpiarNuevaTanda;

// ── Soporte para múltiples archivos PDF (Unión automática) ───────────────────
async function procesarArchivosPdfEntrantes(fileList, origen) {
  if (!fileList || fileList.length === 0) return;
  const pdfs = Array.from(fileList).filter(f => (f.type === 'application/pdf') || (f.name && f.name.toLowerCase().endsWith('.pdf')));
  if (pdfs.length === 0) {
    toast('Los archivos deben ser PDFs válidos (.pdf)');
    return;
  }
  if (pdfs.length === 1) {
    cargarPdfDesdeArchivo(pdfs[0], origen);
    return;
  }
  toast(`Uniendo ${pdfs.length} lotes de PDF...`);
  try {
    const formData = new FormData();
    for (let i = 0; i < pdfs.length; i++) {
      formData.append('pdfs', pdfs[i], pdfs[i].name || `lote_${i + 1}.pdf`);
    }
    const resp = await fetch('/api/unir_pdfs', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Error ${resp.status} al unir archivos`);
    }
    const blob = await resp.blob();
    const totalPags = resp.headers.get('X-Despax-Total-Paginas') || '';
    const mergedName = `etiquetas_${pdfs.length}_lotes_unificados${totalPags ? `_${totalPags}_paginas` : ''}.pdf`;
    const mergedFile = new File([blob], mergedName, { type: 'application/pdf' });
    cargarPdfDesdeArchivo(mergedFile, origen);
    toast(`¡${pdfs.length} lotes unidos con éxito (${totalPags || ''} etiquetas en total)!`);
  } catch (e) {
    console.error('Error al unir múltiples PDFs en dropzone:', e);
    toast('No se pudieron unir los PDFs: ' + e.message);
  }
}
window.procesarArchivosPdfEntrantes = procesarArchivosPdfEntrantes;

// ── File drop handler para etiquetas (Robusto y Multi-área) ────────────────
function setupDropZone(dzId, inputId, nameId, callback) {
  const dz = document.getElementById(dzId);
  const input = document.getElementById(inputId);
  if (!dz || !input) return;

  input.addEventListener('change', e => {
    if (e.target.files && e.target.files.length > 0) {
      procesarArchivosPdfEntrantes(e.target.files, 'input');
    }
  });

  ['dragenter', 'dragover'].forEach(name => {
    dz.addEventListener(name, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('over');
    });
    input.addEventListener(name, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('over');
    });
  });

  ['dragleave', 'dragend'].forEach(name => {
    dz.addEventListener(name, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('over');
    });
    input.addEventListener(name, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('over');
    });
  });

  const onDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    dz.classList.remove('over');
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      procesarArchivosPdfEntrantes(dt.files, 'drop');
    }
  };

  dz.addEventListener('drop', onDrop);
  input.addEventListener('drop', onDrop);

  // También permitir arrastrar el archivo directamente sobre las tarjetas
  ['cardEtiquetas', 'cardDiagnostico'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    ['dragenter', 'dragover'].forEach(n => el.addEventListener(n, e => { e.preventDefault(); e.stopPropagation(); }));
    el.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('over');
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        procesarArchivosPdfEntrantes(dt.files, 'drop');
      }
    });
  });
}

setupDropZone('dzEtiquetas', 'etiquetasIn', 'dzEtiquetasName');

// ── Soporte para pegar PDF con Ctrl + V desde portapapeles ─────────────────
window.addEventListener('paste', (e) => {
  const activeEl = document.activeElement;
  const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  const clipboard = e.clipboardData;
  if (!clipboard) return;

  let pdfFile = null;

  // 1. Revisar clipboard.files (ej: archivo copiado en el Explorador de Windows)
  if (clipboard.files && clipboard.files.length > 0) {
    for (let i = 0; i < clipboard.files.length; i++) {
      const file = clipboard.files[i];
      if (file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'))) {
        pdfFile = file;
        break;
      }
    }
  }

  // 2. Revisar clipboard.items (ej: copiado en el navegador o visor PDF)
  if (!pdfFile && clipboard.items && clipboard.items.length > 0) {
    for (let i = 0; i < clipboard.items.length; i++) {
      const item = clipboard.items[i];
      if (item.kind === 'file' && (item.type === 'application/pdf' || item.type.includes('pdf'))) {
        const file = item.getAsFile();
        if (file) {
          pdfFile = file;
          break;
        }
      }
    }
  }

  if (pdfFile) {
    e.preventDefault();
    cargarPdfDesdeArchivo(pdfFile, 'pegar');
  }
});

// Inicializar estado del botón de sonido
actualizarBotonSonidoUI();

// ── Control de Vistas en Panel 2 (Diagnóstico vs Visor de Hoja) ─────────────
function switchPanel2View(view) {
  const vDiag = document.getElementById('panelViewDiagnostico');
  const vVisor = document.getElementById('panelViewVisor');
  const bDiag = document.getElementById('tabBtnDiagnostico');
  const bVisor = document.getElementById('tabBtnVisor');
  const pTitle = document.getElementById('panel2Title');
  const pIcon = document.getElementById('panel2Icon');

  if (view === 'diagnostico') {
    if (vDiag) vDiag.style.display = 'block';
    if (vVisor) vVisor.style.display = 'none';
    if (bDiag) bDiag.classList.add('active');
    if (bVisor) bVisor.classList.remove('active');
    if (pTitle) pTitle.textContent = 'Control de Calidad';
    if (pIcon) pIcon.innerHTML = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
  } else {
    if (vDiag) vDiag.style.display = 'none';
    if (vVisor) vVisor.style.display = 'flex';
    if (bVisor) bVisor.classList.add('active');
    if (bDiag) bDiag.classList.remove('active');
    if (pTitle) pTitle.textContent = 'Visor de Impresión';
    if (pIcon) pIcon.innerHTML = '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="8.5" x2="18" y2="8.5"/><line x1="6" y1="15" x2="18" y2="15"/>';
    actualizarVisorHoja();
  }
}

let visorDatos = {
  a4_previews: [],
  thermal_previews: [],
  total: 0,
  paginaActual: 0
};
let ultimoDiagnostico = null;

function cambiarPaginaVisor(delta) {
  const sel = document.getElementById('modoOrganizacion');
  const modo = sel ? sel.value : '3';
  const list = modo === '3' ? visorDatos.a4_previews : visorDatos.thermal_previews;
  if (!list || list.length === 0) return;

  const totalPags = list.length;
  const nuevaPag = visorDatos.paginaActual + delta;
  if (nuevaPag >= 0 && nuevaPag < totalPags) {
    visorDatos.paginaActual = nuevaPag;
    actualizarVisorHoja();
  }
}

function actualizarVisorHoja() {
  const sel = document.getElementById('modoOrganizacion');
  const modo = sel ? sel.value : '3';
  const mA4 = document.getElementById('mockupA4');
  const mThermal = document.getElementById('mockupThermal');
  const imgA4 = document.getElementById('realA4Img');
  const imgTh = document.getElementById('realThermalImg');
  const vEmpty = document.getElementById('visorEmptyState');
  const pager = document.getElementById('visorPagerBar');
  const pInd = document.getElementById('visorPaginaIndicador');
  const btnP = document.getElementById('btnVisorPrev');
  const btnN = document.getElementById('btnVisorNext');
  const txtModo = document.getElementById('visorModoTexto');
  const txtBen = document.getElementById('visorBeneficioTexto');

  const list = modo === '3' ? visorDatos.a4_previews : visorDatos.thermal_previews;

  // Si aún no se cargó ningún archivo PDF
  if (!list || list.length === 0) {
    if (vEmpty) vEmpty.style.display = 'flex';
    if (mA4) mA4.style.display = 'none';
    if (mThermal) mThermal.style.display = 'none';
    if (pager) pager.style.display = 'none';
    if (txtModo) txtModo.textContent = modo === '3' ? '3 etiquetas por hoja (horizontal A4)' : '1 etiqueta por hoja (térmico)';
    if (txtBen) {
      txtBen.textContent = modo === '3' ? 'Ahorro de hasta 66% de hojas' : 'Ideal para impresoras de rollo continuo (100x150)';
      txtBen.style.color = modo === '3' ? 'var(--green)' : 'var(--accent2)';
    }
    return;
  }

  // Hay hojas reales disponibles
  if (vEmpty) vEmpty.style.display = 'none';
  if (pager) pager.style.display = 'flex';

  const totalPags = list.length;
  if (visorDatos.paginaActual >= totalPags) visorDatos.paginaActual = 0;

  const totalLote = visorDatos.total || totalPags;
  if (pInd) {
    if (modo === '3') {
      pInd.textContent = `Muestra A4: 3 etiquetas acomodadas (de ${totalLote} totales)`;
    } else {
      pInd.textContent = `Muestra: Etiqueta ${visorDatos.paginaActual + 1} de ${totalPags} (de ${totalLote} totales)`;
    }
  }
  if (btnP) btnP.disabled = visorDatos.paginaActual === 0;
  if (btnN) btnN.disabled = visorDatos.paginaActual >= totalPags - 1;

  if (modo === '3') {
    if (mA4) mA4.style.display = 'flex';
    if (mThermal) mThermal.style.display = 'none';
    if (imgA4) imgA4.src = list[visorDatos.paginaActual] || list[0];
    if (txtModo) txtModo.textContent = '3 etiquetas por hoja (horizontal A4)';
    if (txtBen) {
      txtBen.textContent = 'Ahorro de hasta 66% de hojas';
      txtBen.style.color = 'var(--green)';
    }
  } else {
    if (mA4) mA4.style.display = 'none';
    if (mThermal) mThermal.style.display = 'flex';
    if (imgTh) imgTh.src = list[visorDatos.paginaActual] || list[0];
    if (txtModo) txtModo.textContent = '1 etiqueta por hoja (térmico)';
    if (txtBen) {
      txtBen.textContent = 'Ideal para impresoras de rollo continuo (100x150)';
      txtBen.style.color = 'var(--accent2)';
    }
  }
}

function toggleModoImpresionRapido() {
  const sel = document.getElementById('modoOrganizacion');
  if (!sel) return;
  sel.value = sel.value === '3' ? '1' : '3';
  actualizarVisorHoja();
}

const modoOrgSel = document.getElementById('modoOrganizacion');
if (modoOrgSel) {
  modoOrgSel.addEventListener('change', actualizarVisorHoja);
}

// ── Diagnóstico Previo de Etiquetas (Control de Calidad) ────────────────────
async function ejecutarDiagnosticoEtiquetas(f) {
  if (!f) return;
  const sIdle = document.getElementById('diagStateIdle');
  const sLoading = document.getElementById('diagStateLoading');
  const sResult = document.getElementById('diagStateResult');
  const btnRe = document.getElementById('btnReinspeccionar');
  const vEmpty = document.getElementById('visorEmptyState');
  const mA4 = document.getElementById('mockupA4');
  const mThermal = document.getElementById('mockupThermal');

  if (sIdle) sIdle.style.display = 'none';
  if (sLoading) sLoading.style.display = 'flex';
  if (sResult) sResult.style.display = 'none';

  // Transición visual inmediata (0 ms): abrir visor de inmediato
  switchPanel2View('visor');

  if (vEmpty) {
    vEmpty.innerHTML = `
      <div class="spinner-grande" style="margin-bottom: 12px;"></div>
      <h4 style="font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 4px;">Organizando etiquetas...</h4>
      <p style="font-size: 11.5px; color: var(--muted); margin: 0;">Generando vista previa de ${f.name}...</p>
    `;
    vEmpty.style.display = 'flex';
  }
  if (mA4) mA4.style.display = 'none';
  if (mThermal) mThermal.style.display = 'none';

  const fd = new FormData();
  
  try {
    const r2_key = await uploadFileToR2(f);
    fd.append('r2_etiquetas', r2_key);
    
    const t0 = performance.now();
    const resp = await fetch('/diagnosticar_etiquetas', { method: 'POST', body: fd });
    const t1 = performance.now();
    const data = await resp.json();
    const t2 = performance.now();
    console.log(`[PERF Visor] Red HTTP: ${(t1 - t0).toFixed(1)}ms | Parseo JSON: ${(t2 - t1).toFixed(1)}ms`);
    if (!resp.ok || data.error) {
      throw new Error(data.error || 'Error al inspeccionar etiquetas');
    }

    const totalEl = document.getElementById('diagTotalEtiquetas');
    const ordenesEl = document.getElementById('diagOrdenesIdentificadas');
    const transpEl = document.getElementById('diagTransportistas');
    const tamanoEl = document.getElementById('diagTamanoHoja');

    if (totalEl) totalEl.textContent = `${data.total_etiquetas} pág${data.total_etiquetas === 1 ? '' : 's'}`;
    if (ordenesEl) ordenesEl.textContent = `${data.ordenes_identificadas} orden${data.ordenes_identificadas === 1 ? '' : 'es'}`;
    if (transpEl) transpEl.textContent = (data.transportistas || []).join(', ') || 'Estándar';
    if (tamanoEl) tamanoEl.textContent = data.tamano_hoja || 'Estándar';

    // Guardar estado de diagnóstico para flujo ultra-rápido de 1 solo clic
    ultimoDiagnostico = {
      nombre: f.name,
      tamano: f.size,
      ordenes: data.lista_ordenes || [],
      ordenes_detalles: data.ordenes_detalles || [],
      es_meli: !!(data.es_meli || (data.transportistas && data.transportistas.some(t => t.toLowerCase().includes('mercado')))),
      transportistas: data.transportistas || []
    };

    // Cargar datos en el visor interactivo de hoja real
    visorDatos = {
      a4_previews: data.a4_previews || data.previews || [],
      thermal_previews: data.thermal_previews || data.previews || [],
      total: data.total_etiquetas || 0,
      paginaActual: 0
    };
    
    actualizarVisorHoja();

    // Renderizar badges de estado de pago de cada orden
    const ordContainer = document.getElementById('diagOrdersContainer');
    const ordList = document.getElementById('diagOrdersList');
    const ordSummary = document.getElementById('diagOrdersSummary');
    if (ordContainer && ordList) {
      ordList.innerHTML = '';
      const detalles = data.ordenes_detalles || [];
      if (detalles.length > 0) {
        ordContainer.style.display = 'flex';
        let pagados = 0;
        let noPagados = 0;
        detalles.forEach(it => {
          const badge = document.createElement('span');
          let cls = 'ok';
          let textoPago = it.pago || 'Pagado';
          if (textoPago === 'Pendiente') {
            cls = 'warn';
            noPagados++;
          } else if (textoPago === 'Cancelado') {
            cls = 'danger';
            noPagados++;
          } else if (textoPago === 'Pagado') {
            pagados++;
          }
          badge.className = `diag-order-badge ${cls}`;
          badge.innerHTML = `<span>#${it.orden}</span><span style="opacity:0.85;font-size:9.5px;text-transform:uppercase;">${textoPago}</span>`;
          ordList.appendChild(badge);
        });
        if (ordSummary) {
          ordSummary.textContent = `${pagados} pagados${noPagados > 0 ? ` · ${noPagados} a verificar` : ''}`;
        }
      } else {
        ordContainer.style.display = 'none';
      }
    }

    const chk = document.getElementById('diagChecklist');
    if (chk) {
      chk.innerHTML = '';
      if (data.alerta_pago) {
        chk.className = 'diag-checklist-box warn';
        chk.innerHTML = `
          <span style="color:var(--yellow);flex-shrink:0;margin-top:1px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div style="color:var(--text);">
            <strong>Alerta de cobro:</strong> Se detectaron pedidos con pago pendiente o cancelados. Verificá la lista abajo antes de imprimir.
          </div>
        `;
      } else if (data.sin_orden > 0) {
        chk.className = 'diag-checklist-box warn';
        chk.innerHTML = `
          <span style="color:var(--yellow);flex-shrink:0;margin-top:1px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div style="color:var(--text);">
            <strong>Atención:</strong> ${data.sin_orden} etiqueta${data.sin_orden === 1 ? '' : 's'} no tiene${data.sin_orden === 1 ? '' : 'n'} número de orden impreso. Podés usar la casilla "Asociar manualmente" para asignarla${data.sin_orden === 1 ? '' : 's'}.
          </div>
        `;
      } else {
        chk.className = 'diag-checklist-box ok';
        chk.innerHTML = `
          <span style="color:var(--green);flex-shrink:0;margin-top:1px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <div style="color:var(--text);">
            <strong>Todo listo:</strong> el 100% de las etiquetas tienen su número de orden identificado y listo para rotular.
          </div>
        `;
      }
    }

    if (sLoading) sLoading.style.display = 'none';
    if (sResult) sResult.style.display = 'flex';
    if (btnRe) btnRe.style.display = 'inline-flex';

    if (data.alerta_pago) {
      reproducirSonidoAlerta();
    } else {
      reproducirSonidoExito();
    }
  } catch (err) {
    reproducirSonidoAlerta();
    if (sLoading) sLoading.style.display = 'none';
    if (sIdle) sIdle.style.display = 'flex';
    if (vEmpty) {
      vEmpty.innerHTML = `
        <div style="width: 44px; height: 44px; border-radius: 10px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; border: 1px solid var(--border); color: var(--accent2);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        </div>
        <h4 style="font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 5px;">Visualizador de Hoja Real</h4>
        <p style="font-size: 11.5px; line-height: 1.45; color: var(--muted); max-width: 280px; margin: 0;">
          Arrastrá tu PDF de etiquetas a la izquierda para previsualizar aquí la hoja con tus etiquetas reales y las comandas al pie.
        </p>
      `;
    }
    toast('No se pudo inspeccionar el PDF: ' + err.message);
  }
}

function reinspeccionarEtiquetas() {
  if (pdfEtiquetas) {
    ejecutarDiagnosticoEtiquetas(pdfEtiquetas);
  }
}

function checkButtons() {
  const btnAnotar = document.getElementById('anotarApiBtn');
  if (btnAnotar) {
    btnAnotar.disabled = !pdfEtiquetas;
  }
}

function mostrarLoaderPagina(texto = 'Cargando...') {
  const loader = document.getElementById('pageTransitionLoader');
  const txt = document.getElementById('pageLoaderText');
  if (txt && texto) txt.textContent = texto;
  if (loader) loader.classList.add('show');
}

function ocultarLoaderPagina() {
  const loader = document.getElementById('pageTransitionLoader');
  if (loader) loader.classList.remove('show');
}

window.addEventListener('pageshow', () => {
  ocultarLoaderPagina();
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  if (link.id === 'adminLink') return;
  const href = link.getAttribute('href');
  const target = link.getAttribute('target');
  const download = link.hasAttribute('download');
  if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !download && target !== '_blank' && !link.hasAttribute('onclick')) {
    mostrarLoaderPagina('Cargando...');
  }
});


const adminLink = document.getElementById('adminLink');
if (adminLink) {
  adminLink.addEventListener('click', async event => {
    event.preventDefault();
    const destino = event.currentTarget.href;
    mostrarLoaderPagina('Abriendo Reglas y Promociones...');
    try {
      await guardarArchivosEnCache();
    } catch (error) {
      console.warn('No se pudieron guardar los archivos temporales:', error);
    }
    window.location.href = destino;
  });
}

restaurarArchivosDesdeCache();

// ── Log helpers ───────────────────────────────────────────────────────────────
const logEl = document.getElementById('log');
function clearLog() { logEl.innerHTML = ''; logEl.classList.add('show'); }
function addLog(msg, cls='i') {
  const d = document.createElement('div');
  if (msg.includes('[OK]') || msg.toLowerCase().includes('completado') || msg.toLowerCase().includes('exito') || msg.toLowerCase().includes('éxito')) cls='ok';
  else if (msg.includes('[AVISO]') || msg.toLowerCase().includes('aviso')) cls='warn';
  else if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('falló') || msg.toLowerCase().includes('fallo')) cls='err';
  d.className=`ll ${cls}`; d.textContent=`> ${msg}`;
  logEl.appendChild(d); logEl.scrollTop=logEl.scrollHeight;
}

// ── Confirmar y Ejecutar Generar Excel desde Tiendanube ──────────────────────
async function confirmarGenerarExcel() {
  let payload = { modo: modoExcelSeleccionado };
  if (modoExcelSeleccionado === 'cantidad') {
    const valStr = document.getElementById('tnCantidadInput').value;
    const cantVal = parseInt(valStr, 10);
    if (!cantVal || cantVal < 1) {
      toast('Ingresá una cantidad válida (mínimo 1)');
      return;
    }
    payload.cantidad = cantVal;
  } else {
    const fDesde = document.getElementById('fechaDesde').value;
    const fHasta = document.getElementById('fechaHasta').value;
    if (!fDesde || !fHasta) {
      toast('Completá las fechas Desde y Hasta');
      return;
    }
    if (fDesde > fHasta) {
      toast('La fecha Desde no puede ser posterior a Hasta');
      return;
    }
    payload.fecha_desde = fDesde;
    payload.fecha_hasta = fHasta;
  }

  cerrarModalExcel();
  await ejecutarGenerarExcel(payload);
}

// ── Paginación y control de filas de vista previa de Excel ──────────────────
let filasExcelActuales = [];
let mostrandoTodasLasFilas = false;

function renderizarFilasTabla(todas = false) {
  const tb = document.getElementById('tbl');
  if (!tb) return;
  tb.innerHTML = '';
  
  const total = filasExcelActuales.length;
  const filasAMostrar = todas ? filasExcelActuales : filasExcelActuales.slice(0, 10);
  
  const frag = document.createDocumentFragment();
  filasAMostrar.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="#" style="color:var(--muted);font-size:11px">${i+1}</td>
      <td data-label="Nro Pedido"><span class="pill" style="font-weight:700;">#${row.orden}</span></td>
      <td data-label="Fecha" style="font-size:12px;color:var(--muted);">${row.fecha || '—'}</td>
      <td data-label="Cliente" style="font-size:12px;font-weight:500;">${row.cliente || '—'}</td>
      <td data-label="Producto" style="color:var(--accent2);font-size:12.5px;font-weight:600;">${row.producto}</td>
      <td data-label="Cant."><span class="pill cant">${row.cantidad}</span></td>
      <td data-label="Total" style="font-size:12px;font-weight:600;">${row.total || '—'}</td>
    `;
    frag.appendChild(tr);
  });
  tb.appendChild(frag);

  const footer = document.getElementById('tblFooter');
  const btnTxt = document.getElementById('btnToggleFilasTexto');
  const btnIcon = document.getElementById('btnToggleFilasIcon');
  
  if (total > 10) {
    if (footer) footer.style.display = 'block';
    if (todas) {
      if (btnTxt) btnTxt.textContent = 'Mostrar menos (ver solo las primeras 10)';
      if (btnIcon) btnIcon.style.transform = 'rotate(180deg)';
    } else {
      const restantes = total - 10;
      if (btnTxt) btnTxt.textContent = `Ver más (+${restantes} filas restantes de ${total})`;
      if (btnIcon) btnIcon.style.transform = 'rotate(0deg)';
    }
  } else {
    if (footer) footer.style.display = 'none';
  }
}

function toggleVerMasFilas() {
  mostrandoTodasLasFilas = !mostrandoTodasLasFilas;
  renderizarFilasTabla(mostrandoTodasLasFilas);
}

async function ejecutarGenerarExcel(payload) {
  const btn = document.getElementById('runExcelBtn');
  btn.classList.add('loading');
  btn.disabled = true;
  clearLog();
  document.getElementById('stats').classList.remove('show');
  document.getElementById('tblWrap').classList.remove('show');
  document.getElementById('dlBtn').classList.remove('show');

  if (payload.modo === 'cantidad') {
    addLog(`Consultando los últimos ${payload.cantidad} pedidos en Tiendanube...`);
  } else {
    addLog(`Consultando TODOS los pedidos entre ${payload.fecha_desde} y ${payload.fecha_hasta} en Tiendanube...`);
  }

  try {
    const resp = await fetch(API + '/generar_excel_tiendanube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      addLog(data.error || 'Error al consultar Tiendanube.', 'err');
      return;
    }

    addLog(`Excel generado exitosamente: ${data.total_pedidos} pedidos · ${data.total_unidades} unidades · ${data.total_productos} productos distintos`, 'ok');

    document.getElementById('sPedidos').textContent = data.total_pedidos;
    document.getElementById('sUnid').textContent = data.total_unidades;
    document.getElementById('sProductos').textContent = data.total_productos;
    document.getElementById('stats').classList.add('show');

    filasExcelActuales = data.rows || [];
    mostrandoTodasLasFilas = false;
    renderizarFilasTabla(false);
    document.getElementById('tblWrap').classList.add('show');
    document.getElementById('dlBtn').classList.add('show');
    toast('Excel generado correctamente');
    if (typeof cargarHistorialLotes === 'function') {
      cargarHistorialLotes();
    }
  } catch (e) {
    addLog(`Error de conexión: ${e.message}`, 'err');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    checkButtons();
  }
}

async function elegirAsociacionesManuales(esTiendanube = true) {
  const formData = new FormData();
    const r2_key = await uploadFileToR2(pdfEtiquetas);
    formData.append('r2_etiquetas', r2_key);

  const cargando = document.getElementById('cargandoAsociaciones');
  const loadingTitle = cargando.querySelector('.loading-title');
  const loadingDesc = cargando.querySelector('.loading-desc');
  if (loadingTitle) {
    loadingTitle.textContent = esTiendanube 
      ? 'Buscando pedidos en Tiendanube...' 
      : 'Buscando etiquetas sin orden...';
  }
  if (loadingDesc) {
    loadingDesc.textContent = esTiendanube 
      ? 'Conectando con la tienda y preparando las órdenes para asociar.' 
      : 'Leyendo los PDFs y preparando los pedidos disponibles.';
  }
  cargando.classList.add('show');
  cargando.style.display = 'flex';
  let respuesta;
  let datos;
  try {
    const endpoint = esTiendanube ? '/preparar_asociaciones_tiendanube' : '/preparar_asociaciones';
    respuesta = await fetch(API + endpoint, { method: 'POST', body: formData });
    datos = await respuesta.json();
  } finally {
    cargando.classList.remove('show');
    cargando.style.display = 'none';
  }
  if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron revisar las etiquetas');
  if (!datos.paginas_sin_orden.length) {
    toast('Todas las etiquetas ya tienen número de orden');
    return {};
  }

  return new Promise((resolve, reject) => {
    const modal = document.getElementById('modalAsociaciones');
    const buscador = document.getElementById('buscarOrdenAsociacion');
    const resultado = document.getElementById('resultadoOrdenesAsociacion');
    const paginaTexto = document.getElementById('asociacionPagina');
    const asignadaTexto = document.getElementById('ordenAsociadaActual');
    const btnCerrar = document.getElementById('cerrarModalAsociaciones');
    const asociaciones = {};
    let indice = 0;

    const cerrarModal = () => {
      modal.style.display = 'none';
      reject(new Error('Operación cancelada.'));
    };

    if (btnCerrar) {
      btnCerrar.onclick = cerrarModal;
    }

    const paginaActual = () => datos.paginas_sin_orden[indice];
    const render = () => {
      const pagina = paginaActual();
      paginaTexto.innerHTML = `Página <strong>${pagina}</strong> de ${datos.paginas_sin_orden.length}`;
      
      const ordenAsociada = asociaciones[pagina];
      if (ordenAsociada) {
        asignadaTexto.className = 'association-current asociado';
        asignadaTexto.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Pedido asociado: <strong>#${ordenAsociada}</strong></span>
        `;
      } else {
        asignadaTexto.className = 'association-current';
        asignadaTexto.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Todavía no hay pedido asociado a esta etiqueta.</span>
        `;
      }

      document.getElementById('asociacionAnterior').disabled = (indice === 0);
      document.getElementById('asociacionSiguiente').disabled = (indice >= datos.paginas_sin_orden.length - 1);

      const texto = buscador.value.trim().toLowerCase();
      const ordenes = datos.ordenes.filter(orden => orden.toLowerCase().includes(texto)).slice(0, 60);
      resultado.innerHTML = '';
      
      if (texto && !datos.ordenes.some(o => o.toLowerCase() === texto)) {
        const btnManual = document.createElement('button');
        btnManual.type = 'button';
        btnManual.className = 'btn-orden btn-orden-manual';
        btnManual.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Usar orden #${texto}`;
        btnManual.onclick = () => { asociaciones[pagina] = texto; render(); };
        resultado.appendChild(btnManual);
      }

      if (ordenes.length === 0 && !texto) {
        const vacio = document.createElement('div');
        vacio.className = 'association-empty';
        vacio.textContent = 'No hay órdenes disponibles para asociar.';
        resultado.appendChild(vacio);
      } else {
        ordenes.forEach(orden => {
          const boton = document.createElement('button');
          boton.type = 'button';
          const estaSeleccionada = (asociaciones[pagina] === orden);
          boton.className = 'btn-orden' + (estaSeleccionada ? ' selected' : '');
          boton.textContent = `#${orden}`;
          boton.onclick = () => {
            if (asociaciones[pagina] === orden) {
              delete asociaciones[pagina];
            } else {
              asociaciones[pagina] = orden;
            }
            render();
          };
          resultado.appendChild(boton);
        });
      }
    };

    buscador.value = '';
    buscador.oninput = render;
    document.getElementById('asociacionAnterior').onclick = () => {
      if (indice > 0) { indice--; buscador.value = ''; render(); }
    };
    document.getElementById('asociacionSiguiente').onclick = () => {
      if (indice < datos.paginas_sin_orden.length - 1) { indice++; buscador.value = ''; render(); }
    };
    document.getElementById('confirmarAsociaciones').onclick = () => {
      modal.style.display = 'none';
      resolve(asociaciones);
    };
    modal.style.display = 'flex';
    render();
  });
}

// ── Run ANOTAR CON TIENDANUBE (solo PDF de etiquetas) ──────────────────────
let canceloProceso = false;
window.cancelarAutomatico = function() {
  canceloProceso = true;
  document.getElementById('modalProgreso').classList.remove('show');
  addLog('Proceso cancelado por el usuario.', 'warn');
};

async function runAnotarConTiendanube() {
  if (!pdfEtiquetas) return;

  let asociaciones = {};
  if (document.getElementById('asociarSinOrden').checked) {
    try {
      asociaciones = await elegirAsociacionesManuales(true);
    } catch (error) {
      toast(`${error.message}`);
      return;
    }
  }

  const btn = document.getElementById('anotarApiBtn');
  btn.classList.add('loading');
  btn.disabled = true;
  clearLog();
  const modo = document.getElementById('modoOrganizacion').value;

  canceloProceso = false;
  document.getElementById('modalProgreso').classList.add('show');
  document.getElementById('progresoStatus').textContent = "Subiendo archivo a la nube...";
  document.getElementById('progresoOrden').textContent = "";

  let global_r2_key = null;
  try {
    global_r2_key = await uploadFileToR2(pdfEtiquetas);
  } catch(err) {
    document.getElementById('modalProgreso').classList.remove('show');
    btn.classList.remove('loading');
    btn.disabled = false;
    alert('Error al subir a Cloudflare: ' + err.message);
    return;
  }
  document.getElementById('progresoStatus').textContent = "Iniciando rotulación...";

  const esMeli = !!(ultimoDiagnostico && (ultimoDiagnostico.es_meli || (ultimoDiagnostico.transportistas && ultimoDiagnostico.transportistas.some(t => t.toLowerCase().includes('mercado')))));

  if (esMeli) {
    addLog(`Iniciando rotulación de Mercado Libre... Modo: ${modo === '3' ? '3x1' : '1x1'}`);
    document.getElementById('progresoStatus').textContent = "Procesando etiquetas de Mercado Libre...";
  } else {
    addLog(`Iniciando proceso con Tiendanube... Modo: ${modo === '3' ? '3x1' : '1x1'}`);
  }

  // Fast-Path: Si el archivo ya fue inspeccionado por el diagnóstico, usamos las órdenes y caché listos
  const yaDiagnosticado = ultimoDiagnostico && 
                          ultimoDiagnostico.nombre === pdfEtiquetas.name && 
                          ultimoDiagnostico.tamano === pdfEtiquetas.size;

  let ordenes = yaDiagnosticado ? (ultimoDiagnostico.ordenes || []) : [];

  if (!esMeli && (!yaDiagnosticado || ordenes.length === 0)) {
    document.getElementById('progresoStatus').textContent = "Subiendo archivo a Cloudflare...";
    const fdExt = new FormData();
    try {
      const r2_ext_key = await uploadFileToR2(pdfEtiquetas);
      fdExt.append('r2_etiquetas', r2_ext_key);
      document.getElementById('progresoStatus').textContent = "Extrayendo números de orden...";
    } catch(err) {
      document.getElementById('extrayendoModal').style.display = 'none';
      alert('Error de red al subir archivo a R2 (¿Falta CORS?): ' + err.message);
      return;
    }
    
    try {
      const respExt = await fetch(API + '/extraer_ordenes_pdf', { method: 'POST', body: fdExt });
      if (!respExt.ok) {
        const err = await respExt.json().catch(() => ({}));
        throw new Error(err.error || 'Error al extraer órdenes del PDF.');
      }
      const dataExt = await respExt.json();
      ordenes = dataExt.ordenes || [];
    } catch (error) {
      document.getElementById('modalProgreso').classList.remove('show');
      addLog(`${error.message}`, 'err');
      btn.classList.remove('loading');
      checkButtons();
      return;
    }
  }

  const ordenesManuales = Object.values(asociaciones);
  const todasOrdenes = Array.from(new Set([...ordenes, ...ordenesManuales])).filter(o => o);
  const total = todasOrdenes.length;

  if (esMeli) {
    addLog(`Lote de Mercado Libre detectado (${total || 1} envíos). Extrayendo remito y armando comandas...`, 'ok');
  } else if (total === 0) {
    addLog('No se encontraron números de orden en el PDF de etiquetas.', 'warn');
  } else if (!yaDiagnosticado) {
    addLog(`Encontradas ${total} órdenes en total. Preparando caché de a 10...`);
    const tamañoBatch = 10;
    for (let i = 0; i < total; i += tamañoBatch) {
      if (canceloProceso) {
        btn.classList.remove('loading');
        checkButtons();
        return;
      }
      
      const batch = todasOrdenes.slice(i, i + tamañoBatch);
      const inicio = i + 1;
      const fin = Math.min(i + tamañoBatch, total);
      
      document.getElementById('progresoStatus').textContent = `Buscando pedidos ${inicio} a ${fin} de ${total}...`;
      document.getElementById('progresoOrden').textContent = batch.map(o => `#${o}`).join(', ');
      addLog(`Buscando en Tiendanube pedidos ${inicio} a ${fin} de ${total}...`);
      
      try {
        const respBatch = await fetch(API + '/tiendanube/fetch_batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ordenes: batch })
        });
        
        if (!respBatch.ok) {
          const err = await respBatch.json().catch(() => ({}));
          throw new Error(err.error || 'Error buscando pedidos en Tiendanube.');
        }
      } catch (error) {
        document.getElementById('modalProgreso').classList.remove('show');
        addLog(`${error.message}`, 'err');
        btn.classList.remove('loading');
        checkButtons();
        return;
      }
    }
  } else {
    addLog(`Órdenes ya sincronizadas (${total} órdenes verificadas). Generando PDF...`);
  }

  if (canceloProceso) {
    btn.classList.remove('loading');
    checkButtons();
    return;
  }

  document.getElementById('progresoStatus').textContent = esMeli 
    ? "Generando PDF final de Mercado Libre..." 
    : "Generando PDF final anotado...";
  document.getElementById('progresoOrden').textContent = "";
  addLog(esMeli ? 'Reorganizando etiquetas y omitiendo remitos para optimizar impresión...' : 'Generando y reorganizando PDF final con etiquetas anotadas...');

  const asociacionesStr = Object.entries(asociaciones).map(([pag, ord]) => `${pag}:${ord}`).join(',');

  const fd = new FormData();
  fd.append('r2_etiquetas', global_r2_key);
  fd.append('asociaciones', asociacionesStr);
  fd.append('modo', modo);

  const critEl = document.getElementById('criterioOrdenUI');
  if (critEl) fd.append('criterio_orden', critEl.value);
  const chkDiaUI = document.getElementById('checkMostrarDiaUI');
  if (chkDiaUI) fd.append('mostrar_dia', chkDiaUI.checked ? 'true' : 'false');

  try {
    const resp = await fetch(API + '/anotar_auto_async', { method: 'POST', body: fd });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      addLog(`${err.error || 'No se pudo generar el PDF.'}`, 'err');
      return;
    }
    
    const dataInit = await resp.json();
    const jobId = dataInit.job_id;
    
    document.getElementById('progresoStatus').innerHTML = `
      <div style="margin-top: 10px; text-align: center;">
        <span id="progresoTexto" style="font-weight: 500; font-size: 14px; color: #2c3e50;">Iniciando proceso... 0%</span>
        <div style="width: 100%; height: 8px; background-color: #ecf0f1; border-radius: 4px; margin-top: 8px; overflow: hidden;">
          <div id="progresoBarra" style="width: 0%; height: 100%; background-color: #3498db; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
    
    let downloadUrl = null;
    let alertasWorker = {};

    // Streaming de eventos en tiempo real vía SSE (Event-Driven, sin polling)
    try {
      const jobResult = await new Promise((resolve, reject) => {
        const streamUrl = (API || '') + '/api/pdf/job_stream/' + encodeURIComponent(jobId);
        const es = new EventSource(streamUrl);
        let completed = false;

        const updateUIProgress = (pct, msg) => {
          const b = document.getElementById('progresoBarra');
          const t = document.getElementById('progresoTexto');
          const safePct = Math.min(100, Math.max(0, Math.round(pct)));
          if (b) b.style.width = safePct + '%';
          if (t) t.textContent = msg || `Procesando... ${safePct}%`;
        };

        es.addEventListener('progress', (e) => {
          if (canceloProceso) {
            es.close();
            return;
          }
          try {
            const payload = JSON.parse(e.data);
            const pct = payload.progress || 0;
            const msg = payload.message || `Procesando... ${pct}%`;
            updateUIProgress(pct, msg);
          } catch (_) {}
        });

        es.addEventListener('finished', (e) => {
          completed = true;
          es.close();
          updateUIProgress(100, '¡Listo! 100%');
          try {
            const payload = JSON.parse(e.data);
            resolve(payload);
          } catch (_) {
            resolve({});
          }
        });

        es.addEventListener('failed', (e) => {
          completed = true;
          es.close();
          try {
            const payload = JSON.parse(e.data);
            reject(new Error(payload.error || 'Error en el procesamiento del lote'));
          } catch (_) {
            reject(new Error('Error en el procesamiento del lote'));
          }
        });

        es.onmessage = (e) => {
          if (!e.data || e.data.startsWith(':')) return;
          try {
            const payload = JSON.parse(e.data);
            if (payload.status === 'finished' || payload.event === 'finished') {
              completed = true;
              es.close();
              updateUIProgress(100, '¡Listo! 100%');
              resolve(payload);
            } else if (payload.status === 'failed' || payload.event === 'failed') {
              completed = true;
              es.close();
              reject(new Error(payload.error || 'Error procesando el PDF'));
            } else if (payload.progress !== undefined) {
              updateUIProgress(payload.progress, payload.message);
            }
          } catch (_) {}
        };

        let pollingFallbackIniciado = false;
        es.onerror = async () => {
          if (completed || pollingFallbackIniciado) return;
          pollingFallbackIniciado = true;
          try {
            es.close();
          } catch (_) {}

          let intentos = 0;
          while (!completed && intentos < 180) {
            if (canceloProceso) return;
            try {
              const rescueResp = await fetch((API || '') + '/job_status/' + encodeURIComponent(jobId));
              if (rescueResp.ok) {
                const rescueData = await rescueResp.json();
                if (rescueData.status === 'finished') {
                  completed = true;
                  updateUIProgress(100, '¡Listo! 100%');
                  return resolve(rescueData);
                } else if (rescueData.status === 'failed') {
                  completed = true;
                  return reject(new Error(rescueData.error || 'Error en procesamiento'));
                } else if (rescueData.status === 'processing') {
                  const pct = rescueData.progress !== undefined ? rescueData.progress : 0;
                  updateUIProgress(pct, rescueData.message || ('Procesando... ' + Math.round(pct) + '%'));
                }
              }
            } catch (_) {}

            intentos++;
            if (!completed && intentos < 180) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }

          if (!completed && !canceloProceso) {
            reject(new Error('Se agotó el tiempo de espera o se perdió la conexión con el servidor.'));
          }
        };
      });

      downloadUrl = jobResult.download_url;
      alertasWorker = jobResult.alertas || {};
    } catch (errEvents) {
      addLog(`Error en worker: ${errEvents.message}`, 'err');
      return;
    }
    
    for (const [ordId, motivo] of Object.entries(alertasWorker)) {
      addLog(`[ALERTA] La orden #${ordId} figura ${motivo} en Tiendanube (estampada en etiqueta con aviso de NO despachar).`, 'err');
    }

    const enlace = document.createElement('a');
    enlace.href = downloadUrl;
    enlace.download = pdfEtiquetas.name.replace('.pdf', '_final.pdf');
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    reproducirSonidoExito();
    if (esMeli) {
      addLog('PDF de Mercado Libre anotado y descargado exitosamente.', 'ok');
      addLog('Planilla Excel generada: podés descargarla desde el Historial de Lotes o botón Descargar Excel.', 'ok');
    } else {
      addLog('PDF anotado y descargado con datos de Tiendanube.', 'ok');
    }
    if (typeof cargarHistorialLotes === 'function') {
      cargarHistorialLotes();
    }
  } catch (error) {
    reproducirSonidoAlerta();
    addLog(`Error de conexión: ${error.message}`, 'err');
  } finally {
    document.getElementById('modalProgreso').classList.remove('show');
    btn.classList.remove('loading');
    checkButtons();
  }
}

let currentUserData = null;

function toggleUserMenu(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('userMenuDropdown');
  const trigger = document.getElementById('userMenuTrigger');
  if (!dropdown) return;
  const isOpen = dropdown.classList.toggle('open');
  if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closeUserMenu() {
  const dropdown = document.getElementById('userMenuDropdown');
  const trigger = document.getElementById('userMenuTrigger');
  if (dropdown) dropdown.classList.remove('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

window.toggleUserMenu = toggleUserMenu;
window.closeUserMenu = closeUserMenu;

const popoverEl = document.getElementById('userMenuPopover');
if (popoverEl) {
  popoverEl.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('userMenuDropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    closeUserMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeUserMenu();
  }
});

// ── Control del Drawer Flotante de Historial ─────────────────────────────────
function abrirDrawerHistorial() {
  const overlay = document.getElementById('drawerHistorialOverlay');
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    cargarHistorialLotes();
  }
}

function cerrarDrawerHistorial(e) {
  if (e && e.target && e.target.closest && e.target.closest('#drawerHistorialPanel') && !e.target.closest('.btn-drawer-close')) {
    return;
  }
  const overlay = document.getElementById('drawerHistorialOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

window.abrirDrawerHistorial = abrirDrawerHistorial;
window.cerrarDrawerHistorial = cerrarDrawerHistorial;

// ── Historial de Lotes y Re-descarga Rápida ─────────────────────────────────
async function cargarHistorialLotes() {
  const container = document.getElementById('lotesListContainer');
  const headerBadge = document.getElementById('headerLotesBadge');
  if (!container) return;

  try {
    const res = await fetch('/api/historial_lotes');
    if (!res.ok) return;
    const data = await res.json();
    const lotes = data.lotes || [];
    
    if (headerBadge) {
      headerBadge.textContent = lotes.length;
      headerBadge.style.display = lotes.length > 0 ? 'inline-block' : 'none';
    }

    if (lotes.length === 0) {
      container.innerHTML = `
        <div class="lotes-empty-state" id="lotesEmptyState">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <div style="font-size:13px; font-weight:600; color:var(--text);">Aún no hay lotes generados</div>
          <div style="font-size:11.5px; color:var(--muted); max-width:320px;">Al rotular etiquetas o exportar resúmenes en Excel, aparecerán aquí para que puedas volver a descargarlos con 1 solo clic.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    lotes.forEach(l => {
      const card = document.createElement('div');
      card.className = 'lote-item-card';

      // Tipo tag
      let tagCls = 'pdf-tn';
      let tagText = 'Tiendanube';
      if (l.tipo === 'etiquetas_manual') {
        tagCls = 'pdf-man';
        tagText = 'PDF Manual';
      } else if (l.tipo === 'excel_tiendanube') {
        tagCls = 'excel';
        tagText = 'Excel Tiendanube';
      }

      // Transportistas badges
      let transpBadges = '';
      if (l.transportistas && l.transportistas.length > 0) {
        transpBadges = l.transportistas.map(t => {
          let tCls = '';
          if (t.toLowerCase().includes('oca')) tCls = 'carrier-oca';
          else if (t.toLowerCase().includes('andreani')) tCls = 'carrier-andreani';
          else if (t.toLowerCase().includes('correo')) tCls = 'carrier-correo';
          else if (t.toLowerCase().includes('epick')) tCls = 'carrier-epick';
          return `<span class="pill ${tCls}" style="font-size:10.5px; font-weight:600;">${t}</span>`;
        }).join(' ');
      }

      // Modo label
      let modoLabel = '';
      if (l.modo_impresion === '3') modoLabel = '· 3x1 A4';
      else if (l.modo_impresion === '1') modoLabel = '· Térmico (1x1)';
      else if (l.modo_impresion === 'cantidad') modoLabel = '· Últimos pedidos';
      else if (l.modo_impresion === 'fechas') modoLabel = '· Por fechas';
      else if (l.modo_impresion) modoLabel = `· ${l.modo_impresion}`;

      // Órdenes preview
      let ordsHtml = '';
      if (l.ordenes && l.ordenes.length > 0) {
        const topOrds = l.ordenes.slice(0, 6).map(o => `#${o}`).join(', ');
        const mas = l.ordenes.length > 6 ? ` +${l.ordenes.length - 6} más` : '';
        ordsHtml = `<span style="color:var(--muted); font-size:11.5px;">Órdenes: <strong style="color:var(--accent2); font-weight:600;">${topOrds}${mas}</strong></span>`;
      }

      // Botones de acción
      let accionesHtml = '';
      if (l.tiene_pdf) {
        accionesHtml += `
          <a href="/api/historial_lotes/${l.id}/descargar_pdf" class="btn-lote-dl pdf" title="Descargar PDF anotado">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            PDF Anotado
          </a>
        `;
      }
      if (l.tiene_excel) {
        accionesHtml += `
          <a href="/api/historial_lotes/${l.id}/descargar_excel" class="btn-lote-dl excel" title="Descargar archivo Excel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Excel
          </a>
        `;
      }

      card.innerHTML = `
        <div class="lote-meta-top">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="lote-time">${l.fecha_formato}</span>
            <span class="lote-rel-time">(${l.hace_cuanto})</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="lote-tipo-tag ${tagCls}">${tagText}</span>
            <button type="button" class="btn-lote-delete" onclick="eliminarLote('${l.id}')" title="Eliminar del historial">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="lote-meta-details">
          <span><strong>${l.nombre_original || 'Lote'}</strong></span>
          <span>· ${l.total_ordenes} ${l.total_ordenes === 1 ? 'pedido' : 'pedidos'}</span>
          ${l.total_etiquetas > 0 ? `<span>· ${l.total_etiquetas} ${l.total_etiquetas === 1 ? 'etiqueta' : 'etiquetas'}</span>` : ''}
          <span>${modoLabel}</span>
          ${transpBadges ? `<span>· ${transpBadges}</span>` : ''}
        </div>

        ${ordsHtml ? `<div>${ordsHtml}</div>` : ''}

        <div class="lote-bottom-row">
          <span style="font-size:11px; color:var(--muted);">ID: ${l.id.slice(0, 8)}</span>
          <div class="lote-actions-col">
            ${accionesHtml}
          </div>
        </div>
      `;
      frag.appendChild(card);
    });

    container.appendChild(frag);
  } catch (err) {
    console.error('Error cargando historial de lotes:', err);
  }
}

async function eliminarLote(loteId) {
  if (!confirm('¿Deseas eliminar este lote del historial?')) return;
  try {
    const res = await fetch(`/api/historial_lotes/${loteId}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Lote eliminado');
      cargarHistorialLotes();
    } else {
      const err = await res.json().catch(() => ({}));
      toast(err.error || 'No se pudo eliminar el lote');
    }
  } catch (e) {
    toast('Error al eliminar lote');
  }
}

async function verificarSesionUsuario() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentUserData = data.user;
      const dropdown = document.getElementById('userMenuDropdown');
      const avatar = document.getElementById('userAvatar');
      const name = document.getElementById('userName');
      
      const popoverAvatar = document.getElementById('userPopoverAvatar');
      const popoverName = document.getElementById('userPopoverName');
      const popoverEmail = document.getElementById('userPopoverEmail');

      // Try to populate from cache first
      const cachedName = localStorage.getItem('userDisplayName');
      const cachedInitial = localStorage.getItem('userInitial');
      if (cachedName && name) {
        name.textContent = cachedName;
        name.classList.remove('loading');
      }
      if (cachedInitial && avatar) avatar.textContent = cachedInitial;
      if (cachedInitial && popoverAvatar) popoverAvatar.textContent = cachedInitial;
      if (cachedName && popoverName) popoverName.textContent = cachedName;

      const initial = (data.user.nombre || data.user.username).charAt(0).toUpperCase();
      const displayName = data.user.nombre || data.user.username;

      if (dropdown) dropdown.style.display = 'inline-block';
      if (avatar) avatar.textContent = initial;
      if (name) name.textContent = displayName;

      if (popoverAvatar) popoverAvatar.textContent = initial;
      if (popoverName) popoverName.textContent = displayName;
      if (popoverEmail) popoverEmail.textContent = data.user.email || 'usuario@local';

      if (data.tiendanube) {
        renderTiendanubeBadge(data.tiendanube);
      }

      if (data.user) {
        renderSubscriptionUI(data.user, data.subscription);
      }
    }
  } catch (e) {
    console.error('Error verificando sesión:', e);
  }
}

function renderTiendanubeBadge(data) {
  const badge = document.getElementById('tiendanubeStatusBadge');
  const text = document.getElementById('tiendanubeBadgeText');
  if (data && data.connected && badge && text) {
    text.textContent = data.store_name ? `Tiendanube: ${data.store_name}` : `Tienda #${data.store_id}`;
    badge.style.display = 'inline-flex';
  }
}

async function handleLogout() {
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('despax-admin-cache:')) {
        localStorage.removeItem(k);
      }
    });
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login';
  }
}

async function checkTiendanubeStatus() {
  const badge = document.getElementById('tiendanubeStatusBadge');
  if (badge && badge.style.display === 'inline-flex') return;
  try {
    const res = await fetch('/api/tiendanube/status');
    const data = await res.json();
    renderTiendanubeBadge(data);
  } catch (e) {
    console.debug('Tiendanube status check:', e);
  }
}

function prefillUserFromCookie() {
  const cachedName = getCookie('userDisplayName');
  const cachedInitial = getCookie('userInitial');
  const nameEl = document.getElementById('userName');
  const avatarEl = document.getElementById('userAvatar');
  const popoverAvatarEl = document.getElementById('userPopoverAvatar');
  const popoverNameEl = document.getElementById('userPopoverName');

  if (cachedName && nameEl) {
    nameEl.textContent = cachedName;
    nameEl.classList.remove('loading');
  }
  if (cachedInitial) {
    if (avatarEl) avatarEl.textContent = cachedInitial;
    if (popoverAvatarEl) popoverAvatarEl.textContent = cachedInitial;
  }
  if (cachedName && popoverNameEl) popoverNameEl.textContent = cachedName;
}

function getCookie(name) {
  const match = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
  return match ? decodeURIComponent(match[2]) : null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    let modalCerrado = false;

    const modalExcel = document.getElementById('modalExcel');
    if (modalExcel && modalExcel.classList.contains('show')) {
      cerrarModalExcel();
      modalCerrado = true;
    }

    const modalExt = document.getElementById('modalInstalarExtension');
    if (modalExt && modalExt.classList.contains('show')) {
      cerrarModalExtension();
      modalCerrado = true;
    }

    const modalAsoc = document.getElementById('modalAsociaciones');
    if (modalAsoc && (modalAsoc.style.display === 'flex' || modalAsoc.classList.contains('show') || modalAsoc.classList.contains('open'))) {
      const btnCerrarAsoc = document.getElementById('cerrarModalAsociaciones');
      if (btnCerrarAsoc) btnCerrarAsoc.click();
      else modalAsoc.style.display = 'none';
      modalCerrado = true;
    }

    const modalTN = document.getElementById('modalNuevoProductoTN');
    if (modalTN && modalTN.style.display === 'flex') {
      cerrarModalNuevoProductoTN();
      modalCerrado = true;
    }

    const drawerHist = document.getElementById('drawerHistorialOverlay');
    if (drawerHist && drawerHist.classList.contains('open')) {
      cerrarDrawerHistorial();
      modalCerrado = true;
    }

    const userMenu = document.getElementById('userMenuDropdown');
    if (userMenu && userMenu.classList.contains('open')) {
      closeUserMenu();
      modalCerrado = true;
    }

    const modalPago = document.getElementById('accountBlockedModal');
    if (modalPago && modalPago.style.display !== 'none' && (!currentUserData || !currentUserData.is_blocked)) {
      cerrarModalPagoDirecto();
      modalCerrado = true;
    }

    // Si no había ningún modal abierto y hay un lote/PDF cargado, limpiar para una nueva tanda
    if (!modalCerrado && pdfEtiquetas) {
      limpiarNuevaTanda();
    }
  }
});

let currentSubscriptionData = null;

function renderSubscriptionUI(user, subscription) {
  currentSubscriptionData = subscription || {};
  const badgeEl = document.getElementById('userPopoverSubBadge');
  const bannerEl = document.getElementById('gracePeriodBanner');
  const bannerTitle = document.getElementById('graceBannerTitle');
  const bannerMsg = document.getElementById('graceBannerMsg');

  const status = subscription.status || user.subscription_status || 'trial';
  const isBlocked = !!(subscription.is_blocked || user.is_blocked);
  const badgeText = subscription.badge_text || user.badge_text || 'Prueba';
  const badgeColor = subscription.badge_color || user.badge_color || 'trial';

  if (badgeEl) {
    badgeEl.textContent = badgeText;
    badgeEl.className = `sub-status-badge ${badgeColor}`;
    badgeEl.style.display = 'inline-flex';
  }

  // Si la cuenta está bloqueada por falta de pago
  if (isBlocked) {
    if (bannerEl) bannerEl.style.display = 'none';
    mostrarModalBloqueo(true);
    return;
  }

  // Si está en período de gracia (días 8 al 11)
  const precioTxt = subscription?.price_formatted || (user?.price_ars ? `$${Number(user.price_ars).toLocaleString('es-AR')} ARS` : '');
  const precioAviso = precioTxt ? ` (${precioTxt})` : '';
  const precioAbonar = precioTxt ? ` ${precioTxt}` : ' tu abono';

  if (status === 'grace') {
    if (bannerEl) {
      const dias = user.grace_days_left ?? subscription.grace_days_left ?? 4;
      if (bannerTitle) bannerTitle.textContent = `Período de Gracia: Quedan ${dias} día${dias === 1 ? '' : 's'}`;
      if (bannerMsg) bannerMsg.textContent = `Tu prueba gratis ha concluido. Aboná${precioAbonar} antes de ${dias} día${dias === 1 ? '' : 's'} para evitar la interrupción de tus servicios.`;
      bannerEl.style.display = 'flex';
    }
  } else if ((status === 'trial' || status === 'pro_trial') && user.trial_days_left !== null && user.trial_days_left !== undefined && user.trial_days_left <= 2) {
    // Solo avisar en los últimos 2 días de la prueba
    if (bannerEl) {
      const dias = user.trial_days_left;
      if (bannerTitle) bannerTitle.textContent = `Tu prueba gratuita finaliza en ${dias} día${dias === 1 ? '' : 's'}`;
      if (bannerMsg) bannerMsg.textContent = `Aboná tu suscripción mensual${precioAviso} para seguir disfrutando de Despax sin interrupciones.`;
      bannerEl.style.display = 'flex';
    }
  } else {
    if (bannerEl) bannerEl.style.display = 'none';
  }
}

async function cargarInfoPagosModal() {
  try {
    const res = await fetch('/api/pagos/info');
    if (!res.ok) return;
    const data = await res.json();
    if (data.precio_mensual_ars) {
      const pFmt = `$${Number(data.precio_mensual_ars).toLocaleString('es-AR')} ARS`;
      const pEl = document.getElementById('modalPrecioArs');
      if (pEl) pEl.textContent = pFmt;
      const mpTxt = document.querySelector('#btnMercadoPagoLink span');
      if (mpTxt) mpTxt.textContent = `Pagar con Mercado Pago (${pFmt})`;
      const graceBtnSpan = document.querySelector('.btn-grace-pay span');
      if (graceBtnSpan) graceBtnSpan.textContent = `Abonar ${pFmt}`;
    }
    if (data.mp_link_pago) {
      const mpBtn = document.getElementById('btnMercadoPagoLink');
      if (mpBtn) mpBtn.href = data.mp_link_pago;
    }
    if (data.alias) {
      const el = document.getElementById('bankAliasVal');
      if (el) el.textContent = data.alias;
    }
    if (data.cbu || data.cvu) {
      const el = document.getElementById('bankCbuVal');
      if (el) el.textContent = data.cbu || data.cvu;
    }
    if (data.titular) {
      const el = document.getElementById('bankTitularVal');
      if (el) el.textContent = data.titular;
    }
    if (data.cuit) {
      const el = document.getElementById('bankCuitVal');
      if (el) el.textContent = data.cuit;
    }
    if (data.whatsapp_soporte) {
      const waBtn = document.getElementById('btnWhatsAppSoporte');
      if (waBtn) {
        const cleanNumber = data.whatsapp_soporte.replace(/[^0-9]/g, '');
        waBtn.href = `https://wa.me/${cleanNumber}?text=Hola,%20necesito%20activar%20mi%20cuenta%20de%20Despax`;
      }
    }
  } catch (e) {
    console.error('Error cargando info de pagos:', e);
  }
}

function mostrarModalBloqueo(bloqueoForzado = false) {
  const modal = document.getElementById('accountBlockedModal');
  const btnCerrar = document.getElementById('btnCerrarModalPago');
  if (!modal) return;
  modal.style.display = 'flex';
  cargarInfoPagosModal();

  if (bloqueoForzado) {
    if (btnCerrar) btnCerrar.style.display = 'none';
  } else {
    if (btnCerrar) btnCerrar.style.display = 'inline-flex';
  }
}

function abrirModalPagoDirecto() {
  mostrarModalBloqueo(false);
}

function cerrarModalPagoDirecto() {
  const modal = document.getElementById('accountBlockedModal');
  if (modal && (!currentUserData || !currentUserData.is_blocked)) {
    modal.style.display = 'none';
  }
}

function copiarTextoDesdeElem(elemId, btn) {
  const el = document.getElementById(elemId);
  if (!el) return;
  const texto = el.textContent.trim();
  if (!texto || texto === '-') return;
  navigator.clipboard.writeText(texto).then(() => {
    const orig = btn.textContent;
    btn.textContent = '¡Copiado!';
    btn.style.color = '#39d98a';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.color = '';
    }, 2000);
  });
}

async function enviarComprobantePago(e) {
  e.preventDefault();
  const input = document.getElementById('inputNroComprobante');
  const btn = document.getElementById('btnEnviarComprobante');
  const alertEl = document.getElementById('informarPagoAlert');
  if (!input) return;

  const nro = input.value.trim();
  if (!nro) return;

  try {
    if (btn) btn.disabled = true;
    const res = await fetch('/api/pagos/informar_transferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nro_comprobante: nro })
    });
    const data = await res.json();
    if (alertEl) {
      alertEl.style.display = 'block';
      if (res.ok) {
        alertEl.style.background = 'rgba(57, 217, 138, 0.15)';
        alertEl.style.color = '#39d98a';
        alertEl.textContent = '¡Comprobante informado! Lo verificaremos a la brevedad para reactivar tu cuenta.';
        input.value = '';
      } else {
        alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
        alertEl.style.color = '#f87171';
        alertEl.textContent = data.error || 'Error al informar comprobante.';
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.style.display = 'block';
      alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
      alertEl.style.color = '#f87171';
      alertEl.textContent = 'Error de conexión: ' + err.message;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function checkBienvenidaModal() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('bienvenida') === '1') {
    const modal = document.getElementById('welcomeTrialModal');
    if (modal) modal.style.display = 'flex';
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function cerrarModalBienvenida() {
  const modal = document.getElementById('welcomeTrialModal');
  if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  prefillUserFromCookie();
  verificarSesionUsuario();
  checkTiendanubeStatus();
  cargarHistorialLotes();
  verificarEstadoExtension();
  checkBienvenidaModal();
});

let currentPendingNotif = null;

function escapeHtmlSafe(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function marcarNotificacionComoDescartadaLocal(notif) {
  if (!notif) return;
  try {
    if (notif.id) sessionStorage.setItem('despax_notif_dismissed_' + notif.id, '1');
    if (notif.producto_id) sessionStorage.setItem('despax_notif_dismissed_prod_' + notif.producto_id, '1');
    if (notif.producto_nombre) sessionStorage.setItem('despax_notif_dismissed_nom_' + notif.producto_nombre, '1');
  } catch (e) {}
}

function estaNotificacionDescartadaLocal(notif) {
  if (!notif) return false;
  try {
    if (notif.id && sessionStorage.getItem('despax_notif_dismissed_' + notif.id)) return true;
    if (notif.producto_id && sessionStorage.getItem('despax_notif_dismissed_prod_' + notif.producto_id)) return true;
    if (notif.producto_nombre && sessionStorage.getItem('despax_notif_dismissed_nom_' + notif.producto_nombre)) return true;
  } catch (e) {}
  return false;
}

async function verificarNotificacionesTiendanube() {
  try {
    const res = await fetch('/api/tiendanube/notificaciones-pendientes');
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.notificaciones && data.notificaciones.length > 0) {
      // Filtrar notificaciones que ya fueron descartadas en esta sesión
      const pendientes = data.notificaciones.filter(n => !estaNotificacionDescartadaLocal(n));

      // Sincronizar en background cualquier notificación que ya fue descartada localmente
      data.notificaciones.filter(n => estaNotificacionDescartadaLocal(n)).forEach(n => {
        descartarNotificacionActual(n.id, n.producto_id, n.producto_nombre);
      });

      if (pendientes.length > 0) {
        mostrarModalNuevoProductoTN(pendientes[0]);
      }
    }
  } catch (e) {}
}

function mostrarModalNuevoProductoTN(notif) {
  if (estaNotificacionDescartadaLocal(notif)) return;
  currentPendingNotif = notif;
  const modal = document.getElementById('modalNuevoProductoTN');
  if (!modal) return;

  const elNombre = document.getElementById('tnNotifProdNombre');
  const elCat = document.getElementById('tnNotifCategoria');
  const elVarCount = document.getElementById('tnNotifVariantesCount');
  const elList = document.getElementById('tnNotifVariantesList');

  if (elNombre) elNombre.textContent = notif.producto_nombre || 'Producto';
  const det = notif.detalles || {};
  if (elCat) elCat.textContent = `Categoría: ${det.categoria || 'General'}`;
  if (elVarCount) elVarCount.textContent = `${notif.variantes_count || 1} Variante(s)`;

  if (elList) {
    elList.innerHTML = '';
    const vars = det.variantes || [];
    vars.slice(0, 5).forEach(v => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.innerHTML = `<span><strong>${escapeHtmlSafe(v.variante || 'Único')}</strong></span> <code style="font-family:monospace; color:#38bdf8;">${v.barcode || ''}</code>`;
      elList.appendChild(row);
    });
    if (vars.length > 5) {
      const more = document.createElement('div');
      more.style.fontStyle = 'italic';
      more.style.opacity = '0.8';
      more.textContent = `+ ${vars.length - 5} variantes más...`;
      elList.appendChild(more);
    }
  }

  const btnPromo = document.getElementById('btnNotifAsignarPromo');
  const btnCat = document.getElementById('btnNotifModificarCatalogo');
  const btnDesc = document.getElementById('btnNotifDescartar');

  if (btnPromo) {
    btnPromo.onclick = () => {
      const prodNom = notif.producto_nombre || '';
      cerrarModalNuevoProductoTN();
      window.location.href = `/admin_productos.html?tab=promociones&nuevo_prod=${encodeURIComponent(prodNom)}`;
    };
  }

  if (btnCat) {
    btnCat.onclick = () => {
      const prodNom = notif.producto_nombre || '';
      cerrarModalNuevoProductoTN();
      window.location.href = `/admin_productos.html?tab=codigos_barra&buscar=${encodeURIComponent(prodNom)}`;
    };
  }

  if (btnDesc) {
    btnDesc.onclick = () => {
      cerrarModalNuevoProductoTN();
    };
  }

  modal.style.display = 'flex';
}

function cerrarModalNuevoProductoTN() {
  const modal = document.getElementById('modalNuevoProductoTN');
  if (modal) modal.style.display = 'none';

  if (currentPendingNotif) {
    const notifParaDescartar = currentPendingNotif;
    currentPendingNotif = null;
    marcarNotificacionComoDescartadaLocal(notifParaDescartar);
    descartarNotificacionActual(notifParaDescartar.id, notifParaDescartar.producto_id, notifParaDescartar.producto_nombre);
  }
}

async function descartarNotificacionActual(notifId, prodId, prodNombre) {
  if (!notifId && !prodId && !prodNombre) return;
  const targetId = notifId || '0';
  try {
    await fetch(`/api/tiendanube/notificaciones-pendientes/${encodeURIComponent(targetId)}/descartar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id: prodId || (currentPendingNotif && currentPendingNotif.producto_id),
        producto_nombre: prodNombre || (currentPendingNotif && currentPendingNotif.producto_nombre)
      }),
      keepalive: true
    });
  } catch (e) {
    console.error('Error descartando notificacion en servidor:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modalOverlay = document.getElementById('modalNuevoProductoTN');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        cerrarModalNuevoProductoTN();
      }
    });
  }

  // Conectar SSE para notificaciones en tiempo real (0 peticiones inutiles)
  let notifsSource = null;
  try {
    notifsSource = new EventSource('/api/tiendanube/notificaciones-stream');
    
    notifsSource.onmessage = function(event) {
      if (!event.data || event.data.startsWith(':')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.ok && data.notificaciones && data.notificaciones.length > 0) {
          const pendientes = data.notificaciones.filter(n => !estaNotificacionDescartadaLocal(n));
          if (pendientes.length > 0) {
            mostrarModalNuevoProductoTN(pendientes[0]);
          }
        }
      } catch (e) {
        console.error('Error procesando notificacion en tiempo real:', e);
      }
    };

    notifsSource.onerror = function() {
      // EventSource gestiona automáticamente la reconexión cada 50s
    };

    // Cerrar limpiamente la conexión SSE al navegar o cerrar pestaña para liberar el worker en el servidor
    window.addEventListener('beforeunload', () => {
      if (notifsSource) {
        notifsSource.close();
        notifsSource = null;
      }
    });
  } catch (e) {
    console.warn('No se pudo inicializar stream de notificaciones:', e);
  }
  
  // Por si quedaba algo colgado al abrir la pagina
  setTimeout(verificarNotificacionesTiendanube, 2000);

  // Sincronización automática de scroll-lock en body cuando hay modales abiertos
  function checkModalScrollLock() {
    const overlays = document.querySelectorAll(
      '.catalog-overlay, .modal-blocked-overlay, #modalProgreso, #modalExcel, #modalLotes, #modalAsociaciones, #modalInstalarExtension'
    );
    let anyOpen = false;
    overlays.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        anyOpen = true;
      }
    });
    document.body.classList.toggle('modal-open', anyOpen);
  }

  const modalObserver = new MutationObserver(() => checkModalScrollLock());
  document.querySelectorAll('.catalog-overlay, .modal-blocked-overlay, #modalProgreso, #modalExcel, #modalLotes, #modalAsociaciones, #modalInstalarExtension').forEach(m => {
    modalObserver.observe(m, { attributes: true, attributeFilter: ['style', 'class'] });
  });
});
