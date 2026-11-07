let productosData = [];
let filteredData = [];
let categoriasData = [];
let currentUserData = null;
let currentSubscriptionData = null;
let currentTiendanubeStatus = null;
let bootstrapPromise = null;

// ── Transición de pantalla entre páginas ──────────────────────────────────────
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
  const href = link.getAttribute('href');
  const target = link.getAttribute('target');
  const download = link.hasAttribute('download');
  
  if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !download && target !== '_blank') {
    mostrarLoaderPagina(href === '/' ? 'Abriendo Analizador...' : 'Cargando...');
  }
});

// ── Funciones de utilidad ───────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function cerrarModal() {
  document.getElementById('modalProducto').style.display = 'none';
}

// ── Tabs con Persistencia Automática ───────────────────────────────────────
const VALID_TABS = ['promociones', 'reglas', 'mercadolibre', 'preferencias', 'codigos_barra'];

function obtenerTabInicial() {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam && VALID_TABS.includes(tabParam)) return tabParam;

  if (urlParams.get('mercadolibre_connected') || urlParams.get('mercadolibre_error')) {
    return 'mercadolibre';
  }

  const hashTab = window.location.hash.replace('#', '').trim().toLowerCase();
  if (hashTab && VALID_TABS.includes(hashTab)) return hashTab;

  // Por defecto siempre abrir el panel principal de Promociones
  return 'promociones';
}

function mostrarTab(tab, actualizarUrl = true) {
  if (tab === 'codigos_barra') {
    window.location.href = '/codigos_barra.html';
    return;
  }
  if (!VALID_TABS.includes(tab)) tab = 'promociones';

  try {
    localStorage.setItem('admin_active_tab', tab);
    if (actualizarUrl && window.location.hash !== '#' + tab) {
      history.replaceState(null, '', '#' + tab);
    }
  } catch(e) {}

  const tabPromos = document.getElementById('tabPromociones');
  const tabReglas = document.getElementById('tabReglas');
  const tabMeLi = document.getElementById('tabMercadoLibre');
  const tabPref = document.getElementById('tabPreferencias');
  const tabBarcodes = document.getElementById('tabCodigosBarra');
  if (tabPromos) tabPromos.classList.toggle('active', tab === 'promociones');
  if (tabReglas) tabReglas.classList.toggle('active', tab === 'reglas');
  if (tabMeLi) tabMeLi.classList.toggle('active', tab === 'mercadolibre');
  if (tabPref) tabPref.classList.toggle('active', tab === 'preferencias');
  if (tabBarcodes) tabBarcodes.classList.toggle('active', tab === 'codigos_barra');
  
  const panelPromos = document.getElementById('panelPromociones');
  const panelReglas = document.getElementById('panelReglas');
  const panelMeLi = document.getElementById('panelMercadoLibre');
  const panelPref = document.getElementById('panelPreferencias');
  const panelBarcodes = document.getElementById('panelCodigosBarra');
  if (panelPromos) panelPromos.style.display = tab === 'promociones' ? 'block' : 'none';
  if (panelReglas) panelReglas.style.display = tab === 'reglas' ? 'block' : 'none';
  if (panelMeLi) panelMeLi.style.display = tab === 'mercadolibre' ? 'block' : 'none';
  if (panelPref) panelPref.style.display = tab === 'preferencias' ? 'block' : 'none';
  if (panelBarcodes) panelBarcodes.style.display = tab === 'codigos_barra' ? 'block' : 'none';
  
  if (tab === 'promociones') {
    cargarPromociones();
  } else if (tab === 'reglas') {
    cargarReglasEtiquetas();
  } else if (tab === 'mercadolibre') {
    verificarEstadoMercadoLibre();
    cargarReglasMercadoLibre();
  } else if (tab === 'preferencias') {
    cargarPreferenciasRotulado();
  } else if (tab === 'codigos_barra') {
    cargarCodigosBarra();
  }
}

window.addEventListener('hashchange', () => {
  const h = window.location.hash.replace('#', '').trim().toLowerCase();
  if (VALID_TABS.includes(h)) {
    mostrarTab(h, false);
  }
});

// ── Preferencias de Rotulado e Impresión ────────────────────────────────────
let currentCriterioOrden = 'dia';

function seleccionarCriterio(criterio) {
  currentCriterioOrden = criterio;
  const optDia = document.getElementById('optCriterioDia');
  const optProd = document.getElementById('optCriterioProductos');
  if (optDia) {
    optDia.classList.toggle('selected', criterio === 'dia');
    const rad = optDia.querySelector('input');
    if (rad) rad.checked = (criterio === 'dia');
  }
  if (optProd) {
    optProd.classList.toggle('selected', criterio === 'productos');
    const rad = optProd.querySelector('input');
    if (rad) rad.checked = (criterio === 'productos');
  }
}

function actualizarVistaPreviaPref() {
  const chk = document.getElementById('checkMostrarDia');
  const prev = document.getElementById('prefLiveHeaderPreview');
  if (!prev) return;
  if (chk && chk.checked) {
    prev.textContent = '[ MA ]';
    prev.style.opacity = '1';
    prev.style.color = 'var(--accent, #2f80ed)';
  } else {
    prev.textContent = '— (Cabecera limpia) —';
    prev.style.opacity = '0.5';
    prev.style.color = 'var(--muted, #8eabc2)';
  }
}

async function cargarPreferenciasRotulado() {
  try {
    const res = await fetch('/api/preferencias_rotulado');
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.preferencias) {
      const pref = data.preferencias;
      seleccionarCriterio(pref.criterio_orden || 'dia');
      const chkDia = document.getElementById('checkMostrarDia');
      if (chkDia) chkDia.checked = (pref.mostrar_dia !== false);
      const chkPrint = document.getElementById('checkAutoImprimir');
      if (chkPrint) chkPrint.checked = (pref.auto_imprimir !== false);
      actualizarVistaPreviaPref();
    }
  } catch (err) {
    console.warn('Error al cargar preferencias:', err);
  }
}

