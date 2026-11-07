/**
 * despax_core.js - Componentes y utilidades compartidas de interfaz de usuario
 * Despax Logistics Automation
 */

function toast(msg, duration = 2400) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
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

function mostrarModalBloqueo(bloqueoForzado = false) {
  const modal = document.getElementById('accountBlockedModal');
  const btnCerrar = document.getElementById('btnCerrarModalPago');
  if (!modal) return;
  modal.style.display = 'flex';
  if (typeof cargarInfoPagosModal === 'function') {
    cargarInfoPagosModal();
  }
  if (bloqueoForzado && btnCerrar) {
    btnCerrar.style.display = 'none';
  }
}

function ocultarModalBloqueo() {
  const modal = document.getElementById('accountBlockedModal');
  if (modal) modal.style.display = 'none';
}

// Exportar en window para interoperabilidad global
if (typeof window !== 'undefined') {
  window.toast = window.toast || toast;
  window.mostrarLoaderPagina = window.mostrarLoaderPagina || mostrarLoaderPagina;
  window.ocultarLoaderPagina = window.ocultarLoaderPagina || ocultarLoaderPagina;
  window.mostrarModalBloqueo = window.mostrarModalBloqueo || mostrarModalBloqueo;
  window.ocultarModalBloqueo = window.ocultarModalBloqueo || ocultarModalBloqueo;
}