async function guardarPreferenciasRotulado() {
  const btn = document.getElementById('btnGuardarPreferencias');
  const succ = document.getElementById('prefSaveSuccess');
  if (btn) btn.disabled = true;

  const chkDia = document.getElementById('checkMostrarDia');
  const chkPrint = document.getElementById('checkAutoImprimir');

  const payload = {
    criterio_orden: currentCriterioOrden,
    mostrar_dia: chkDia ? chkDia.checked : true,
    auto_imprimir: chkPrint ? chkPrint.checked : true
  };

  try {
    const res = await fetch('/api/preferencias_rotulado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Error al guardar');

    toast('¡Preferencias de rotulado guardadas con éxito!');
    if (succ) {
      succ.style.display = 'inline-flex';
      setTimeout(() => { succ.style.display = 'none'; }, 3500);
    }
  } catch (err) {
    toast('Error: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function filaReglaEtiqueta(regla = {producto_id:'', nombre:'', formato:'{nombre} - {color} - {talle}'}) {
  const tiene = campo => regla.formato.includes('{' + campo + '}') || (campo === 'modelo' && regla.formato.includes('{variantes}'));
  const fila = document.createElement('tr');
  
  // Deducir orden desde formato existente
  let ordenDetectado = 'nombre,color,talle,modelo';
  if (regla.formato) {
    const matches = [...regla.formato.matchAll(/\{(nombre|modelo|color|talle|tipo|variantes)\}/g)].map(m => m[1] === 'variantes' ? 'modelo' : m[1]);
    if (matches.length > 0) {
      if (matches[0] === 'color' && matches[1] === 'talle') {
        ordenDetectado = 'color,talle,nombre,modelo';
      } else if (matches[0] === 'nombre' && matches[1] === 'color') {
        ordenDetectado = 'nombre,color,talle,modelo';
      } else if (matches[0] === 'nombre' && matches[1] === 'modelo') {
        ordenDetectado = 'nombre,modelo,color,talle';
      } else if (matches[0] === 'modelo' && matches[1] === 'color') {
        ordenDetectado = 'modelo,color,talle,nombre';
      } else if (matches[0] === 'modelo' && matches[1] === 'talle') {
        ordenDetectado = 'modelo,talle,color,nombre';
      }
    }
  }

  fila.innerHTML = `<td data-label="Producto"><input class="regla-id" type="hidden" value="${regla.producto_id}"><strong class="regla-titulo-texto">${regla.titulo || 'Producto sin nombre'}</strong></td>
    <td data-label="Texto Principal"><input class="field-in regla-nombre" value="${regla.nombre || ''}" placeholder="Ej. Manta"></td>
    <td data-label="Datos a mostrar" style="white-space:nowrap">
      <label style="cursor:pointer;"><input class="campo-nombre" type="checkbox" style="accent-color:var(--accent);" ${tiene('nombre') ? 'checked' : ''}> Texto principal</label><br>
      <label style="cursor:pointer;"><input class="campo-modelo" type="checkbox" style="accent-color:var(--accent);" ${tiene('modelo') ? 'checked' : ''}> Título original</label><br>
      <label style="cursor:pointer;"><input class="campo-color" type="checkbox" style="accent-color:var(--accent);" ${tiene('color') ? 'checked' : ''}> Color</label><br>
      <label style="cursor:pointer;"><input class="campo-talle" type="checkbox" style="accent-color:var(--accent);" ${tiene('talle') ? 'checked' : ''}> Talle</label><br>
    </td>
    <td data-label="Orden"><select class="regla-orden field-in">
      <option value="nombre,color,talle,modelo">Texto · Color · Talle</option>
      <option value="color,talle,nombre,modelo">Color · Talle</option>
      <option value="nombre,modelo,color,talle">Texto · Título · Color · Talle</option>
      <option value="modelo,color,talle,nombre">Título · Color · Talle</option>
      <option value="modelo,talle,color,nombre">Título · Talle · Color</option>
      <option value="modelo,tipo,color,talle,nombre">Título · Tipo · Color · Talle</option>
    </select></td>
    <td data-label="Vista Previa" class="vista-previa" style="color:var(--accent2); font-weight:600;"></td>
    <td data-label="Acciones">
      <button class="btn-eliminar" onclick="this.closest('tr').remove()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    </td>`;
  
  const selectOrden = fila.querySelector('.regla-orden');
  if (selectOrden && ordenDetectado) {
    selectOrden.value = ordenDetectado;
  }

  fila.querySelectorAll('input, select').forEach(control => control.addEventListener('input', () => actualizarVistaPrevia(fila)));
  actualizarVistaPrevia(fila);
  return fila;
}

function actualizarVistaPrevia(fila) {
  const nombreInput = fila.querySelector('.regla-nombre').value.trim();
  const nombreChk = fila.querySelector('.campo-nombre').checked;
  const modeloChk = fila.querySelector('.campo-modelo').checked;
  const colorChk = fila.querySelector('.campo-color').checked;
  const talleChk = fila.querySelector('.campo-talle').checked;
  const tituloEl = fila.querySelector('.regla-titulo-texto') || fila.querySelector('strong');
  const titulo = tituloEl ? tituloEl.textContent.trim() : '';
  const orden = fila.querySelector('.regla-orden').value.split(',');

  const partes = [];
  orden.forEach(campo => {
    if (campo === 'nombre' && nombreChk && nombreInput) partes.push(nombreInput);
    if (campo === 'modelo' && modeloChk) partes.push(titulo);
    if (campo === 'color' && colorChk) partes.push('Gris');
    if (campo === 'talle' && talleChk) partes.push('L');
  });

  const preview = fila.querySelector('.vista-previa');
  if (preview) {
    preview.textContent = partes.length ? partes.join(' - ') : '—';
  }
}

const ADMIN_CACHE_PREFIX = 'despax-admin-cache:';
let adminVersions = null;

async function bootstrapAdmin() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const respuesta = await fetch('/api/admin/bootstrap');
      if (!respuesta.ok) {
        if (respuesta.status === 401) {
          window.location.href = '/login';
          return null;
        }
        throw new Error(`Bootstrap status: ${respuesta.status}`);
      }
      const data = await respuesta.json();
      if (data && data.ok) {
        // 1. Hidratar versiones de catálogo y reglas
        if (data.versiones) {
          adminVersions = data.versiones;
        }
        const uid = (adminVersions && adminVersions.user_id) || (data.me && data.me.id) || 'anon';
        const boot = (adminVersions && adminVersions.boot) || 'boot';

        // 2. Hidratar categorías (memoria y caché localStorage)
        if (data.categorias) {
          categoriasData = data.categorias;
          const claveCat = `${ADMIN_CACHE_PREFIX}u${uid}:categorias`;
          try {
            localStorage.setItem(claveCat, JSON.stringify({
              user_id: uid,
              boot: boot,
              version: adminVersions ? adminVersions.categorias : 0,
              data: data.categorias
            }));
          } catch (e) {}
        }

        // 3. Hidratar reglas Tiendanube (caché localStorage)
        if (data.reglas_tn) {
          const claveReglas = `${ADMIN_CACHE_PREFIX}u${uid}:reglas`;
          try {
            localStorage.setItem(claveReglas, JSON.stringify({
              user_id: uid,
              boot: boot,
              version: adminVersions ? (adminVersions.version_reglas_tn ?? adminVersions.reglas) : 0,
              data: data.reglas_tn
            }));
          } catch (e) {}
        }

        // 4. Hidratar reglas de Mercado Libre
        if (data.reglas_ml) {
          reglasMercadoLibreData = data.reglas_ml;
        }

        // 5. Estado de Tiendanube
        if (data.tiendanube_status) {
          currentTiendanubeStatus = data.tiendanube_status;
        }

        // 6. Hidratar usuario y suscripción
        if (data.me) {
          currentUserData = data.me;
          if (typeof aplicarDatosUsuario === 'function') {
            aplicarDatosUsuario(data.me, data.subscription || data.me.subscription);
          }
        }

        return data;
      }
    } catch (err) {
      console.warn('Bootstrap no disponible o falló:', err);
    }
    return null;
  })();

  return bootstrapPromise;
}

async function obtenerVersionesAdmin() {
  if (adminVersions) return adminVersions;
  const respuesta = await fetch('/admin-version', {cache: 'no-store'});
  if (!respuesta.ok) throw new Error('No se pudo comprobar la versión del catálogo');
  adminVersions = await respuesta.json();
  return adminVersions;
}

function invalidarCacheAdmin(...recursos) {
  adminVersions = null;
  recursos.forEach(recurso => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(ADMIN_CACHE_PREFIX) && k.endsWith(':' + recurso)) {
        localStorage.removeItem(k);
      }
    });
  });
}

function limpiarTodaLaCacheAdmin() {
  adminVersions = null;
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith(ADMIN_CACHE_PREFIX)) {
      localStorage.removeItem(k);
    }
  });
}

async function cargarRecursoAdmin(recurso, url) {
  const versiones = await obtenerVersionesAdmin();
  const uid = versiones.user_id || 'anon';
  const clave = `${ADMIN_CACHE_PREFIX}u${uid}:${recurso}`;
  const cache = JSON.parse(localStorage.getItem(clave) || 'null');
  if (cache && cache.user_id === uid && cache.boot === versiones.boot && cache.version === versiones[recurso]) {
    return cache.data;
  }

  const respuesta = await fetch(url, {cache: 'no-store'});
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${recurso}`);
  const data = await respuesta.json();
  localStorage.setItem(clave, JSON.stringify({user_id: uid, boot: versiones.boot, version: versiones[recurso], data}));
  return data;
}

async function cargarReglasEtiquetas() {
  try {
    const reglas = await cargarRecursoAdmin('reglas', '/reglas-etiquetas-tiendanube');
    const cuerpo = document.getElementById('tbodyReglasEtiquetas');
    cuerpo.innerHTML = '';
    reglas.forEach(regla => cuerpo.appendChild(filaReglaEtiqueta(regla)));
  } catch (error) { toast('No se pudieron cargar las reglas'); }
}

function agregarReglaEtiqueta() { document.getElementById('tbodyReglasEtiquetas').appendChild(filaReglaEtiqueta()); }

async function importarProductosTiendanube(boton) {
  boton.disabled = true;
  boton.textContent = 'Importando catálogo...';
  try {
    const respuesta = await fetch('/reglas-etiquetas-tiendanube/importar', {method:'POST'});
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo importar');
    invalidarCacheAdmin('reglas');
    await cargarReglasEtiquetas();
    toast(`${datos.importados} productos importados`);
  } catch (error) { toast(error.message); }
  finally { 
    boton.disabled = false; 
    boton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> Importar productos de Tiendanube`; 
  }
}

async function guardarReglasEtiquetas() {
  const reglas = [...document.querySelectorAll('#tbodyReglasEtiquetas tr')].map(fila => {
    const campos = ['nombre','modelo','color','talle'].filter(campo => fila.querySelector('.campo-' + campo).checked);
    const orden = fila.querySelector('.regla-orden').value.split(',');
    const formato = orden.filter(campo => campos.includes(campo)).map(campo => '{' + campo + '}').join(' - ');
    return { producto_id: fila.querySelector('.regla-id').value.trim(), titulo: fila.querySelector('strong').textContent.trim(), nombre: fila.querySelector('.regla-nombre').value.trim(), formato };
  }).filter(regla => regla.producto_id);
  const resp = await fetch('/reglas-etiquetas-tiendanube', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(reglas)
  });
  if (resp.ok) { invalidarCacheAdmin('reglas'); toast('Reglas guardadas correctamente'); }
  else toast(((await resp.json()).error || 'No se pudieron guardar'));
}

// ── Mercado Libre: Catálogo y Reglas ──────────────────────────────────────────
let reglasMercadoLibreData = [];

function filaReglaMercadoLibre(regla = {item_id:'', titulo_publicacion:'', texto_principal:'', formato:'{nombre} - {color} - {talle}', variaciones:[]}) {
  const tiene = campo => regla.formato ? regla.formato.includes('{' + campo + '}') : false;
  const fila = document.createElement('tr');
  fila.dataset.itemId = regla.item_id || '';
  
  let ordenDetectado = 'nombre,color,talle,modelo';
  if (regla.formato) {
    const matches = [...regla.formato.matchAll(/\{(nombre|modelo|color|talle|sku)\}/g)].map(m => m[1]);
    if (matches.length > 0) {
      if (matches[0] === 'color' && matches[1] === 'talle') {
        ordenDetectado = 'color,talle,nombre,modelo';
      } else if (matches[0] === 'nombre' && matches[1] === 'color') {
        ordenDetectado = 'nombre,color,talle,modelo';
      } else if (matches[0] === 'nombre' && matches[1] === 'modelo') {
        ordenDetectado = 'nombre,modelo,color,talle';
      }
    }
  }

  const varInfo = Array.isArray(regla.variaciones) && regla.variaciones.length > 0
    ? `<small style="display:block; color:var(--muted); font-size:11px; margin-top:3px;">${regla.variaciones.length} variantes (${regla.variaciones.map(v => v.combinacion).slice(0, 2).join(', ')}${regla.variaciones.length > 2 ? '...' : ''})</small>`
    : '';

  fila.innerHTML = `<td data-label="Publicación">
      <input class="regla-ml-id" type="hidden" value="${regla.item_id}">
      <strong class="regla-ml-titulo">${regla.titulo_publicacion || 'Publicación sin título'}</strong>
      <small style="display:block; color:var(--text-2); font-size:11px; font-family:monospace;">ID: ${regla.item_id}</small>
      ${varInfo}
    </td>
    <td data-label="Texto Principal"><input class="field-in regla-ml-texto" value="${regla.texto_principal || regla.titulo_publicacion || ''}" placeholder="Ej. Manta Polar"></td>
    <td data-label="Datos a Mostrar" style="white-space:nowrap">
      <label style="cursor:pointer;"><input class="campo-ml-nombre" type="checkbox" style="accent-color:var(--accent);" ${tiene('nombre') ? 'checked' : ''}> Texto personalizado</label><br>
      <label style="cursor:pointer;"><input class="campo-ml-modelo" type="checkbox" style="accent-color:var(--accent);" ${tiene('modelo') ? 'checked' : ''}> Título original</label><br>
      <label style="cursor:pointer;"><input class="campo-ml-color" type="checkbox" style="accent-color:var(--accent);" ${tiene('color') ? 'checked' : ''}> Color / Variante</label><br>
      <label style="cursor:pointer;"><input class="campo-ml-talle" type="checkbox" style="accent-color:var(--accent);" ${tiene('talle') ? 'checked' : ''}> Talle</label><br>
      <label style="cursor:pointer;"><input class="campo-ml-sku" type="checkbox" style="accent-color:var(--accent);" ${tiene('sku') ? 'checked' : ''}> SKU</label><br>
    </td>
    <td data-label="Orden"><select class="regla-ml-orden field-in">
      <option value="nombre,color,talle,modelo">Texto · Color · Talle</option>
      <option value="color,talle,nombre,modelo">Color · Talle</option>
      <option value="nombre,modelo,color,talle">Texto · Título · Color · Talle</option>
      <option value="modelo,color,talle,nombre">Título · Color · Talle</option>
    </select></td>
    <td data-label="Vista Previa" class="vista-previa-ml" style="color:var(--yellow, #fbbf24); font-weight:600;"></td>
    <td data-label="Acciones">
      <button class="btn-eliminar" onclick="eliminarFilaReglaML(this, '${regla.item_id}')" title="Eliminar publicación">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    </td>`;
  
  const selectOrden = fila.querySelector('.regla-ml-orden');
  if (selectOrden && ordenDetectado) {
    selectOrden.value = ordenDetectado;
  }

  fila.querySelectorAll('input, select').forEach(control => control.addEventListener('input', () => actualizarVistaPreviaML(fila)));
  actualizarVistaPreviaML(fila);
  return fila;
}

function actualizarVistaPreviaML(fila) {
  const nombreInput = fila.querySelector('.regla-ml-texto').value.trim();
  const nombreChk = fila.querySelector('.campo-ml-nombre').checked;
  const modeloChk = fila.querySelector('.campo-ml-modelo').checked;
  const colorChk = fila.querySelector('.campo-ml-color').checked;
  const talleChk = fila.querySelector('.campo-ml-talle').checked;
  const skuChk = fila.querySelector('.campo-ml-sku').checked;
  const titulo = fila.querySelector('.regla-ml-titulo').textContent.trim();
  const orden = fila.querySelector('.regla-ml-orden').value.split(',');

  const partes = [];
  orden.forEach(campo => {
    if (campo === 'nombre' && nombreChk && nombreInput) partes.push(nombreInput);
    if (campo === 'modelo' && modeloChk) partes.push(titulo);
    if (campo === 'color' && colorChk) partes.push('Negro');
    if (campo === 'talle' && talleChk) partes.push('M');
    if (campo === 'sku' && skuChk) partes.push('SKU-123');
  });

  const preview = fila.querySelector('.vista-previa-ml');
  if (preview) {
    preview.textContent = partes.length ? partes.join(' - ') : '—';
  }
}

async function cargarReglasMercadoLibre(force = false) {
  if (!force && reglasMercadoLibreData && reglasMercadoLibreData.length > 0) {
    renderTablaMercadoLibre(reglasMercadoLibreData);
    return;
  }
  try {
    const res = await fetch('/api/mercadolibre/reglas');
    const reglas = await res.json();
    reglasMercadoLibreData = reglas;
    renderTablaMercadoLibre(reglas);
  } catch (error) {
    toast('No se pudieron cargar los productos de Mercado Libre');
  }
}

function renderTablaMercadoLibre(reglas) {
  const cuerpo = document.getElementById('tbodyReglasMercadoLibre');
  if (!cuerpo) return;
  cuerpo.innerHTML = '';
  if (!reglas || reglas.length === 0) {
    cuerpo.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:35px; color:var(--text-2);">No hay publicaciones sincronizadas de Mercado Libre. Hacé clic en "Importar publicaciones" para traer tu catálogo.</td></tr>';
    return;
  }
  reglas.forEach(regla => cuerpo.appendChild(filaReglaMercadoLibre(regla)));
}

function filtrarTablaMercadoLibre() {
  const el = document.getElementById('buscarProductoML');
  if (!el) return;
  const q = el.value.toLowerCase().trim();
  const filas = document.querySelectorAll('#tbodyReglasMercadoLibre tr');
  filas.forEach(f => {
    const txt = f.textContent.toLowerCase();
    f.style.display = (!q || txt.includes(q)) ? '' : 'none';
  });
}

async function verificarEstadoMercadoLibre() {
  const banner = document.getElementById('meliConnectionBanner');
  const info = document.getElementById('meliConnectionInfo');
  const actions = document.getElementById('meliConnectionActions');
  if (!banner || !info || !actions) return;

  try {
    const res = await fetch('/api/mercadolibre/status');
    const data = await res.json();
    banner.style.display = 'flex';

    if (data.connected) {
      banner.style.background = 'rgba(16, 185, 129, 0.1)';
      banner.style.border = '1px solid rgba(16, 185, 129, 0.25)';
      info.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>
        <span style="color:var(--text);">Conectado con Mercado Libre: <b style="color:var(--signal-strong);">${data.nickname || 'Vendedor'}</b> <span style="color:var(--text-2); font-size:12px;">(ID: ${data.ml_user_id || '-'})</span></span>
      `;
      actions.innerHTML = `
        <a href="/api/mercadolibre/oauth/authorize?next=/admin_productos.html" style="font-size:12px; color:var(--text-2); text-decoration:underline; cursor:pointer;">Re-vincular cuenta</a>
      `;
    } else {
      banner.style.background = 'rgba(245, 158, 11, 0.12)';
      banner.style.border = '1px solid rgba(245, 158, 11, 0.3)';
      info.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#f59e0b;"></span>
        <span style="color:var(--text);">Tu cuenta de Mercado Libre <b>no está vinculada</b> o la sesión expiró. Conectala para importar tus publicaciones:</span>
      `;
      actions.innerHTML = `
        <a href="/api/mercadolibre/oauth/authorize?next=/admin_productos.html" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; background:linear-gradient(135deg, #FFE600 0%, #F5D000 100%); color:#2D3277; font-weight:700; text-decoration:none; box-shadow:0 2px 8px rgba(255,230,0,0.25);">
          Conectar con Mercado Libre
        </a>
      `;
    }
  } catch (e) {
    console.error('Error al verificar estado de Mercado Libre:', e);
  }
}

async function importarProductosMercadoLibre(boton) {
  boton.disabled = true;
  const originalHTML = boton.innerHTML;
  boton.textContent = 'Importando publicaciones de Mercado Libre...';
  const alertEl = document.getElementById('meliErrorAlert');
  if (alertEl) alertEl.style.display = 'none';

  try {
    const res = await fetch('/api/mercadolibre/productos/importar', { method: 'POST' });
    let data = {};
    try { data = await res.json(); } catch(_) {}
    if (!res.ok || !data.ok) {
      const msg = data.error || data.message || `Error del servidor (${res.status})`;
      if (alertEl) {
        alertEl.innerHTML = `
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div>
              <div style="font-weight:700; margin-bottom:4px;">No se pudieron sincronizar las publicaciones:</div>
              <div>${msg}</div>
              <div style="margin-top:10px;">
                <a href="/api/mercadolibre/oauth/authorize?next=/admin_productos.html" style="display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; background:linear-gradient(135deg, #FFE600 0%, #F5D000 100%); color:#2D3277; font-weight:700; text-decoration:none; font-size:12.5px;">
                  Hacé clic acá para conectar / renovar tu cuenta de Mercado Libre
                </a>
              </div>
            </div>
            <button type="button" onclick="this.parentElement.parentElement.style.display='none'" style="background:transparent; border:none; color:inherit; cursor:pointer; font-size:16px;">&times;</button>
          </div>
        `;
        alertEl.style.display = 'block';
      }
      throw new Error(msg);
    }
    toast(data.message || `${data.importados} publicaciones sincronizadas`);
    await verificarEstadoMercadoLibre();
    await cargarReglasMercadoLibre();
    await cargarProductosDisponibles();
  } catch (err) {
    toast('Error: ' + err.message);
  } finally {
    boton.disabled = false;
    boton.innerHTML = originalHTML;
  }
}

async function agregarProductoMLManual(boton) {
  const input = document.getElementById('inputManualML');
  const valor = (input?.value || '').trim();
  if (!valor) {
    toast('Ingresá el ID (ej: MLA...) o el link de la publicación');
    return;
  }
  const originalHTML = boton.innerHTML;
  boton.disabled = true;
  boton.textContent = 'Buscando...';
  try {
    const res = await fetch('/api/mercadolibre/productos/agregar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: valor })
    });
    let data = {};
    try { data = await res.json(); } catch(_) {}
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Error del servidor (${res.status})`);
    }
    toast(data.message || 'Publicación agregada con éxito');
    if (input) input.value = '';
    await cargarReglasMercadoLibre();
    await cargarProductosDisponibles();
  } catch (err) {
    toast('Error: ' + err.message);
  } finally {
    boton.disabled = false;
    boton.innerHTML = originalHTML;
  }
}

async function ejecutarDiagnosticoMeLi(btn) {
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Consultando MeLi...';
  const alertEl = document.getElementById('meliErrorAlert');
  try {
    const res = await fetch('/api/mercadolibre/test_extraccion');
    const data = await res.json();
    if (alertEl) {
      alertEl.style.display = 'block';
      alertEl.style.background = 'var(--bg-2)';
      alertEl.style.color = 'var(--text)';
      alertEl.style.border = '1px solid var(--border)';
      alertEl.innerHTML = `
        <div style="font-weight:700; margin-bottom:6px; color:var(--signal-strong);">Diagnóstico de API Mercado Libre en tiempo real:</div>
        <pre style="background:var(--bg); padding:10px; border-radius:8px; font-size:11.5px; max-height:220px; overflow-y:auto; font-family:monospace; border:1px solid var(--border);">${JSON.stringify(data, null, 2)}</pre>
        <div style="margin-top:8px; text-align:right;">
          <button type="button" onclick="this.parentElement.parentElement.style.display='none'" style="background:var(--primary); color:#fff; border:none; padding:4px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Cerrar</button>
        </div>
      `;
    }
  } catch (e) {
    toast('Error en diagnóstico: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function guardarReglasMercadoLibre() {
  const filas = document.querySelectorAll('#tbodyReglasMercadoLibre tr');
  const reglas = [];
  filas.forEach(fila => {
    const item_id = fila.querySelector('.regla-ml-id')?.value;
    if (!item_id) return;
    const titulo_publicacion = fila.querySelector('.regla-ml-titulo')?.textContent.trim() || '';
    const texto_principal = fila.querySelector('.regla-ml-texto')?.value.trim() || '';
    
    const campos = ['nombre','modelo','color','talle','sku'].filter(c => fila.querySelector('.campo-ml-' + c)?.checked);
    const orden = fila.querySelector('.regla-ml-orden')?.value.split(',') || [];
    const formato = orden.filter(c => campos.includes(c)).map(c => '{' + c + '}').join(' - ');

    reglas.push({
      item_id,
      titulo_publicacion,
      texto_principal,
      formato
    });
  });

  try {
    const res = await fetch('/api/mercadolibre/reglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reglas)
    });
    if (res.ok) {
      toast('Reglas de Mercado Libre guardadas');
    } else {
      const err = await res.json();
      toast(err.error || 'Error al guardar reglas');
    }
  } catch (e) {
    toast(e.message);
  }
}

async function eliminarFilaReglaML(boton, itemId) {
  if (!confirm('¿Eliminar esta publicación de las reglas?')) return;
  try {
    const res = await fetch(`/api/mercadolibre/reglas/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      boton.closest('tr').remove();
      toast('Publicación eliminada');
    }
  } catch (e) {
    toast(e.message);
  }
}

// ── Cargar datos iniciales ─────────────────────────────────────────────────
async function cargarCategoriasSelect() {
  try {
    const cats = await cargarRecursoAdmin('categorias', '/categorias');
    categoriasData = cats;
    
    const selectCat = document.getElementById('campoCategoria');
    const filtroCat = document.getElementById('filtroCategoria');
    
    selectCat.innerHTML = '';
    filtroCat.innerHTML = '<option value="">Todas las categorías</option>';
    
    cats.forEach(cat => {
      const option = `<option value="${cat.nombre}">${cat.nombre}</option>`;
      selectCat.innerHTML += option;
      filtroCat.innerHTML += option;
    });
  } catch(e) {
    console.error('Error cargando categorías:', e);
  }
}

// ── Productos ─────────────────────────────────────────────────────────────
async function cargarProductos() {
  try {
    const data = await cargarRecursoAdmin('productos', '/mapeo');
    const mapeo = JSON.parse(data.contenido || '{}');
    
    productosData = [];
    for (const categoria in mapeo) {
      for (const modelo in mapeo[categoria]) {
        for (const item of mapeo[categoria][modelo]) {
          productosData.push({
            categoria,
            modelo,
            color: item.color || '',
            talle: item.talle || '',
            texto: item.texto || ''
          });
        }
      }
    }
    
    filteredData = [...productosData];
    renderTablaProductos();
  } catch(e) {
    toast('Error cargando productos');
    console.error(e);
  }
}

function renderTablaProductos() {
  const tbody = document.getElementById('tbodyProductos');
  const filtroCat = document.getElementById('filtroCategoria').value;
  const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
  
  filteredData = productosData.filter(p => {
    if (filtroCat && p.categoria !== filtroCat) return false;
    if (busqueda) {
      return p.modelo.toLowerCase().includes(busqueda) ||
             p.color.toLowerCase().includes(busqueda) ||
             p.texto.toLowerCase().includes(busqueda);
    }
    return true;
  });
  
  if (filteredData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px;">No hay productos</td></tr>';
    return;
  }
  
  let html = '';
  const MAX_ROWS = 100;
  const toRender = filteredData.slice(0, MAX_ROWS);
  
  toRender.forEach((p, index) => {
    // Usamos el index real dentro de filteredData
    const globalIndex = filteredData.indexOf(p);
    const catObj = (categoriasData || []).find(c => c.nombre === p.categoria);
    const catStyle = catObj ? `background:#${catObj.color_fondo}; color:#${catObj.color_texto};` : 'background:var(--accent-soft); color:var(--accent2);';
    html += `<tr>
      <td><span class="categoria-badge" style="${catStyle}">${p.categoria}</span></td>
      <td><strong>${p.modelo}</strong></td>
      <td>${p.color || '-'}</td>
      <td>${p.talle || '-'}</td>
      <td style="max-width:300px; font-size:12px; color:var(--accent2); font-family:var(--font-mono, monospace);">${p.texto}</td>
      <td class="acciones">
        <div class="acciones-btns">
          <button class="btn-editar" onclick="editarProducto(${globalIndex})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            Editar
          </button>
          <button class="btn-eliminar" onclick="eliminarProducto(${globalIndex})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Eliminar
          </button>
        </div>
      </td>
    </tr>`;
  });
  
  if (filteredData.length > MAX_ROWS) {
    html += `<tr><td colspan="6" style="text-align:center; padding:15px; color:var(--accent2); font-size:12px;">Se muestran ${MAX_ROWS} de ${filteredData.length} resultados. Usa el buscador para filtrar.</td></tr>`;
  }
  
  tbody.innerHTML = html;
}

function abrirModalProducto() {
  document.getElementById('modalTitulo').innerText = 'Agregar Nuevo Producto';
  document.getElementById('editIndex').value = '';
  document.getElementById('campoModelo').value = '';
  document.getElementById('campoColor').value = '';
  document.getElementById('campoTexto').value = '';
  document.getElementById('tipoCompleto').checked = true;
  document.getElementById('tipoFunda').checked = false;
  
  const checkboxes = document.querySelectorAll('.talle-checkbox');
  checkboxes.forEach(cb => cb.checked = false);
  
  document.getElementById('modalProducto').style.display = 'flex';
}

function editarProducto(index) {
  const p = filteredData[index];
  const realIndex = productosData.findIndex(x => 
    x.categoria === p.categoria && 
    x.modelo === p.modelo && 
    x.color === p.color && 
    x.talle === p.talle && 
    x.texto === p.texto
  );
  
  document.getElementById('modalTitulo').innerText = 'Editar Producto';
  document.getElementById('editIndex').value = realIndex;
  document.getElementById('editCategoriaOriginal').value = p.categoria;
  document.getElementById('editModeloOriginal').value = p.modelo;
  document.getElementById('editColorOriginal').value = p.color;
  document.getElementById('editTalleOriginal').value = p.talle;
  
  document.getElementById('campoCategoria').value = p.categoria;
  document.getElementById('campoModelo').value = p.modelo.replace(' (solo funda)', '');
  document.getElementById('campoColor').value = p.color;
  document.getElementById('campoTexto').value = p.texto;
  
  const esFunda = p.modelo.includes('(solo funda)');
  document.getElementById('tipoCompleto').checked = !esFunda;
  document.getElementById('tipoFunda').checked = esFunda;
  
  const checkboxes = document.querySelectorAll('.talle-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = (cb.value === p.talle);
  });
  
  document.getElementById('modalProducto').style.display = 'flex';
}

async function eliminarProducto(index) {
  if (!confirm('¿Estás seguro de eliminar este producto?')) return;
  
  const p = filteredData[index];
  try {
    const resp = await fetch('/mapeo');
    const data = await resp.json();
    let mapeo = JSON.parse(data.contenido || '{}');
    
    if (mapeo[p.categoria] && mapeo[p.categoria][p.modelo]) {
      const items = mapeo[p.categoria][p.modelo];
      const itemIndex = items.findIndex(item => 
        item.texto === p.texto && 
        item.color === p.color && 
        item.talle === p.talle
      );
      
      if (itemIndex !== -1) {
        items.splice(itemIndex, 1);
        
        if (items.length === 0) {
          delete mapeo[p.categoria][p.modelo];
        }
        
        await fetch('/mapeo', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({contenido: JSON.stringify(mapeo, null, 2)})
        });
        
        toast('Producto eliminado');
        cargarProductos();
      }
    }
  } catch(e) {
    toast('Error: ' + e.message);
  }
}

async function guardarProducto() {
  const categoria = document.getElementById('campoCategoria').value;
  let modelo = document.getElementById('campoModelo').value.trim();
  const coloresInput = document.getElementById('campoColor').value.trim();
  const textoBase = document.getElementById('campoTexto').value.trim();
  const editIndex = document.getElementById('editIndex').value;

  const tipoCompleto = document.getElementById('tipoCompleto').checked;
  const tipoFunda = document.getElementById('tipoFunda').checked;

  const checkboxes = document.querySelectorAll('.talle-checkbox');
  const tallesSeleccionados = [];
  checkboxes.forEach(cb => {
    if (cb.checked) tallesSeleccionados.push(cb.value);
  });

  const colores = coloresInput ? coloresInput.split(',').map(c => c.trim()) : [''];

  if (!modelo || !textoBase) {
    toast('Modelo y texto son obligatorios');
    return;
  }

  if (tallesSeleccionados.length === 0) {
    toast('Seleccioná al menos un talle');
    return;
  }

  if (!tipoCompleto && !tipoFunda) {
    toast('Seleccioná al menos un tipo');
    return;
  }

  try {
    const resp = await fetch('/mapeo');
    const data = await resp.json();
    let mapeo = JSON.parse(data.contenido || '{}');
    
    if (!mapeo[categoria]) {
      mapeo[categoria] = {};
    }

    if (editIndex !== '') {
      const oldCat = document.getElementById('editCategoriaOriginal').value;
      const oldModelo = document.getElementById('editModeloOriginal').value;
      const oldColor = document.getElementById('editColorOriginal').value;
      const oldTalle = document.getElementById('editTalleOriginal').value;
      const oldTexto = productosData[editIndex]?.texto;

      if (mapeo[oldCat] && mapeo[oldCat][oldModelo]) {
        const items = mapeo[oldCat][oldModelo];
        const itemIndex = items.findIndex(item => 
          item.texto === oldTexto && 
          item.color === oldColor && 
          item.talle === oldTalle
        );
        
        if (itemIndex !== -1) {
          items.splice(itemIndex, 1);
        }
        
        if (mapeo[oldCat][oldModelo].length === 0) {
          delete mapeo[oldCat][oldModelo];
        }
        
        if (Object.keys(mapeo[oldCat]).length === 0) {
          delete mapeo[oldCat];
        }
      }
    }

    let productosAgregados = 0;
    const tipos = [];
    if (tipoCompleto) tipos.push('completo');
    if (tipoFunda) tipos.push('funda');

    for (const tipo of tipos) {
      let modeloConTipo = modelo;
      if (tipo === 'funda') {
        modeloConTipo = `${modelo} (solo funda)`;
      }

      if (!mapeo[categoria][modeloConTipo]) {
        mapeo[categoria][modeloConTipo] = [];
      }

      for (const talle of tallesSeleccionados) {
        for (const color of colores) {
          let textoCompleto = textoBase;
          
          if (color) {
            const posPrimeraComa = textoCompleto.indexOf(',');
            if (posPrimeraComa !== -1) {
              const despuesDeComa = textoCompleto.substring(posPrimeraComa + 1).trim();
              const colorYaExiste = despuesDeComa.toLowerCase().startsWith(color.toLowerCase());
              
              if (!colorYaExiste) {
                textoCompleto = textoCompleto.substring(0, posPrimeraComa + 1) + 
                               ` ${color},` + 
                               textoCompleto.substring(posPrimeraComa + 1);
              }
            } else {
              if (!textoCompleto.toLowerCase().includes(color.toLowerCase())) {
                textoCompleto = `${textoCompleto}, ${color}`;
              }
            }
          }
          
          if (talle !== 'U') {
            const tieneTalleCorrecto = new RegExp(`talla\\s+${talle}`, 'i').test(textoCompleto);
            if (!tieneTalleCorrecto) {
              const posTalla = textoCompleto.toLowerCase().indexOf('talla');
              if (posTalla !== -1) {
                const antesTalla = textoCompleto.substring(0, posTalla + 5);
                const despuesTalla = textoCompleto.substring(posTalla + 5);
                const talleExistente = despuesTalla.trim().match(/^[a-zA-Z0-9]+/);
                if (talleExistente) {
                  textoCompleto = antesTalla + despuesTalla.replace(/^[a-zA-Z0-9]+/, talle);
                } else {
                  textoCompleto = antesTalla + ` ${talle}` + despuesTalla;
                }
              } else {
                textoCompleto = `${textoCompleto} (talla ${talle}`;
              }
            }
          }
          
          if (tipo === 'funda' && !textoCompleto.toLowerCase().includes('solo funda')) {
            if (!textoCompleto.toLowerCase().includes('funda de repuesto')) {
              textoCompleto = `${textoCompleto}, solo funda de repuesto`;
            }
          }

          textoCompleto = textoCompleto.replace(/\s+/g, ' ').trim();

          const existe = mapeo[categoria][modeloConTipo].some(item => 
            item.texto === textoCompleto && 
            item.color === color && 
            item.talle === talle
          );
          
          if (!existe) {
            mapeo[categoria][modeloConTipo].push({
              texto: textoCompleto,
              color: color,
              talle: talle
            });
            productosAgregados++;
          }
        }
      }
      
      if (mapeo[categoria][modeloConTipo].length === 0) {
        delete mapeo[categoria][modeloConTipo];
      }
    }
    
    if (Object.keys(mapeo[categoria]).length === 0) {
      delete mapeo[categoria];
    }

    const jsonToSend = JSON.stringify(mapeo, null, 2);
    
    const guardarResp = await fetch('/mapeo', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({contenido: jsonToSend})
    });

    if (guardarResp.ok) {
      toast(`${productosAgregados} producto(s) guardado(s)`);
      cerrarModal();
      invalidarCacheAdmin('productos', 'categorias');
      await cargarProductos();
      await cargarCategoriasSelect();
    } else {
      const errorData = await guardarResp.json();
      toast('Error al guardar: ' + (errorData.error || 'desconocido'));
    }

  } catch(e) {
    toast('Error: ' + e.message);
  }
}

// ── Categorías ─────────────────────────────────────────────────────────────
async function cargarCategorias() {
  try {
    categoriasData = await cargarRecursoAdmin('categorias', '/categorias');
    renderTablaCategorias();
  } catch(e) {
    toast('Error cargando categorías');
    console.error(e);
  }
}

function renderTablaCategorias() {
  const tbody = document.getElementById('tbodyCategorias');
  
  if (categoriasData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px;">No hay categorías</td></tr>';
    return;
  }
  
  let html = '';
  categoriasData.forEach(cat => {
    html += `<tr>
      <td><strong>${cat.nombre}</strong></td>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="color-preview" style="background:#${cat.color_fondo};"></span>
          <input type="color" id="color_${cat.nombre}" value="#${cat.color_fondo}" style="width:48px; height:30px; background:transparent; border:1px solid var(--border); border-radius:4px; cursor:pointer;">
        </div>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="color-preview" style="background:#${cat.color_texto};"></span>
          <input type="color" id="texto_${cat.nombre}" value="#${cat.color_texto}" style="width:48px; height:30px; background:transparent; border:1px solid var(--border); border-radius:4px; cursor:pointer;">
        </div>
      </td>
      <td class="acciones">
        <div class="acciones-btns">
          <button class="btn-editar" onclick="actualizarColores('${cat.nombre}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            Actualizar
          </button>
          <button class="btn-eliminar" onclick="eliminarCategoria('${cat.nombre}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Eliminar
          </button>
        </div>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

async function agregarCategoria() {
  const nombre = document.getElementById('nuevaCategoria').value.trim().toUpperCase();
  if (!nombre) {
    toast('Ingresá un nombre');
    return;
  }
  
  try {
    const resp = await fetch('/categorias', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({nombre})
    });
    
    if (resp.ok) {
      toast('Categoría agregada');
      document.getElementById('nuevaCategoria').value = '';
      invalidarCacheAdmin('categorias', 'productos');
      cargarCategorias();
      cargarCategoriasSelect();
    } else {
      const error = await resp.json();
      toast((error.error || 'Error al agregar'));
    }
  } catch(e) {
    toast('Error: ' + e.message);
  }
}

async function actualizarColores(nombre) {
  const colorFondo = document.getElementById(`color_${nombre}`).value.substring(1);
  const colorTexto = document.getElementById(`texto_${nombre}`).value.substring(1);
  
  try {
    const resp = await fetch(`/categorias/${nombre}/colores`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        color_fondo: colorFondo,
        color_texto: colorTexto
      })
    });
    
    if (resp.ok) {
      toast('Colores actualizados');
      invalidarCacheAdmin('categorias', 'productos');
      cargarCategorias();
    } else {
      toast('Error al actualizar');
    }
  } catch(e) {
    toast('Error: ' + e.message);
  }
}

async function eliminarCategoria(nombre) {
  if (!confirm(`¿Eliminar categoría ${nombre}?`)) return;
  
  try {
    const resp = await fetch(`/categorias/${nombre}`, {method: 'DELETE'});
    if (resp.ok) {
      toast('Categoría eliminada');
      invalidarCacheAdmin('categorias', 'productos');
      cargarCategorias();
      cargarCategoriasSelect();
    } else {
      toast('Error al eliminar');
    }
  } catch(e) {
    toast('Error: ' + e.message);
  }
}

async function init() {
  await bootstrapAdmin();
  mostrarTab(obtenerTabInicial());
  const urlParams = new URLSearchParams(window.location.search);
  const buscarParam = urlParams.get('buscar');
  const nuevoProdParam = urlParams.get('nuevo_prod');
  if (buscarParam) {
    setTimeout(() => {
      const searchBox = document.getElementById('buscarCodigoBarra');
      if (searchBox) {
        searchBox.value = buscarParam;
        if (typeof filtrarCodigosBarra === 'function') filtrarCodigosBarra();
      }
    }, 350);
  }
  if (nuevoProdParam) {
    setTimeout(() => {
      if (typeof abrirModalNuevaPromocion === 'function') {
        abrirModalNuevaPromocion();
        const inputNombre = document.getElementById('promoNombre');
        if (inputNombre) inputNombre.value = `Promo ${nuevoProdParam}`;
      }
    }, 350);
  }
}

init();

// ── Promociones ─────────────────────────────────────────────────────────────
let promocionesData = [];
let productosDisponibles = {};
let filtroCanalPromociones = 'todas';
let productosDisponiblesTN = [];
let productosDisponiblesML = [];

function filtrarCanalPromociones(canal, btn) {
  filtroCanalPromociones = canal;
  document.querySelectorAll('.btn-canal-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTablaPromociones();
}

async function cargarPromociones() {
  try {
    const data = await cargarRecursoAdmin('promociones', '/promociones');
    promocionesData = data;
    renderTablaPromociones();
    cargarProductosDisponibles();
  } catch (e) {
    toast('Error cargando promociones');
    console.error(e);
  }
}

function renderTablaPromociones() {
  const tbody = document.getElementById('tbodyPromociones');
  if (!tbody) return;
  const inputBuscar = document.getElementById('buscarPromocion');
  const filtro = inputBuscar ? inputBuscar.value.trim().toLowerCase() : '';
  const filtrados = promocionesData.filter(p => {
    // Filtro por canal
    const canal = p.canal || 'tiendanube';
    if (filtroCanalPromociones !== 'todas') {
      if (canal !== 'todas' && canal !== filtroCanalPromociones) return false;
    }
    // Filtro por texto
    if (!filtro) return true;
    return (p.nombre && p.nombre.toLowerCase().includes(filtro)) ||
           (p.tipo && p.tipo.toLowerCase().includes(filtro)) ||
           (p.regalo && p.regalo.toLowerCase().includes(filtro));
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-2);">No hay promociones registradas para esta selección</td></tr>';
    return;
  }

  let html = '';
  filtrados.forEach(p => {
    const tipoBadge = p.tipo === '2x1'
      ? '<span class="categoria-badge" style="background:var(--accent-soft);color:var(--accent2);border:1px solid var(--accent-glow);">2x1</span>'
      : '<span class="categoria-badge" style="background:var(--yellow-soft);color:var(--yellow);border:1px solid var(--yellow-border);">Regalo</span>';
    const estadoBadge = p.activa
      ? '<span class="categoria-badge" style="background:var(--green-soft);color:var(--green);border:1px solid var(--green-border);">Activa</span>'
      : '<span class="categoria-badge" style="background:var(--red-soft);color:var(--red);border:1px solid var(--red-border);">Inactiva</span>';
    
    let canalBadge = '<span class="canal-badge tiendanube">Tiendanube</span>';
    if (p.canal === 'mercadolibre') {
      canalBadge = '<span class="canal-badge mercadolibre">Mercado Libre</span>';
    } else if (p.canal === 'todas') {
      canalBadge = '<span class="canal-badge todas">Ambas</span>';
    }

    const incluidosClean = (p.productos_incluidos || []).map(x => x.replace(/^(tn|ml|bd):/, ''));
    const excluidosClean = (p.productos_excluidos || []).map(x => x.replace(/^(tn|ml|bd):/, ''));

    html += `<tr>
      <td data-label="Nombre"><strong>${p.nombre || ''}</strong></td>
      <td data-label="Plataforma">${canalBadge}</td>
      <td data-label="Tipo">${tipoBadge}</td>
      <td data-label="Regalo">${p.regalo || ''}</td>
      <td data-label="Incluidos" style="font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${incluidosClean.join(', ')}">${incluidosClean.join(', ') || '—'}</td>
      <td data-label="Excluidos" style="font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${excluidosClean.join(', ')}">${excluidosClean.join(', ') || '—'}</td>
      <td data-label="Estado">${estadoBadge}</td>
      <td data-label="Acciones" class="acciones">
        <div class="acciones-btns">
          <button class="btn-editar" onclick="abrirModalPromocion('${p.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            Editar
          </button>
          <button class="btn-editar" onclick="togglePromoEstado('${p.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.activa ? '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>' : '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'}</svg>
            ${p.activa ? 'Desactivar' : 'Activar'}
          </button>
          <button class="btn-eliminar" onclick="eliminarPromocion('${p.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Eliminar
          </button>
        </div>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function filtrarPromociones() {
  renderTablaPromociones();
}

async function cargarProductosDisponibles() {
  try {
    // 1. Tiendanube
    const reglasTN = await cargarRecursoAdmin('reglas', '/reglas-etiquetas-tiendanube');
    productosDisponiblesTN = reglasTN.map(r => r.nombre || r.titulo).filter(Boolean);
    productosDisponiblesTN = [...new Set(productosDisponiblesTN)].sort();

    // 2. Mercado Libre
    try {
      let reglasML = reglasMercadoLibreData;
      if (!reglasML || reglasML.length === 0) {
        const resML = await fetch('/api/mercadolibre/reglas');
        reglasML = await resML.json();
        reglasMercadoLibreData = reglasML;
      }

      productosDisponiblesML = (reglasML || []).map(r => r.texto_principal || r.titulo_publicacion).filter(Boolean);
      productosDisponiblesML = [...new Set(productosDisponiblesML)].sort();
    } catch(e) {
      productosDisponiblesML = [];
    }

    populateChecksTN('incluidos');
    populateChecksTN('excluidos');
    populateChecksML('incluidos');
    populateChecksML('excluidos');
  } catch (e) {
    console.error('Error cargando productos disponibles:', e);
  }
}

function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function populateChecksTN(type) {
  const container = document.getElementById(type === 'incluidos' ? 'listaIncluidosTN' : 'listaExcluidosTN');
  if (!container) return;
  container.innerHTML = '';
  if (productosDisponiblesTN.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:var(--muted);">No hay etiquetas de Tiendanube cargadas.</span>';
    return;
  }
  const div = document.createElement('div');
  div.style = 'display:flex; flex-direction:column; gap:4px;';
  productosDisponiblesTN.forEach(nombre => {
    const id = `${type}_tn_${sanitizeId(nombre)}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.dataset.modelo = nombre;
    checkbox.dataset.tipo = type;
    checkbox.dataset.source = 'tn';
    checkbox.style.accentColor = 'var(--accent)';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.style = 'color:var(--text-2); display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px;';
    label.textContent = nombre;
    label.prepend(checkbox);
    div.appendChild(label);
  });
  container.appendChild(div);
}

function populateChecksML(type) {
  const container = document.getElementById(type === 'incluidos' ? 'listaIncluidosML' : 'listaExcluidosML');
  if (!container) return;
  container.innerHTML = '';
  if (productosDisponiblesML.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:var(--muted);">No hay publicaciones de Mercado Libre sincronizadas.</span>';
    return;
  }
  const div = document.createElement('div');
  div.style = 'display:flex; flex-direction:column; gap:4px;';
  productosDisponiblesML.forEach(nombre => {
    const id = `${type}_ml_${sanitizeId(nombre)}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.dataset.modelo = nombre;
    checkbox.dataset.tipo = type;
    checkbox.dataset.source = 'ml';
    checkbox.style.accentColor = '#fbbf24';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.style = 'color:var(--text-2); display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px;';
    label.textContent = nombre;
    label.prepend(checkbox);
    div.appendChild(label);
  });
  container.appendChild(div);
}

function cambiarCanalEnModalPromo() {
  const canal = document.getElementById('campoPromoCanal').value;
  const sgIncTN = document.getElementById('subgroupIncluidosTN');
  const sgIncML = document.getElementById('subgroupIncluidosML');
  const sgExcTN = document.getElementById('subgroupExcluidosTN');
  const sgExcML = document.getElementById('subgroupExcluidosML');

  if (sgIncTN) sgIncTN.style.display = (canal === 'tiendanube' || canal === 'todas') ? 'block' : 'none';
  if (sgIncML) sgIncML.style.display = (canal === 'mercadolibre' || canal === 'todas') ? 'block' : 'none';
  if (sgExcTN) sgExcTN.style.display = (canal === 'tiendanube' || canal === 'todas') ? 'block' : 'none';
  if (sgExcML) sgExcML.style.display = (canal === 'mercadolibre' || canal === 'todas') ? 'block' : 'none';
}

function seleccionarTodosChecks(type, state) {
  const selector = type === 'incluidos' ? '#secIncluidos' : '#secExcluidos';
  const checkboxes = document.querySelectorAll(`${selector} input[data-modelo]`);
  checkboxes.forEach(cb => {
    // Solo seleccionar si su contenedor está visible
    if (cb.closest('.promo-subgroup')?.style.display !== 'none') {
      cb.checked = state;
    }
  });
}

function filtrarChecks(type) {
  const inputId = type === 'incluidos' ? 'buscarIncluido' : 'buscarExcluido';
  const term = document.getElementById(inputId).value.toLowerCase();
  const sec = document.getElementById(type === 'incluidos' ? 'secIncluidos' : 'secExcluidos');
  const labels = sec.querySelectorAll('label');
  labels.forEach(lbl => {
    const txt = lbl.textContent.toLowerCase();
    lbl.style.display = term && !txt.includes(term) ? 'none' : '';
  });
}

function actualizarVisibilidadSeccionesPromo() {
  const tipo = document.getElementById('campoPromoTipo').value;
  const secIncluidos = document.getElementById('secIncluidos');
  const secExcluidos = document.getElementById('secExcluidos');
  const lblIncluidos = document.getElementById('lblIncluidos');
  const subIncluidos = document.getElementById('subIncluidos');
  const lblExcluidos = document.getElementById('lblExcluidos');
  const subExcluidos = document.getElementById('subExcluidos');

  if (tipo === '2x1') {
    secIncluidos.style.display = 'block';
    lblIncluidos.textContent = 'Productos Incluidos (Participan en 2x1):';
    subIncluidos.textContent = '(Marcá los productos que participan en la promoción 2x1)';
    secExcluidos.style.display = 'block';
    lblExcluidos.textContent = 'Productos incluidos regalo (Lleva regalo):';
    subExcluidos.textContent = '(Marcá los productos que llevan regalo al comprarse)';
  } else {
    secIncluidos.style.display = 'none';
    secExcluidos.style.display = 'block';
    lblExcluidos.textContent = 'Productos incluidos regalo (Lleva regalo):';
    subExcluidos.textContent = '(Marcá los productos que llevan regalo al comprarse)';
  }
}

function abrirModalPromocion(id = null) {
  document.getElementById('promoId').value = '';
  document.getElementById('campoPromoNombre').value = '';
  document.getElementById('campoPromoCanal').value = 'tiendanube';
  document.getElementById('campoPromoTipo').value = '2x1';
  document.getElementById('campoPromoRegalo').value = '';
  document.getElementById('campoPromoActiva').checked = true;
  document.querySelectorAll('#secIncluidos input[data-modelo], #secExcluidos input[data-modelo]').forEach(cb => cb.checked = false);

  if (id !== null) {
    const promo = promocionesData.find(p => String(p.id) === String(id));
    if (promo) {
      document.getElementById('promoId').value = promo.id;
      document.getElementById('campoPromoNombre').value = promo.nombre || '';
      document.getElementById('campoPromoCanal').value = promo.canal || 'tiendanube';
      document.getElementById('campoPromoTipo').value = promo.tipo || '2x1';
      document.getElementById('campoPromoRegalo').value = promo.regalo || '';
      document.getElementById('campoPromoActiva').checked = !!promo.activa;
      
      const incList = (promo.productos_incluidos || []).map(x => String(x));
      const excList = (promo.productos_excluidos || []).map(x => String(x));
      
      const incBD = new Set(); const incTN = new Set(); const incML = new Set();
      incList.forEach(x => {
        if (x.startsWith('tn:')) incTN.add(x.slice(3));
        else if (x.startsWith('ml:')) incML.add(x.slice(3));
        else if (x.startsWith('bd:')) incBD.add(x.slice(3));
        else { incBD.add(x); incTN.add(x); incML.add(x); }
      });
      const excBD = new Set(); const excTN = new Set(); const excML = new Set();
      excList.forEach(x => {
        if (x.startsWith('tn:')) excTN.add(x.slice(3));
        else if (x.startsWith('ml:')) excML.add(x.slice(3));
        else if (x.startsWith('bd:')) excBD.add(x.slice(3));
        else { excBD.add(x); excTN.add(x); excML.add(x); }
      });
      
      document.querySelectorAll('#secIncluidos input[data-modelo]').forEach(cb => {
        const src = cb.dataset.source;
        const set = src === 'ml' ? incML : (src === 'tn' ? incTN : incBD);
        if (set.has(cb.dataset.modelo)) cb.checked = true;
      });
      document.querySelectorAll('#secExcluidos input[data-modelo]').forEach(cb => {
        const src = cb.dataset.source;
        const set = src === 'ml' ? excML : (src === 'tn' ? excTN : excBD);
        if (set.has(cb.dataset.modelo)) cb.checked = true;
      });
    }
  }
  cambiarCanalEnModalPromo();
  actualizarVisibilidadSeccionesPromo();
  document.getElementById('modalPromoTitulo').innerText = id ? 'Editar Promoción' : 'Nueva Promoción';
  document.getElementById('modalPromocion').style.display = 'flex';
}

function cerrarModalPromocion() {
  document.getElementById('modalPromocion').style.display = 'none';
}

// ── Historial de Stock 2x1 ──────────────────────────────────────────────────
let historialStockData = [];

async function abrirModalHistorialStock() {
  document.getElementById('modalHistorialStock').style.display = 'flex';
  await cargarHistorialStock();
}

function cerrarModalHistorialStock() {
  document.getElementById('modalHistorialStock').style.display = 'none';
}

async function cargarHistorialStock() {
  const tbody = document.getElementById('tbodyHistorialStock');
  const countEl = document.getElementById('stockAjustesCount');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--muted,#8eabc2);">Cargando registros...</td></tr>';
  
  try {
    const resp = await fetch('/api/promociones/stock/ajustes?limit=100');
    if (!resp.ok) throw new Error('Error al cargar historial');
    const data = await resp.json();
    historialStockData = data.ajustes || [];
    renderTablaHistorialStock(historialStockData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--red,#ef4444);">No se pudo cargar el historial: ${err.message}</td></tr>`;
    countEl.textContent = 'Error al consultar';
  }
}

function renderTablaHistorialStock(lista) {
  const tbody = document.getElementById('tbodyHistorialStock');
  const countEl = document.getElementById('stockAjustesCount');
  countEl.textContent = `${lista.length} ajuste(s) registrado(s)`;

  if (!lista || lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--muted,#8eabc2);">No hay ajustes de stock 2x1 registrados aún.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(item => {
    const stockCambio = (item.stock_anterior !== null && item.stock_nuevo !== null)
      ? `<span style="font-weight:700; color:var(--text,#f4f9ff);">${item.stock_anterior}</span> <span style="color:var(--muted); font-size:11px;">&rarr;</span> <span style="font-weight:700; color:var(--accent,#2f80ed);">${item.stock_nuevo}</span> <span style="font-size:11px; color:var(--green,#39d98a); font-weight:700;">(-${item.cantidad || 1}u)</span>`
      : `<span style="color:var(--muted,#8eabc2); font-size:12px;">Infinito / No gestionado</span>`;

    const estadoBadge = item.estado === 'exitoso'
      ? `<span style="background:rgba(57,217,138,0.14); color:var(--green,#39d98a); border:1px solid rgba(57,217,138,0.3); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:700;">Exitoso</span>`
      : (item.estado === 'sin_stock_gestionado'
        ? `<span style="background:rgba(245,158,11,0.14); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:700;">Stock Infinito</span>`
        : `<span style="background:rgba(239,68,68,0.14); color:#f87171; border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:700;">Fallido</span>`);

    return `
      <tr style="border-bottom:1px solid var(--border); transition:background 0.15s ease;">
        <td style="padding:10px 12px; white-space:nowrap; color:var(--muted,#8eabc2); font-size:12px;">${item.created_at || '-'}</td>
        <td style="padding:10px 12px; white-space:nowrap;">
          <span style="background:var(--surface-2,#173452); border:1px solid var(--border); padding:3px 7px; border-radius:6px; font-weight:700; color:var(--accent2,#8bd3ff);">#${item.order_number}</span>
        </td>
        <td style="padding:10px 12px; font-weight:600; color:var(--text,#f4f9ff); max-width:220px; word-break:break-word;">
          ${item.producto_nombre || 'Producto'}
        </td>
        <td style="padding:10px 12px; text-align:center; white-space:nowrap;">${stockCambio}</td>
        <td style="padding:10px 12px; color:var(--text-2,#c8dced); font-size:12px; line-height:1.4;">${item.motivo || '-'}</td>
        <td style="padding:10px 12px; text-align:center; white-space:nowrap;">${estadoBadge}</td>
      </tr>
    `;
  }).join('');
}

function filtrarHistorialStock() {
  const q = (document.getElementById('buscarAjusteStock')?.value || '').toLowerCase().trim();
  if (!q) {
    renderTablaHistorialStock(historialStockData);
    return;
  }
  const filtrados = historialStockData.filter(item => 
    (item.order_number || '').toLowerCase().includes(q) ||
    (item.producto_nombre || '').toLowerCase().includes(q) ||
    (item.motivo || '').toLowerCase().includes(q)
  );
  renderTablaHistorialStock(filtrados);
}

async function guardarPromocion() {
  const id = document.getElementById('promoId').value;
  const nombre = document.getElementById('campoPromoNombre').value.trim();
  const canal = document.getElementById('campoPromoCanal').value;
  const tipo = document.getElementById('campoPromoTipo').value;
  const regalo = document.getElementById('campoPromoRegalo').value.trim();
  const activa = document.getElementById('campoPromoActiva').checked;

  const incluidosRaw = Array.from(document.querySelectorAll('#secIncluidos input[data-modelo]:checked')).map(cb => {
    const prefix = cb.dataset.source === 'ml' ? 'ml:' : (cb.dataset.source === 'tn' ? 'tn:' : 'bd:');
    return prefix + cb.dataset.modelo;
  });
  const incluidos = [...new Set(incluidosRaw)];
  const excluidosRaw = Array.from(document.querySelectorAll('#secExcluidos input[data-modelo]:checked')).map(cb => {
    const prefix = cb.dataset.source === 'ml' ? 'ml:' : (cb.dataset.source === 'tn' ? 'tn:' : 'bd:');
    return prefix + cb.dataset.modelo;
  });
  const excluidos = [...new Set(excluidosRaw)];

  if (!nombre) { toast('Nombre requerido'); return; }

  const payload = { nombre, canal, tipo, regalo, productos_incluidos: incluidos, productos_excluidos: excluidos, activa };

  try {
    const resp = await fetch(id ? `/promociones/${id}` : '/promociones', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      toast('Promoción guardada');
      cerrarModalPromocion();
      invalidarCacheAdmin('promociones');
      await cargarPromociones();
    } else {
      const err = await resp.json();
      toast((err.error || 'Error al guardar'));
    }
  } catch (e) {
    toast(e.message);
  }
}

async function togglePromoEstado(id) {
  try {
    const resp = await fetch(`/promociones/${id}/toggle`, { method: 'POST' });
    if (resp.ok) { invalidarCacheAdmin('promociones'); await cargarPromociones(); } else toast('Error toggle');
  } catch (e) {
    toast(e.message);
  }
}

async function eliminarPromocion(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  try {
    const resp = await fetch(`/promociones/${id}`, { method: 'DELETE' });
    if (resp.ok) {
      toast('Promoción eliminada');
      invalidarCacheAdmin('promociones');
      await cargarPromociones();
    } else {
      toast('Error al eliminar');
    }
  } catch (e) {
    toast(e.message);
  }
}

const THEME_STORAGE_KEY = 'despax-theme';
function aplicarTema(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

const temaGuardado = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
aplicarTema(temaGuardado);

// currentUserData

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
    if (typeof cerrarModalPromocion === 'function') cerrarModalPromocion();
    if (typeof cerrarModalHistorialStock === 'function') cerrarModalHistorialStock();
    if (typeof cerrarModalProducto === 'function') cerrarModalProducto();
    if (typeof cerrarModalPistolaStock === 'function') cerrarModalPistolaStock();
    if (typeof cerrarModalEditarStock === 'function') cerrarModalEditarStock();
    if (typeof cerrarModalGeneradorManual === 'function') cerrarModalGeneradorManual();
    if (typeof cerrarModalPreviewBarcode === 'function') cerrarModalPreviewBarcode();
  }
});

function aplicarDatosUsuario(user, subscription) {
  if (!user) return;
  currentUserData = user;
  const dropdown = document.getElementById('userMenuDropdown');
  const avatar = document.getElementById('userAvatar');
  const name = document.getElementById('userName');
  
  const popoverAvatar = document.getElementById('userPopoverAvatar');
  const popoverName = document.getElementById('userPopoverName');
  const popoverEmail = document.getElementById('userPopoverEmail');
  const initial = (user.nombre || user.username).charAt(0).toUpperCase();
  const displayName = user.nombre || user.username;

  if (dropdown) dropdown.style.display = 'inline-block';
  if (avatar) avatar.textContent = initial;
  if (name) name.textContent = displayName;

  if (popoverAvatar) popoverAvatar.textContent = initial;
  if (popoverName) popoverName.textContent = displayName;
  if (popoverEmail) popoverEmail.textContent = user.email || 'usuario@local';

  renderSubscriptionUI(user, subscription);
}

async function verificarSesionUsuario(force = false) {
  if (!force && currentUserData) {
    return;
  }
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    if (data.authenticated && data.user) {
      aplicarDatosUsuario(data.user, data.subscription);
    }
  } catch (e) {
    console.error('Error verificando sesión:', e);
  }
}

// currentSubscriptionData

function renderSubscriptionUI(user, subscription) {
  currentSubscriptionData = subscription || {};
  const badgeEl = document.getElementById('userPopoverSubBadge');
  const bannerEl = document.getElementById('gracePeriodBanner');
  const bannerTitle = document.getElementById('graceBannerTitle');
  const bannerMsg = document.getElementById('graceBannerMsg');

  const status = subscription?.status || user?.subscription_status || 'trial';
  const isBlocked = !!(subscription?.is_blocked || user?.is_blocked);
  const badgeText = subscription?.badge_text || user?.badge_text || 'Prueba';
  const badgeColor = subscription?.badge_color || user?.badge_color || 'trial';

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

  // Si está en período de gracia
  const precioTxt = subscription?.price_formatted || (user?.price_ars ? `$${Number(user.price_ars).toLocaleString('es-AR')} ARS` : '');
  const precioAviso = precioTxt ? ` (${precioTxt})` : '';
  const precioAbonar = precioTxt ? ` ${precioTxt}` : ' tu abono';

  if (status === 'grace') {
    if (bannerEl) {
      const dias = user?.grace_days_left ?? subscription?.grace_days_left ?? 4;
      if (bannerTitle) bannerTitle.textContent = `Período de Gracia: Quedan ${dias} día${dias === 1 ? '' : 's'}`;
      if (bannerMsg) bannerMsg.textContent = `Tu prueba gratis ha concluido. Aboná${precioAbonar} antes de ${dias} día${dias === 1 ? '' : 's'} para evitar la interrupción de tus servicios.`;
      bannerEl.style.display = 'flex';
    }
  } else if ((status === 'trial' || status === 'pro_trial') && user?.trial_days_left !== null && user?.trial_days_left !== undefined && user?.trial_days_left <= 2) {
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

async function handleLogout() {
  try {
    limpiarTodaLaCacheAdmin();
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login';
  }
}

// La gestión completa de Códigos de Barra y SKUs se encuentra centralizada en /codigos_barra.html
function cargarCodigosBarra() {
  window.location.href = '/codigos_barra.html';
}

verificarSesionUsuario();
cargarProductosDisponibles();

// Notificaciones si venimos de la autorización OAuth de Mercado Libre
const paramsML = new URLSearchParams(window.location.search);
if (paramsML.get('mercadolibre_connected')) {
  setTimeout(() => toast('¡Cuenta de Mercado Libre conectada con éxito!'), 400);
}
if (paramsML.get('mercadolibre_error')) {
  setTimeout(() => toast('Error de Mercado Libre: ' + paramsML.get('mercadolibre_error')), 400);
}

let currentPendingNotif = null;

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
  if (document.hidden) { return; }
  try {
    const res = await fetch('/api/tiendanube/notificaciones-pendientes');
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.notificaciones && data.notificaciones.length > 0) {
      // Filtrar notificaciones que ya fueron descartadas en esta sesión
      const pendientes = data.notificaciones.filter(n => !estaNotificacionDescartadaLocal(n));
      
      // Si el backend devolvió notificaciones que el usuario ya cerró en esta sesión, sincronizar el descarte en servidor
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
      row.innerHTML = `<span><strong>${escapeHtmlAttr(v.variante || 'Único')}</strong></span> <code style="font-family:monospace; color:var(--signal-strong,#0284c7);">${v.barcode || ''}</code>`;
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
      const prodNom = notif.producto_nombre;
      cerrarModalNuevoProductoTN();
      abrirModalPromoParaProducto(prodNom);
    };
  }

  if (btnCat) {
    btnCat.onclick = () => {
      const prodNom = notif.producto_nombre;
      cerrarModalNuevoProductoTN();
      enfocarProductoEnCatalogo(prodNom);
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

function abrirModalPromoParaProducto(nombreProd) {
  if (typeof mostrarTab === 'function') {
    mostrarTab('promociones');
    setTimeout(() => {
      if (typeof abrirModalNuevaPromocion === 'function') {
        abrirModalNuevaPromocion();
        const inputNombre = document.getElementById('promoNombre');
        if (inputNombre) inputNombre.value = `Promo ${nombreProd}`;
      }
    }, 250);
  } else {
    window.location.href = `/admin_productos.html?tab=promociones&nuevo_prod=${encodeURIComponent(nombreProd)}`;
  }
}

function enfocarProductoEnCatalogo(nombreProd) {
  window.location.href = `/codigos_barra.html?buscar=${encodeURIComponent(nombreProd)}`;
}

// Iniciar verificación al cargar y periódicamente
document.addEventListener('DOMContentLoaded', () => {
  const modalOverlay = document.getElementById('modalNuevoProductoTN');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        cerrarModalNuevoProductoTN();
      }
    });
  }

  // Scroll-lock automático en body cuando cualquier modal esté abierto
  function checkAdminModalScrollLock() {
    const overlays = document.querySelectorAll(
      '.catalog-overlay, .modal-blocked-overlay, #modalPromocion, #modalHistorialStock, #modalNuevoProductoTN, #accountBlockedModal'
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

  const modalObserver = new MutationObserver(() => checkAdminModalScrollLock());
  document.querySelectorAll('.catalog-overlay, .modal-blocked-overlay, #modalPromocion, #modalHistorialStock, #modalNuevoProductoTN, #accountBlockedModal').forEach(m => {
    modalObserver.observe(m, { attributes: true, attributeFilter: ['style', 'class'] });
  });

  setTimeout(verificarNotificacionesTiendanube, 1500);
  setInterval(verificarNotificacionesTiendanube, 45000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      verificarNotificacionesTiendanube();
    }
  });
});