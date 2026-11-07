// ── Estado Global ───────────────────────────────────────────────────────────
    let codigosBarraData = [];
    let codigosBarraFiltrados = [];
    let selectedBarcodeIds = new Set();
    let currentBarcodeView = 'table';
    let currentPage = 1;
    let itemsPerPage = 50;
    let previewItemActual = null;
    let currentUserData = null;

    // Escáner de Depósito
    let scannerModoActual = 'restar'; // 'restar' (-1) o 'sumar' (+1)
    let scannerCantidadActual = 1;
    let scannerHistorial = [];

    // ── Menú de Usuario y Sesión Despax ─────────────────────────────────────────
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
        if (typeof cerrarModalEditarStock === 'function') cerrarModalEditarStock();
        if (typeof cerrarModalGeneradorManual === 'function') cerrarModalGeneradorManual();
        if (typeof cerrarModalPreviewBarcode === 'function') cerrarModalPreviewBarcode();
      }
    });

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
          const initial = (data.user.nombre || data.user.username || 'U').charAt(0).toUpperCase();
          const displayName = data.user.nombre || data.user.username || 'Usuario';

          if (dropdown) dropdown.style.display = 'inline-block';
          if (avatar) avatar.textContent = initial;
          if (name) name.textContent = displayName;

          if (popoverAvatar) popoverAvatar.textContent = initial;
          if (popoverName) popoverName.textContent = displayName;
          if (popoverEmail) popoverEmail.textContent = data.user.email || 'usuario@despax';

          renderSubscriptionUI(data.user, data.subscription);
        }
      } catch (e) {
        console.error('Error verificando sesión:', e);
      }
    }

    function renderSubscriptionUI(user, subscription) {
      const badgeEl = document.getElementById('userPopoverSubBadge');
      const badgeText = subscription?.badge_text || user?.badge_text || 'Prueba';
      const badgeColor = subscription?.badge_color || user?.badge_color || 'trial';

      if (badgeEl) {
        badgeEl.textContent = badgeText;
        badgeEl.className = `sub-status-badge ${badgeColor}`;
        badgeEl.style.display = 'inline-flex';
      }
    }

    async function handleLogout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } finally {
        window.location.href = '/login';
      }
    }

    function toast(mensaje, tiempo = 3500) {
      const t = document.getElementById('toastBox');
      if (!t) return;
      t.textContent = mensaje;
      t.style.display = 'flex';
      clearTimeout(window._toastTimeout);
      window._toastTimeout = setTimeout(() => {
        t.style.display = 'none';
      }, tiempo);
    }

    // ── Audio Feedback Sintetizado (Web Audio API) ───────────────────────────────
    function beepScanner(exito = true) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (exito) {
          // Bip agudo nítido de terminal de escaneo (1450Hz, 70ms)
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1450, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
        } else {
          // Doble tono grave de alerta (240Hz -> 180Hz)
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.setValueAtTime(180, now + 0.1);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.23);
        }
      } catch (_) {}
    }

    // ── Controlador del Escáner de Depósito ─────────────────────────────────────
    function setScannerMode(modo) {
      scannerModoActual = modo;
      document.getElementById('btnModeRestar')?.classList.toggle('active', modo === 'restar');
      document.getElementById('btnModeSumar')?.classList.toggle('active', modo === 'sumar');
      refocarScannerInput();
    }

    function setScannerStep(cant) {
      scannerCantidadActual = cant;
      [1, 2, 5, 10].forEach(c => {
        document.getElementById(`btnStep${c}`)?.classList.toggle('active', c === cant);
      });
      refocarScannerInput();
    }

    function refocarScannerInput() {
      const inp = document.getElementById('scannerInput');
      if (inp && typeof inp.focus === 'function') {
        inp.focus();
        if (typeof inp.select === 'function') inp.select();
      }
    }

    function limpiarHistorialScanner() {
      scannerHistorial = [];
      renderScannerHistorial();
      refocarScannerInput();
    }

    function renderScannerHistorial() {
      const list = document.getElementById('scannerHistoryList');
      if (!list) return;
      if (!scannerHistorial.length) {
        list.innerHTML = '<div style="font-size:12px; color:var(--muted); text-align:center; padding:10px;">Aún no se realizaron lecturas en esta sesión.</div>';
        return;
      }
      list.innerHTML = '';
      scannerHistorial.slice(0, 30).forEach(h => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const isSumar = h.delta > 0;
        const deltaColor = isSumar ? '#34d399' : '#f87171';
        const deltaTxt = isSumar ? `+${h.delta}` : `${h.delta}`;
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--muted);">${h.hora}</span>
            <strong style="color:var(--text);">${escapeHtml(h.modelo)} · ${escapeHtml(h.variante)}</strong>
            <span class="pill-category">${h.barcode}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:800; color:${deltaColor};">${deltaTxt} u</span>
            <span style="font-size:12px; color:var(--text-2);">(${h.stock_anterior} -> <b>${h.stock_nuevo}</b>)</span>
            ${h.tn_sincronizado ? '<span style="color:#10b981; font-weight:700; font-size:11px;">TN sincronizado</span>' : ''}
          </div>
        `;
        list.appendChild(item);
      });
    }

    async function procesarDisparoScanner(e) {
      if (e) e.preventDefault();
      const inp = document.getElementById('scannerInput');
      if (!inp) return;
      const codigo = inp.value.trim();
      if (!codigo) return;

      const delta = (scannerModoActual === 'sumar') ? scannerCantidadActual : -scannerCantidadActual;
      const syncTN = document.getElementById('chkScannerSyncTN')?.checked ?? true;

      inp.value = '';

      try {
        const res = await fetch('/api/codigos-barra/pistola-ajuste-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: codigo,
            delta: delta,
            sincronizar_tiendanube: syncTN
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          beepScanner(false);
          throw new Error(data.error || 'Código no reconocido');
        }

        beepScanner(true);

        // Feedback Card
        const card = document.getElementById('scannerFeedbackCard');
        const fNombre = document.getElementById('feedbackProdName');
        const fVar = document.getElementById('feedbackProdVar');
        const fCode = document.getElementById('feedbackProdCode');
        const fBadge = document.getElementById('feedbackStockBadge');
        const fDelta = document.getElementById('feedbackDeltaText');
        const fAntes = document.getElementById('feedbackStockAntes');
        const fNuevo = document.getElementById('feedbackStockNuevo');
        const fTN = document.getElementById('feedbackTNStatus');

        if (card) card.style.display = 'block';
        if (fNombre) fNombre.textContent = `${data.categoria} · ${data.modelo}`;
        if (fVar) fVar.textContent = `${data.variante} (SKU: ${data.sku || data.barcode})`;
        if (fCode) fCode.textContent = data.segmentado || data.barcode;
        if (fAntes) fAntes.textContent = data.stock_anterior;
        if (fNuevo) fNuevo.textContent = data.stock_nuevo;

        const isSumar = data.delta > 0;
        if (fBadge) {
          fBadge.className = `stock-transition-badge ${isSumar ? 'sumar' : 'restar'}`;
        }
        if (fDelta) {
          fDelta.textContent = isSumar ? `+${data.delta} u Añadido` : `${data.delta} u Descontado`;
        }

        if (fTN) {
          if (data.tn_sincronizado) {
            fTN.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span>Tiendanube sincronizado</span>';
            fTN.style.color = '#34d399';
          } else if (data.tn_error) {
            fTN.innerHTML = `<span>Aviso TN: ${data.tn_error}</span>`;
            fTN.style.color = '#f59e0b';
          } else {
            fTN.innerHTML = '<span>Actualizado localmente</span>';
            fTN.style.color = 'var(--muted)';
          }
        }

        // Historial
        const horaStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        scannerHistorial.unshift({
          hora: horaStr,
          modelo: data.modelo,
          variante: data.variante,
          barcode: data.segmentado || data.barcode,
          delta: data.delta,
          stock_anterior: data.stock_anterior,
          stock_nuevo: data.stock_nuevo,
          tn_sincronizado: data.tn_sincronizado
        });
        renderScannerHistorial();

        // Actualizar datos en memoria sin recarga completa
        const itemLocal = codigosBarraData.find(x => String(x.id) === String(data.item_id));
        if (itemLocal) {
          itemLocal.stock = data.stock_nuevo;
          filtrarCodigosBarra();
        } else {
          await cargarCodigosBarra(true);
        }

      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        refocarScannerInput();
      }
    }

    // ── Sistema de Caché Atómica Versionada (0 ms en recargas de página) ──────────
    const ADMIN_CACHE_PREFIX = 'despax-admin-cache:';
    let adminVersions = null;

    async function obtenerVersionesAdmin() {
      if (adminVersions) return adminVersions;
      const respuesta = await fetch('/admin-version', { cache: 'no-store' });
      if (!respuesta.ok) throw new Error('No se pudo comprobar la versión del catálogo');
      adminVersions = await respuesta.json();
      return adminVersions;
    }

    function invalidarCacheLocalCodigos() {
      adminVersions = null;
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith(ADMIN_CACHE_PREFIX) && k.endsWith(':codigos_barra')) {
            localStorage.removeItem(k);
          }
        });
      } catch (_) {}
    }

    function obtenerCacheLocalCodigos(uid) {
      try {
        const clave = `${ADMIN_CACHE_PREFIX}u${uid}:codigos_barra`;
        const raw = localStorage.getItem(clave);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function guardarCacheLocalCodigos(uid, boot, version, data) {
      try {
        const clave = `${ADMIN_CACHE_PREFIX}u${uid}:codigos_barra`;
        localStorage.setItem(clave, JSON.stringify({
          user_id: uid,
          boot: boot,
          version: version,
          data: data
        }));
      } catch (e) {
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith(ADMIN_CACHE_PREFIX)) localStorage.removeItem(k);
          });
        } catch (_) {}
      }
    }

    // ── Carga y Renderizado Ultra-Rápido del Catálogo (Stale-While-Revalidate 0ms) ──
    async function cargarCodigosBarra(forzarRefresco = false) {
      const tbody = document.getElementById('tbodyCodigosBarra');

      // 1. Pintado instantáneo (0 ms) desde localStorage al abrir la página
      const uidEstimado = (currentUserData && currentUserData.id) ? currentUserData.id : 1;
      let cacheLocal = obtenerCacheLocalCodigos(uidEstimado);
      if (!cacheLocal) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(ADMIN_CACHE_PREFIX) && k.endsWith(':codigos_barra')) {
            try { cacheLocal = JSON.parse(localStorage.getItem(k)); break; } catch (_) {}
          }
        }
      }

      let yaPintadoDesdeCache = false;
      if (cacheLocal && cacheLocal.data && cacheLocal.data.items && cacheLocal.data.items.length > 0) {
        codigosBarraData = cacheLocal.data.items || [];
        actualizarStatsCatalogo(cacheLocal.data.stats);
        poblarSelectCategorias(cacheLocal.data.items);
        filtrarCodigosBarra();
        yaPintadoDesdeCache = true;
      }

      if (!yaPintadoDesdeCache && (!codigosBarraData || codigosBarraData.length === 0)) {
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--muted); font-size:13px;">Cargando catálogo...</td></tr>`;
        }
      }

      // 2. Traer datos frescos directamente en 1 sola llamada rápida con ETag condicional
      try {
        const headers = {};
        if (!forzarRefresco && cacheLocal && cacheLocal.boot && cacheLocal.version !== undefined) {
          headers['If-None-Match'] = `W/"cb_${cacheLocal.boot}_${cacheLocal.version}"`;
        }

        const res = await fetch('/api/codigos-barra', {
          headers: headers,
          cache: 'no-store'
        });

        if (res.status === 304 && cacheLocal && cacheLocal.data) {
          return; // Datos 100% frescos, no requiere redibujado
        }

        if (!res.ok) throw new Error('Error de conexión');
        const data = await res.json();
        codigosBarraData = data.items || [];
        
        // Extraer versión de ETag si está disponible
        const etag = res.headers.get('ETag') || '';
        const match = etag.match(/W\/"cb_(\d+)_(\d+)"/);
        const bootActual = match ? match[1] : (cacheLocal ? cacheLocal.boot : 1);
        const versionActual = match ? parseInt(match[2], 10) : ((cacheLocal ? cacheLocal.version : 0) + 1);
        guardarCacheLocalCodigos(uidEstimado, bootActual, versionActual, data);

        actualizarStatsCatalogo(data.stats);
        poblarSelectCategorias(data.items);
        filtrarCodigosBarra();
        consultarBadgeSugerencias();

      } catch (err) {
        console.error('Error en sincronización de códigos de barra:', err);
        if (!yaPintadoDesdeCache && tbody) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:#f87171; font-size:13px;">Error cargando catálogo: ${escapeHtml(err.message)}</td></tr>`;
        }
      }
    }

    function actualizarStatsCatalogo(stats) {
      if (!stats) return;
      document.getElementById('statTotal').textContent = stats.total || 0;
      document.getElementById('statCategorias').textContent = stats.categorias || 0;
      document.getElementById('statModelos').textContent = stats.modelos || 0;
      document.getElementById('statSincronizados').textContent = stats.sincronizados || 0;
      document.getElementById('statPendientes').textContent = stats.pendientes || 0;

      document.getElementById('chipCountTodos').textContent = stats.total || 0;
      document.getElementById('chipCountPendientes').textContent = stats.pendientes || 0;
      document.getElementById('chipCountSincronizados').textContent = stats.sincronizados || 0;
    }

    function poblarSelectCategorias(items) {
      const select = document.getElementById('filtroCategoriaBarcode');
      if (!select) return;
      const actual = select.value;
      const cats = Array.from(new Set(items.map(x => x.categoria).filter(Boolean))).sort();
      select.innerHTML = '<option value="">Todas las categorías</option>';
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (c === actual) opt.selected = true;
        select.appendChild(opt);
      });
    }

    function setBarcodeView(vista) {
      currentBarcodeView = vista;
      document.getElementById('btnViewTable')?.classList.toggle('active', vista === 'table');
      document.getElementById('btnViewGrid')?.classList.toggle('active', vista === 'grid');
      document.getElementById('barcodeTableView').style.display = (vista === 'table') ? 'block' : 'none';
      document.getElementById('barcodeGridView').style.display = (vista === 'grid') ? 'grid' : 'none';
      renderCodigosBarraActuales();
    }

    function onSelectOrigenChange(val) {
      document.getElementById('chipFilterTodos')?.classList.toggle('active', val === 'todos');
      document.getElementById('chipFilterPendientes')?.classList.toggle('active', val === 'pendientes_tn');
      document.getElementById('chipFilterSincronizados')?.classList.toggle('active', val === 'sincronizados_tn');
      filtrarCodigosBarra();
    }

    function setQuickFilterBarcode(tipo) {
      const sel = document.getElementById('filtroOrigenBarcode');
      if (sel) sel.value = tipo;
      onSelectOrigenChange(tipo);
    }

    function filtrarCodigosBarra() {
      const query = (document.getElementById('buscarCodigoBarra')?.value || '').toLowerCase().trim();
      const cat = document.getElementById('filtroCategoriaBarcode')?.value || '';
      const origen = document.getElementById('filtroOrigenBarcode')?.value || 'todos';

      codigosBarraFiltrados = codigosBarraData.filter(item => {
        if (cat && item.categoria !== cat) return false;

        if (origen === 'tiendanube' && item.origen !== 'tiendanube') return false;
        if (origen === 'manual' && item.origen !== 'manual') return false;
        if (origen === 'pendientes_tn' && item.sincronizado_tn) return false;
        if (origen === 'sincronizados_tn' && !item.sincronizado_tn) return false;

        if (query) {
          const matchCode = (item.barcode || '').includes(query);
          const matchMod = (item.modelo || '').toLowerCase().includes(query);
          const matchVar = (item.variante || '').toLowerCase().includes(query);
          const matchCat = (item.categoria || '').toLowerCase().includes(query);
          const matchSku = (item.sku || '').toLowerCase().includes(query);
          if (!matchCode && !matchMod && !matchVar && !matchCat && !matchSku) return false;
        }

        return true;
      });

      const notice = document.getElementById('barcodeCountNotice');
      if (notice) notice.textContent = `Mostrando ${codigosBarraFiltrados.length} de ${codigosBarraData.length}`;

      currentPage = 1;
      renderCodigosBarraActuales();
    }

    function restablecerFiltrosBarcodes() {
      const q = document.getElementById('buscarCodigoBarra');
      if (q) q.value = '';
      const cat = document.getElementById('filtroCategoriaBarcode');
      if (cat) cat.value = '';
      setQuickFilterBarcode('todos');
    }

    // Atajos de teclado para agilizar trabajo diario
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        const input = document.getElementById('buscarCodigoBarra');
        if (input) {
          input.focus();
          input.select();
        }
      }
      if (e.key === 'Escape') {
        // Cerrar modales si están abiertos
        cerrarModalGeneradorManual();
        cerrarModalPreviewBarcode();
        cerrarModalEditarStock();
        cerrarModalSugerenciasStock();
        cerrarModalVincularStock();
      }
    });

    function renderCodigosBarraActuales() {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedItems = codigosBarraFiltrados.slice(startIndex, endIndex);

      if (currentBarcodeView === 'table') {
        renderTablaCodigosBarra(paginatedItems);
      } else {
        renderGridCodigosBarra(paginatedItems);
      }
      
      renderPaginationControls();
    }

    function changePage(newPage) {
      const totalPages = Math.ceil(codigosBarraFiltrados.length / itemsPerPage);
      if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderCodigosBarraActuales();
        // Opcional: hacer scroll hacia arriba de la tabla si hay muchos elementos
        const tableContainer = document.getElementById('barcodeTableView');
        if (tableContainer) tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function renderPaginationControls() {
      const container = document.getElementById('barcodePagination');
      if (!container) return;
      container.innerHTML = '';

      const totalPages = Math.ceil(codigosBarraFiltrados.length / itemsPerPage);
      if (totalPages <= 1) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'flex';

      // ← Anterior
      const btnPrev = document.createElement('button');
      btnPrev.className = 'pagination-btn';
      btnPrev.innerHTML = '← Anterior';
      btnPrev.disabled = currentPage === 1;
      btnPrev.onclick = () => changePage(currentPage - 1);
      container.appendChild(btnPrev);

      let startPage = Math.max(1, currentPage - 2);
      let endPage   = Math.min(totalPages, currentPage + 2);

      if (startPage > 1) {
        const btnFirst = document.createElement('button');
        btnFirst.className = 'pagination-btn';
        btnFirst.textContent = '1';
        btnFirst.onclick = () => changePage(1);
        container.appendChild(btnFirst);
        if (startPage > 2) {
          const ellipsis = document.createElement('span');
          ellipsis.className = 'pagination-ellipsis';
          ellipsis.textContent = '···';
          container.appendChild(ellipsis);
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        const btnPage = document.createElement('button');
        btnPage.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
        btnPage.textContent = i;
        btnPage.onclick = () => changePage(i);
        container.appendChild(btnPage);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          const ellipsis = document.createElement('span');
          ellipsis.className = 'pagination-ellipsis';
          ellipsis.textContent = '···';
          container.appendChild(ellipsis);
        }
        const btnLast = document.createElement('button');
        btnLast.className = 'pagination-btn';
        btnLast.textContent = totalPages;
        btnLast.onclick = () => changePage(totalPages);
        container.appendChild(btnLast);
      }

      // Siguiente →
      const btnNext = document.createElement('button');
      btnNext.className = 'pagination-btn';
      btnNext.innerHTML = 'Siguiente →';
      btnNext.disabled = currentPage === totalPages;
      btnNext.onclick = () => changePage(currentPage + 1);
      container.appendChild(btnNext);

      // Info label
      const startItem = (currentPage - 1) * itemsPerPage + 1;
      const endItem   = Math.min(currentPage * itemsPerPage, codigosBarraFiltrados.length);
      const info = document.createElement('span');
      info.className = 'pagination-info';
      info.textContent = `${startItem}–${endItem} de ${codigosBarraFiltrados.length}`;
      container.appendChild(info);
    }

    function renderTablaCodigosBarra(items) {
      const tbody = document.getElementById('tbodyCodigosBarra');
      if (!tbody) return;
      if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:48px 16px; color:var(--muted);">
          <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.6;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span style="font-weight:600; color:var(--text); font-size:14px;">No se encontraron productos para esta búsqueda o filtro</span>
            <button type="button" class="btn-bulk" onclick="restablecerFiltrosBarcodes()" style="margin-top:6px;">Restablecer filtros y ver todos</button>
          </div>
        </td></tr>`;
        return;
      }
      tbody.innerHTML = '';
      items.forEach(item => {
        const tr = document.createElement('tr');
        const isSel = selectedBarcodeIds.has(String(item.id));
        if (isSel) tr.classList.add('is-selected');

        let statusHtml = '';
        if (item.origen === 'tiendanube') {
          statusHtml = item.sincronizado_tn
            ? '<span class="pill-status synced"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Sincronizado</span>'
            : '<span class="pill-status pending"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pendiente subida</span>';
        } else {
          statusHtml = '<span class="pill-status manual">Manual</span>';
        }

        const stockHtml = (item.stock !== null && item.stock !== undefined)
          ? `<span class="barcode-stock-badge" onclick="abrirModalEditarStock('${item.id}')" title="Clic para ajustar stock">Stock: <b>${item.stock}</b> <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></span>`
          : '-';

        tr.innerHTML = `
          <td data-label="Seleccionar" style="text-align:center;">
            <input type="checkbox" id="chk_item_tb_${item.id}" name="chk_item_tb_${item.id}" class="chk-item" value="${item.id}" ${isSel ? 'checked' : ''} onchange="onToggleItemSelection(this, '${item.id}')">
          </td>
          <td data-label="Código 9D">
            <span class="barcode-code-mono" onclick="copiarTextoBarcode('${item.barcode}', this)" title="Clic para copiar">
              ${item.segmentado}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </span>
          </td>
          <td data-label="Código de Barras">
            <div class="barcode-svg-box">
              <svg id="svg-tb-${item.id}"></svg>
            </div>
          </td>
          <td data-label="Modelo"><strong style="color:var(--text);">${escapeHtml(item.modelo)}</strong></td>
          <td data-label="Categoría"><span class="pill-category">${escapeHtml(item.categoria)}</span></td>
          <td data-label="Variante">
            <span class="pill-variant">${escapeHtml(item.variante)}</span>
            ${item.vinculado ? `
              <div class="pill-linked" onclick="abrirModalVincularStock('${item.id}')" title="Stock vinculado a: ${escapeHtml(item.vinculado.contraparte_nombre || 'Producto')} (Buffer: ${item.vinculado.buffer})">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>${escapeHtml(item.vinculado.contraparte_nombre || 'Vinculado')} (Buf: ${item.vinculado.buffer})</span>
              </div>
            ` : ''}
          </td>
          <td data-label="Estado">${statusHtml}</td>
          <td data-label="Stock / Precio">${stockHtml} ${item.precio ? `· $${item.precio}` : ''}</td>
          <td data-label="Acciones" style="text-align:right;">
            <div class="row-actions-group">
              <button type="button" class="btn-row-icon ${item.vinculado ? 'is-linked' : ''}" onclick="abrirModalVincularStock('${item.id}')" title="${item.vinculado ? 'Stock vinculado con: ' + escapeHtml(item.vinculado.contraparte_nombre || '') : 'Vincular stock con otro producto'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </button>
              <button type="button" class="btn-row-icon" onclick="abrirModalPreviewBarcode('${item.id}')" title="Ver etiqueta e imprimir">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button type="button" class="btn-row-icon" onclick="descargarPngDirecto('${item.id}')" title="Descargar imagen PNG">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </button>
              <button type="button" class="btn-row-icon danger" onclick="eliminarCodigoItem('${item.id}')" title="Eliminar código">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);

        try {
          if (typeof JsBarcode !== 'undefined') {
            JsBarcode(`#svg-tb-${item.id}`, item.barcode, {
              format: 'CODE128',
              width: 1.4,
              height: 32,
              displayValue: false,
              margin: 2,
              lineColor: '#000000',
              background: '#ffffff'
            });
          }
        } catch (_) {}
      });
      actualizarBarraSeleccion();
    }

    function renderGridCodigosBarra(items) {
      const grid = document.getElementById('barcodeGridView');
      if (!grid) return;
      if (!items.length) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:48px 16px; color:var(--muted); display:flex; flex-direction:column; align-items:center; gap:10px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.6;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span style="font-weight:600; color:var(--text); font-size:14px;">No se encontraron productos para esta búsqueda o filtro</span>
          <button type="button" class="btn-bulk" onclick="restablecerFiltrosBarcodes()" style="margin-top:6px;">Restablecer filtros y ver todos</button>
        </div>`;
        return;
      }
      grid.innerHTML = '';
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'barcode-card-item';
        const isSel = selectedBarcodeIds.has(String(item.id));
        if (isSel) card.classList.add('is-selected');

        let statusHtml = item.origen === 'tiendanube'
          ? (item.sincronizado_tn
              ? '<span class="pill-status synced"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Sincronizado</span>'
              : '<span class="pill-status pending">Pendiente</span>')
          : '<span class="pill-status manual">Manual</span>';

        const stockHtml = (item.stock !== null && item.stock !== undefined)
          ? `<span class="barcode-stock-badge" onclick="abrirModalEditarStock('${item.id}')">Stock: <b>${item.stock}</b> <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></span>`
          : '';

        card.innerHTML = `
          <div>
            <div class="card-top-row">
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="chk_item_card_${item.id}" name="chk_item_card_${item.id}" class="chk-item" value="${item.id}" ${isSel ? 'checked' : ''} onchange="onToggleItemSelection(this, '${item.id}')">
                <span class="pill-category">${escapeHtml(item.categoria)}</span>
              </div>
              ${statusHtml}
            </div>
            <div class="card-model-title">${escapeHtml(item.modelo)}</div>
            <div style="margin-top:4px;">
              <span class="pill-variant">${escapeHtml(item.variante)}</span>
              ${item.vinculado ? `
                <div class="pill-linked" onclick="abrirModalVincularStock('${item.id}')" title="Stock vinculado a: ${escapeHtml(item.vinculado.contraparte_nombre || 'Producto')} (Buffer: ${item.vinculado.buffer})">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  <span>${escapeHtml(item.vinculado.contraparte_nombre || 'Vinculado')} (Buf: ${item.vinculado.buffer})</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div>
            <div class="card-barcode-preview">
              <svg id="svg-card-${item.id}"></svg>
            </div>
            <div class="card-num-row" onclick="copiarTextoBarcode('${item.barcode}', this)" title="Clic para copiar">
              <span style="font-family:var(--font-mono); font-size:12.5px; font-weight:700; color:var(--text);">${item.segmentado}</span>
              <span style="font-size:11px; color:var(--muted); display:inline-flex; align-items:center; gap:3px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar
              </span>
            </div>
            <div class="card-bottom-actions">
              <div>${stockHtml} ${item.precio ? `<span style="font-size:11.5px; color:var(--muted);">· $${item.precio}</span>` : ''}</div>
              <div class="row-actions-group">
                <button type="button" class="btn-row-icon ${item.vinculado ? 'is-linked' : ''}" onclick="abrirModalVincularStock('${item.id}')" title="${item.vinculado ? 'Stock vinculado con: ' + escapeHtml(item.vinculado.contraparte_nombre || '') : 'Vincular stock con otro producto'}">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
                <button type="button" class="btn-row-icon" onclick="abrirModalPreviewBarcode('${item.id}')" title="Ver etiqueta e imprimir">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button type="button" class="btn-row-icon" onclick="descargarPngDirecto('${item.id}')" title="Descargar PNG">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
                <button type="button" class="btn-row-icon danger" onclick="eliminarCodigoItem('${item.id}')" title="Eliminar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
        grid.appendChild(card);

        try {
          if (typeof JsBarcode !== 'undefined') {
            JsBarcode(`#svg-card-${item.id}`, item.barcode, {
              format: 'CODE128',
              width: 1.6,
              height: 44,
              displayValue: false,
              margin: 4,
              lineColor: '#000000',
              background: '#ffffff'
            });
          }
        } catch (_) {}
      });
      actualizarBarraSeleccion();
    }

    // ── Selección Múltiple y Acciones por Lote ────────────────────────────────────
    function onToggleItemSelection(chk, id) {
      if (chk.checked) selectedBarcodeIds.add(String(id));
      else selectedBarcodeIds.delete(String(id));
      actualizarBarraSeleccion();
      renderCodigosBarraActuales();
    }

    function onToggleSelectAllBarcodes(chk) {
      if (chk.checked) {
        codigosBarraFiltrados.forEach(x => selectedBarcodeIds.add(String(x.id)));
      } else {
        selectedBarcodeIds.clear();
      }
      actualizarBarraSeleccion();
      renderCodigosBarraActuales();
    }

    function deseleccionarTodosBarcodes() {
      selectedBarcodeIds.clear();
      actualizarBarraSeleccion();
      renderCodigosBarraActuales();
    }

    function actualizarBarraSeleccion() {
      const bar = document.getElementById('barcodeBulkBar');
      const badge = document.getElementById('bulkCountBadge');
      const chkAll = document.getElementById('chkSelectAllBarcodes');
      const count = selectedBarcodeIds.size;

      if (chkAll) {
        chkAll.checked = (count > 0 && count === codigosBarraFiltrados.length);
        chkAll.indeterminate = (count > 0 && count < codigosBarraFiltrados.length);
      }

      if (count > 0) {
        if (bar) bar.style.display = 'flex';
        if (badge) badge.textContent = `${count} seleccionados`;
      } else {
        if (bar) bar.style.display = 'none';
      }
    }

    function copiarTextoBarcode(texto, el) {
      navigator.clipboard.writeText(texto).then(() => {
        toast(`Código ${texto} copiado al portapapeles`);
      }).catch(() => {
        toast(`Código: ${texto}`);
      });
    }

    // ── Sincronizaciones y Conexiones Tiendanube ──────────────────────────────────
    async function refrescarStockEnVivo(btn) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>Consultando TN...</span>';
      }
      try {
        const res = await fetch('/api/codigos-barra/refrescar-stock', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo actualizar el stock');
        toast(`Stock actualizado desde Tiendanube (${data.actualizados || 0} variantes al día)`);
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg> <span>Refrescar Stock</span>';
        }
      }
    }

    async function importarCatalogoTiendanube(btn) {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>Importando...</span>';
      }
      try {
        const res = await fetch('/api/codigos-barra/importar-tiendanube', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al importar catálogo');
        toast(`Importación finalizada: ${data.total_variantes || 0} variantes procesadas (${data.nuevos || 0} nuevos códigos)`);
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><polyline points="12 12 12 16 16 16"/><path d="m16 12-4 4"/></svg> <span>Sincronizar Tiendanube</span>';
        }
      }
    }

    async function subirCodigosATiendanube(btn) {
      if (!confirm('¿Deseas enviar los códigos de barras generados a cada variante en Tiendanube?')) return;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>Subiendo a TN...</span>';
      }
      try {
        const res = await fetch('/api/codigos-barra/sincronizar-tiendanube', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error subiendo códigos');
        toast(`Sincronización completa: ${data.actualizados || 0} códigos guardados en Tiendanube`);
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> <span>Subir Códigos a Tiendanube</span>';
        }
      }
    }

    async function sincronizarSeleccionadosTN() {
      const ids = Array.from(selectedBarcodeIds);
      if (!ids.length) return;
      try {
        const res = await fetch('/api/codigos-barra/sincronizar-tiendanube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error en sincronización');
        toast(`Se sincronizaron ${data.actualizados || 0} ítems seleccionados con Tiendanube`);
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    // ── Edición Rápida de Stock ─────────────────────────────────────────────────
    function abrirModalEditarStock(itemId) {
      const item = codigosBarraData.find(x => String(x.id) === String(itemId));
      if (!item) return;

      document.getElementById('editStockItemId').value = item.id;
      document.getElementById('editStockProdNombre').textContent = `${item.categoria} · ${item.modelo}`;
      document.getElementById('editStockProdVar').textContent = `Variante: ${item.variante || 'Única'} | SKU: ${item.sku || item.barcode}`;

      const inp = document.getElementById('editStockInput');
      inp.value = (item.stock !== null && item.stock !== undefined) ? item.stock : 0;

      const tnWrap = document.getElementById('editStockTNWrap');
      const chkTN = document.getElementById('editStockSyncTN');
      if (item.tn_variant_id) {
        if (tnWrap) tnWrap.style.display = 'flex';
        if (chkTN) chkTN.checked = true;
      } else {
        if (tnWrap) tnWrap.style.display = 'none';
        if (chkTN) chkTN.checked = false;
      }

      const modal = document.getElementById('modalEditarStock');
      if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
      }
      setTimeout(() => { inp.focus(); inp.select(); }, 80);
    }

    function cerrarModalEditarStock() {
      const modal = document.getElementById('modalEditarStock');
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
    }

    function ajustarStockDelta(delta) {
      const inp = document.getElementById('editStockInput');
      if (!inp) return;
      const curr = parseInt(inp.value, 10) || 0;
      inp.value = Math.max(0, curr + delta);
    }

    async function confirmarAjusteStock(e) {
      e.preventDefault();
      const itemId = document.getElementById('editStockItemId').value;
      const stockVal = parseInt(document.getElementById('editStockInput').value, 10);
      const syncTN = document.getElementById('editStockSyncTN')?.checked ?? false;
      const btn = document.getElementById('btnGuardarStock');

      if (isNaN(stockVal) || stockVal < 0) {
        toast('Ingresá un número de stock válido.');
        return;
      }

      if (btn) btn.disabled = true;
      try {
        const res = await fetch(`/api/codigos-barra/${itemId}/modificar-stock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: stockVal, sincronizar_tiendanube: syncTN })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar');

        toast(`Stock actualizado a ${stockVal} u.${data.tn_sincronizado ? ' (Sincronizado con Tiendanube)' : ''}`);
        cerrarModalEditarStock();
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // ── Modal Generador Manual ──────────────────────────────────────────────────
    function abrirModalGeneradorManual() {
      const modal = document.getElementById('modalGeneradorManual');
      if (!modal) {
        console.error('Modal modalGeneradorManual no encontrado');
        return;
      }
      const dl = document.getElementById('listaCategoriasManual');
      if (dl && Array.isArray(codigosBarraData)) {
        const cats = Array.from(new Set(codigosBarraData.map(x => x.categoria).filter(Boolean)));
        dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
      }
      modal.classList.add('show');
      modal.style.display = 'flex';
      setTimeout(() => document.getElementById('manualCategoria')?.focus(), 80);
    }

    function cerrarModalGeneradorManual() {
      const modal = document.getElementById('modalGeneradorManual');
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
    }

    async function guardarProductoManual(e) {
      e.preventDefault();
      const cat = document.getElementById('manualCategoria').value.trim();
      const mod = document.getElementById('manualModelo').value.trim();
      const tallasRaw = document.getElementById('manualTallas').value.split(',').map(s => s.trim()).filter(Boolean);
      const coloresRaw = document.getElementById('manualColores').value.split(',').map(s => s.trim()).filter(Boolean);

      if (!cat || !mod || !tallasRaw.length) {
        toast('Completá categoría, modelo y al menos una talla.');
        return;
      }

      const btn = document.getElementById('btnGuardarManual');
      if (btn) btn.disabled = true;

      try {
        const res = await fetch('/api/codigos-barra/generar-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoria: cat,
            modelo: mod,
            tallas: tallasRaw,
            colores: coloresRaw
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al generar');

        const totalGen = data.total || data.creados?.length || data.generados?.length || 0;
        toast(`¡Se generaron ${totalGen} códigos correctamente!`);
        cerrarModalGeneradorManual();
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // ── Modal Preview de Etiqueta e Impresión ────────────────────────────────────
    function abrirModalPreviewBarcode(itemId) {
      const item = codigosBarraData.find(x => String(x.id) === String(itemId));
      if (!item) return;
      previewItemActual = item;

      document.getElementById('prevMarca').textContent = item.marca || 'Principal (10)';
      document.getElementById('prevModelo').textContent = `${item.categoria} · ${item.modelo}`;
      document.getElementById('prevVariante').textContent = item.variante;
      document.getElementById('prevSegmentado').textContent = item.segmentado;
      document.getElementById('prevSKU').textContent = `SKU: ${item.sku || item.barcode}`;
      document.getElementById('prevPrecio').textContent = item.precio ? `$${item.precio}` : '';

      try {
        if (typeof JsBarcode !== 'undefined') {
          JsBarcode('#prevSvgBarcode', item.barcode, {
            format: 'CODE128',
            width: 2.2,
            height: 60,
            displayValue: false,
            margin: 4,
            lineColor: '#000000',
            background: '#ffffff'
          });
        }
      } catch (_) {}

      const modal = document.getElementById('modalPreviewBarcode');
      if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
      }
    }

    function cerrarModalPreviewBarcode() {
      const modal = document.getElementById('modalPreviewBarcode');
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
      previewItemActual = null;
    }

    function imprimirEtiquetaActual() {
      if (!previewItemActual) return;
      const box = document.getElementById('previewEtiquetaBox');
      const ventana = window.open('', '_blank', 'width=500,height=400');
      ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Imprimir Etiqueta - ${previewItemActual.barcode}</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
            .box { text-align: center; border: 2px solid #000; padding: 16px 20px; border-radius: 8px; width: 320px; }
            @media print { body { min-height: auto; } }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="box">${box.innerHTML}</div>
        </body>
        </html>
      `);
      ventana.document.close();
    }

    function descargarPngDesdePreview() {
      if (!previewItemActual) {
        toast('No hay ninguna etiqueta abierta para descargar.');
        return;
      }
      descargarPngDirecto(previewItemActual.id);
    }

    function descargarPngDirecto(itemId) {
      const item = codigosBarraData.find(x => String(x.id) === String(itemId)) ||
                   (previewItemActual && String(previewItemActual.id) === String(itemId) ? previewItemActual : null);
      if (!item) {
        toast('No se encontró la información del producto para descargar la imagen.');
        return;
      }

      if (typeof JsBarcode === 'undefined') {
        toast('El generador de códigos de barra aún se está cargando. Reintentá en un instante.');
        return;
      }

      // Proporción óptima 600x360 px (coincide exactamente con el ratio de etiqueta 100x60mm)
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      // Fondo blanco puro
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Marco protector con esquinas redondeadas
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(14, 14, 572, 332, 12);
        ctx.stroke();
      } else {
        ctx.strokeRect(14, 14, 572, 332);
      }

      // 1. Cabecera: Categoría · Modelo
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      const catMod = ((item.categoria || '') + ' · ' + (item.modelo || '')).trim().toUpperCase();
      ctx.fillText(catMod, 300, 48);

      // 2. Variante
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(item.variante || '', 300, 78);

      // 3. Código de barras directo en canvas sincrónico (sin fallas de SVG/Image)
      const barcodeCanvas = document.createElement('canvas');
      try {
        JsBarcode(barcodeCanvas, String(item.barcode), {
          format: 'CODE128',
          width: 2.2,
          height: 85,
          displayValue: false,
          margin: 0,
          lineColor: '#000000',
          background: '#ffffff'
        });
        const bx = Math.round((canvas.width - barcodeCanvas.width) / 2);
        ctx.drawImage(barcodeCanvas, bx, 105);
      } catch (err) {
        console.error('Error generando código de barras en PNG:', err);
      }

      // 4. Código 9D segmentado
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px "SFMono-Regular", Consolas, "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(item.segmentado || item.barcode, 300, 225);

      // 5. Línea divisoria inferior
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(32, 260);
      ctx.lineTo(568, 260);
      ctx.stroke();

      // 6. SKU a la izquierda
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`SKU: ${item.sku || item.barcode}`, 34, 302);

      // 7. Precio a la derecha si existe
      if (item.precio !== undefined && item.precio !== null && String(item.precio).trim() !== '') {
        const num = Number(item.precio);
        const precioFormatted = '$' + (!isNaN(num) ? num.toLocaleString('es-AR') : item.precio);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(precioFormatted, 566, 302);
      }

      // 8. Disparo inmediato y sincrónico de descarga
      const safeName = ((item.modelo || 'etiqueta') + '_' + (item.variante || '')).trim().toLowerCase().replace(/[^a-z0-9_-]+/gi, '_');
      const fileName = `etiqueta_${item.barcode}_${safeName}.png`;
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = fileName;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 100);

      toast('Etiqueta PNG descargada correctamente');
    }

    // ── Impresión y Descarga Masiva ─────────────────────────────────────────────
    function imprimirTodasLasEtiquetas() {
      if (!codigosBarraFiltrados.length) {
        toast('No hay etiquetas en la lista para imprimir.');
        return;
      }
      imprimirLote(codigosBarraFiltrados);
    }

    function imprimirSeleccionadosBarcodes() {
      const items = codigosBarraData.filter(x => selectedBarcodeIds.has(String(x.id)));
      if (!items.length) {
        toast('No hay etiquetas seleccionadas.');
        return;
      }
      imprimirLote(items);
    }

    function imprimirLote(items) {
      const win = window.open('', '_blank');
      let htmlCards = '';
      items.forEach(it => {
        const tempSvg = document.createElement('svg');
        try {
          JsBarcode(tempSvg, it.barcode, { format: 'CODE128', width: 2, height: 50, displayValue: false, margin: 2 });
        } catch (_) {}
        htmlCards += `
          <div style="page-break-inside:avoid; border:1.5px solid #000; border-radius:8px; padding:12px 14px; text-align:center; width:220px; display:inline-block; margin:6px; box-sizing:border-box;">
            <div style="font-size:11px; font-weight:800; text-transform:uppercase;">${escapeHtml(it.categoria)} · ${escapeHtml(it.modelo)}</div>
            <div style="font-size:12.5px; font-weight:700; margin:2px 0 6px;">${escapeHtml(it.variante)}</div>
            <div>${tempSvg.outerHTML}</div>
            <div style="font-family:monospace; font-size:12px; font-weight:800; margin-top:4px;">${it.segmentado}</div>
            <div style="font-size:10px; color:#555; margin-top:3px;">SKU: ${it.sku || it.barcode} ${it.precio ? `· $${it.precio}` : ''}</div>
          </div>
        `;
      });
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Imprimir Etiquetas</title>
          <style>body { font-family: sans-serif; margin: 20px; }</style>
        </head>
        <body onload="window.print(); window.close();">${htmlCards}</body>
        </html>
      `);
      win.document.close();
    }

    async function descargarTodoPdfTermico() {
      descargarPdfTermicoLote(codigosBarraFiltrados);
    }

    async function descargarSeleccionadosPdfTermico() {
      const items = codigosBarraData.filter(x => selectedBarcodeIds.has(String(x.id)));
      if (!items.length) return;
      descargarPdfTermicoLote(items);
    }

    function descargarPdfTermicoLote(items) {
      if (typeof window.jspdf === 'undefined') {
        toast('El generador de PDF aún se está cargando. Por favor reintentá en un segundo.');
        return;
      }
      toast('Generando PDF térmico de etiquetas...');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [100, 60] });

      items.forEach((it, idx) => {
        if (idx > 0) doc.addPage([100, 60], 'landscape');

        // Borde exterior con esquinas suaves
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.6);
        doc.roundedRect(3, 3, 94, 54, 2, 2);

        // Cabecera: Categoría · Modelo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const catMod = ((it.categoria || '') + ' · ' + (it.modelo || '')).trim().toUpperCase();
        doc.text(catMod, 50, 9.5, { align: 'center', maxWidth: 88 });

        // Subtítulo: Variante
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(it.variante || '', 50, 15, { align: 'center', maxWidth: 88 });

        // Código de barras (canvas de alta fidelidad)
        const canvas = document.createElement('canvas');
        try {
          JsBarcode(canvas, it.barcode, {
            format: 'CODE128',
            width: 2.2,
            height: 55,
            displayValue: false,
            margin: 0,
            lineColor: '#000000',
            background: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 12, 17.5, 76, 21);
        } catch (_) {}

        // Código 9D Segmentado
        doc.setFont('courier', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text(it.segmentado || it.barcode, 50, 43.5, { align: 'center', maxWidth: 88 });

        // Divisor inferior sutil
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(7, 46.5, 93, 46.5);

        // SKU a la izquierda
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`SKU: ${it.sku || it.barcode}`, 8, 51.5);

        // Precio a la derecha (si existe)
        if (it.precio !== undefined && it.precio !== null && String(it.precio).trim() !== '') {
          const num = Number(it.precio);
          const precioFormatted = '$' + (!isNaN(num) ? num.toLocaleString('es-AR') : it.precio);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(precioFormatted, 92, 51.5, { align: 'right' });
        }
      });

      doc.save(`etiquetas_termicas_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    // ── Eliminaciones ───────────────────────────────────────────────────────────
    async function eliminarCodigoItem(id) {
      if (!confirm('¿Eliminar este código de barras del catálogo?')) return;
      try {
        const res = await fetch(`/api/codigos-barra/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar');
        toast('Código eliminado');
        selectedBarcodeIds.delete(String(id));
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    async function eliminarSeleccionadosBarcodes() {
      const ids = Array.from(selectedBarcodeIds);
      if (!ids.length) return;
      if (!confirm(`¿Eliminar las ${ids.length} etiquetas seleccionadas?`)) return;
      try {
        const res = await fetch('/api/codigos-barra/eliminar-lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron eliminar');
        toast(`Se eliminaron ${data.eliminados || 0} etiquetas`);
        selectedBarcodeIds.clear();
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    async function limpiarCatalogoCodigos() {
      if (!confirm('¿Estás seguro de que deseas vaciar TODOS los códigos del catálogo? Esta acción no se puede deshacer.')) return;
      try {
        const res = await fetch('/api/codigos-barra/limpiar', { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo vaciar');
        toast('Catálogo vaciado completamente');
        selectedBarcodeIds.clear();
        await cargarCodigosBarra(true);
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    // ── Gestión de Stock Vinculado y Sugerencias Inteligentes ───────────────────
    let sugerenciasDisponibles = [];
    let currentVincularItem = null;
    let currentSugerencia = null;
    let currentVincularContraparte = null;
    let currentVincularBuffer = 0;
    let currentVincularEsBase = true;
    let vincularInvertido = false;
    let sugModalInvertido = false;

    async function consultarBadgeSugerencias() {
      try {
        const res = await fetch('/api/stock-vinculado/sugerencias');
        if (!res.ok) return;
        const data = await res.json();
        const badge = document.getElementById('badgeSugerenciasCount');
        if (badge) {
          if (data.total > 0) {
            badge.textContent = data.total;
            badge.style.display = 'inline-flex';
          } else {
            badge.style.display = 'none';
          }
        }
      } catch (_) {}
    }

    async function abrirModalSugerenciasStock() {
      const modal = document.getElementById('modalSugerenciasStock');
      const loading = document.getElementById('sugerenciasLoadingState');
      const empty = document.getElementById('sugerenciasEmptyState');
      const content = document.getElementById('sugerenciasContentList');
      if (!modal) return;

      modal.classList.add('show');
      modal.style.display = 'flex';
      if (loading) loading.style.display = 'block';
      if (empty) empty.style.display = 'none';
      if (content) {
        content.style.display = 'none';
        content.innerHTML = '';
      }

      try {
        const res = await fetch('/api/stock-vinculado/sugerencias');
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al obtener sugerencias');

        sugerenciasDisponibles = data.sugerencias || [];
        if (loading) loading.style.display = 'none';

        if (!sugerenciasDisponibles.length) {
          if (empty) empty.style.display = 'block';
          actualizarContadorSugerenciasSeleccionadas();
          return;
        }

        if (content) {
          content.style.display = 'flex';
          content.style.flexDirection = 'column';
          content.style.gap = '12px';

          sugerenciasDisponibles.forEach((sug, idx) => {
            const itemA = sug.item_a;
            const itemB = sug.item_b;
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.style.margin = '0';
            card.innerHTML = `
              <div class="suggestion-card-header">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:13px; color:var(--text);">
                  <input type="checkbox" id="chk_sug_${idx}" name="chk_sug_${idx}" class="chk-sugerencia" data-index="${idx}" checked style="width:17px; height:17px; accent-color:var(--accent);" onchange="actualizarContadorSugerenciasSeleccionadas()">
                  <span>Sugerencia #${idx + 1}</span>
                </label>
                <div style="display:flex; align-items:center; gap:6px;">
                  <button type="button" class="btn-sug-swap" onclick="invertirSugerenciaLote(${idx})" title="Invertir Base y Contraparte">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 16V4M7 4L3 8M7 4L11 8M17 8v12M17 20l4-4M17 20l-4-4"/></svg>
                    <span>Invertir Roles</span>
                  </button>
                  <span class="confidence-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ${Math.round((sug.confianza || 0.95) * 100)}% Coincidencia
                  </span>
                </div>
              </div>

              <div class="sug-grid-pair" id="sug_pair_${idx}">
                <div class="sug-item-box">
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;">
                    <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:var(--accent);">Producto Base (A)</span>
                    ${itemA.categoria ? `<span class="pill-category" style="font-size:10px; padding:2px 7px;">${escapeHtml(itemA.categoria)}</span>` : ''}
                  </div>
                  <div class="sug-item-title">${escapeHtml(itemA.modelo)} - ${escapeHtml(itemA.variante)}</div>
                  <div class="sug-item-sub">
                    <span>SKU: <b>${escapeHtml(itemA.sku)}</b></span>
                    <span>·</span>
                    <span>Stock: <b>${itemA.stock !== null && itemA.stock !== undefined ? itemA.stock : '-'}</b></span>
                  </div>
                </div>

                <div class="sug-link-icon" style="cursor:pointer;" onclick="invertirSugerenciaLote(${idx})" title="Click para invertir roles">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </div>

                <div class="sug-item-box">
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;">
                    <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:#818cf8;">Contraparte (B) - Buffer</span>
                    ${itemB.categoria ? `<span class="pill-category" style="font-size:10px; padding:2px 7px;">${escapeHtml(itemB.categoria)}</span>` : ''}
                  </div>
                  <div class="sug-item-title">${escapeHtml(itemB.modelo)} - ${escapeHtml(itemB.variante)}</div>
                  <div class="sug-item-sub">
                    <span>SKU: <b>${escapeHtml(itemB.sku)}</b></span>
                    <span>·</span>
                    <span>Stock: <b>${itemB.stock !== null && itemB.stock !== undefined ? itemB.stock : '-'}</b></span>
                  </div>
                </div>
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; background:var(--surface-2); padding:8px 12px; border-radius:8px; border:1px solid var(--border);">
                <div style="font-size:12px; color:var(--text-2);">
                  <span style="color:var(--muted);">Motivo:</span> ${escapeHtml(sug.motivo)}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <label for="buf_sug_${idx}" style="font-size:11.5px; font-weight:700; color:var(--text-2);">Buffer:</label>
                  <input type="number" id="buf_sug_${idx}" name="buf_sug_${idx}" class="form-input" min="0" max="99" value="${sug.buffer_sugerido}" style="width:64px; height:28px; padding:2px 6px; text-align:center; font-weight:800; font-size:12px;">
                  <span style="font-size:11px; color:var(--muted);">u</span>
                </div>
              </div>
            `;
            content.appendChild(card);
          });
        }

        actualizarContadorSugerenciasSeleccionadas();
      } catch (err) {
        if (loading) loading.style.display = 'none';
        toast('Error cargando sugerencias: ' + err.message);
      }
    }

    function invertirSugerenciaLote(idx) {
      if (!sugerenciasDisponibles || !sugerenciasDisponibles[idx]) return;
      const sug = sugerenciasDisponibles[idx];
      const tmp = sug.item_a;
      sug.item_a = sug.item_b;
      sug.item_b = tmp;

      const pairEl = document.getElementById(`sug_pair_${idx}`);
      if (!pairEl) return;

      const itemA = sug.item_a;
      const itemB = sug.item_b;

      pairEl.innerHTML = `
        <div class="sug-item-box">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;">
            <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:var(--accent);">Producto Base (A)</span>
            ${itemA.categoria ? `<span class="pill-category" style="font-size:10px; padding:2px 7px;">${escapeHtml(itemA.categoria)}</span>` : ''}
          </div>
          <div class="sug-item-title">${escapeHtml(itemA.modelo)} - ${escapeHtml(itemA.variante)}</div>
          <div class="sug-item-sub">
            <span>SKU: <b>${escapeHtml(itemA.sku)}</b></span>
            <span>·</span>
            <span>Stock: <b>${itemA.stock !== null && itemA.stock !== undefined ? itemA.stock : '-'}</b></span>
          </div>
        </div>

        <div class="sug-link-icon" style="cursor:pointer;" onclick="invertirSugerenciaLote(${idx})" title="Click para invertir roles">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </div>

        <div class="sug-item-box">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;">
            <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; color:#818cf8;">Contraparte Vinculada (B)</span>
            ${itemB.categoria ? `<span class="pill-category" style="font-size:10px; padding:2px 7px;">${escapeHtml(itemB.categoria)}</span>` : ''}
          </div>
          <div class="sug-item-title">${escapeHtml(itemB.modelo)} - ${escapeHtml(itemB.variante)}</div>
          <div class="sug-item-sub">
            <span>SKU: <b>${escapeHtml(itemB.sku)}</b></span>
            <span>·</span>
            <span>Stock: <b>${itemB.stock !== null && itemB.stock !== undefined ? itemB.stock : '-'}</b></span>
          </div>
        </div>
      `;
    }

    function cerrarModalSugerenciasStock() {
      const modal = document.getElementById('modalSugerenciasStock');
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
    }

    function actualizarContadorSugerenciasSeleccionadas() {
      const chks = document.querySelectorAll('.chk-sugerencia:checked');
      const total = document.querySelectorAll('.chk-sugerencia');
      const countSpan = document.getElementById('sugSeleccionadosCount');
      if (countSpan) {
        countSpan.textContent = `${chks.length} de ${total.length} seleccionados`;
      }
      const btn = document.getElementById('btnVincularSeleccionadosSugs');
      if (btn) btn.disabled = (chks.length === 0);
    }

    function toggleSeleccionarTodasSugerencias() {
      const chks = document.querySelectorAll('.chk-sugerencia');
      const todasMarcadas = Array.from(chks).every(c => c.checked);
      chks.forEach(c => c.checked = !todasMarcadas);
      const btn = document.getElementById('btnToggleAllSugs');
      if (btn) btn.textContent = todasMarcadas ? 'Seleccionar todo' : 'Deseleccionar';
      actualizarContadorSugerenciasSeleccionadas();
    }

    async function ejecutarVinculacionLoteSugerencias() {
      const chks = document.querySelectorAll('.chk-sugerencia:checked');
      if (!chks.length) {
        toast('Selecciona al menos una sugerencia para vincular');
        return;
      }

      const pares = [];
      chks.forEach(chk => {
        const idx = parseInt(chk.dataset.index, 10);
        const sug = sugerenciasDisponibles[idx];
        if (sug) {
          const bufInp = document.getElementById(`buf_sug_${idx}`);
          const bufVal = bufInp ? parseInt(bufInp.value, 10) : sug.buffer_sugerido;
          pares.push({
            item_a_id: sug.item_a.id,
            item_b_id: sug.item_b.id,
            buffer: isNaN(bufVal) ? 0 : Math.max(0, bufVal)
          });
        }
      });

      const btn = document.getElementById('btnVincularSeleccionadosSugs');
      const txtOrig = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Vinculando...';
      }

      try {
        const res = await fetch('/api/stock-vinculado/vincular-lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pares: pares })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al vincular en lote');

        toast(`¡Éxito! ${data.vinculados} productos vinculados correctamente.`);
        cerrarModalSugerenciasStock();
        await cargarCodigosBarra(true);
        consultarBadgeSugerencias();
      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = txtOrig;
        }
      }
    }

    async function abrirModalVincularStock(itemId) {
      const modal = document.getElementById('modalVincularStock');
      if (!modal) return;

      const item = codigosBarraData.find(x => String(x.id) === String(itemId));
      if (!item) {
        toast('Producto no encontrado');
        return;
      }

      currentVincularItem = item;
      currentSugerencia = null;

      document.getElementById('vincularOrigenNombre').textContent = `${item.modelo} - ${item.variante}`;
      document.getElementById('vincularOrigenSKU').textContent = item.sku || item.barcode;
      document.getElementById('vincularOrigenStock').textContent = (item.stock !== null && item.stock !== undefined) ? `${item.stock} u` : 'No gestionado';
      const catBadge = document.getElementById('vincularOrigenCategoria');
      if (catBadge) {
        if (item.categoria) {
          catBadge.textContent = item.categoria;
          catBadge.style.display = 'inline-flex';
        } else {
          catBadge.style.display = 'none';
        }
      }

      const select = document.getElementById('selectContraparteManual');
      if (select) {
        select.innerHTML = '<option value="">Buscar o seleccionar del catálogo...</option>';
        codigosBarraData
          .filter(x => String(x.id) !== String(itemId))
          .sort((a, b) => `${a.modelo} ${a.variante}`.localeCompare(`${b.modelo} ${b.variante}`))
          .forEach(other => {
            const opt = document.createElement('option');
            opt.value = other.id;
            const catP = other.categoria ? `[${other.categoria}] ` : '';
            opt.textContent = `${catP}${other.modelo} - ${other.variante} (SKU: ${other.sku || other.barcode} · Stock: ${other.stock !== null && other.stock !== undefined ? other.stock : '-'})`;
            select.appendChild(opt);
          });
      }

      modal.classList.add('show');
      modal.style.display = 'flex';
      document.getElementById('vincularEstadoYaVinculado').style.display = 'none';
      document.getElementById('vincularEstadoNoVinculado').style.display = 'none';

      try {
        const res = await fetch(`/api/stock-vinculado/par/${itemId}`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al consultar producto');

        if (data.vinculado && data.contraparte) {
          currentVincularContraparte = data.contraparte;
          currentVincularBuffer = data.buffer || 0;
          currentVincularEsBase = (data.es_base !== false);

          document.getElementById('vincularEstadoYaVinculado').style.display = 'block';
          document.getElementById('vincularYaBadgeOrigen').textContent = (data.origen === 'sugerencia_auto') ? 'Sugerencia Aceptada' : 'Manual';
          document.getElementById('vincularYaContraNombre').textContent = data.contraparte.nombre_completo || `${data.contraparte.modelo} - ${data.contraparte.variante}`;
          document.getElementById('vincularYaContraStock').textContent = `${data.contraparte.stock !== null && data.contraparte.stock !== undefined ? data.contraparte.stock : '-'} u`;
          document.getElementById('vincularYaBuffer').textContent = data.buffer;

          const descEl = document.getElementById('vincularYaRolDescripcion');
          if (descEl) {
            if (currentVincularEsBase) {
              descEl.innerHTML = `<b>Rol activo:</b> Este producto es la <b>Base Principal (A)</b> (stock real). Su contraparte tiene <b>${data.buffer} u menos</b>.`;
            } else {
              descEl.innerHTML = `<b>Rol activo:</b> Este producto es la <b>Contraparte (B)</b> (tiene <b>${data.buffer} u menos</b> que la Base).`;
            }
          }
        } else {
          vincularInvertido = false;
          sugModalInvertido = false;
          document.getElementById('vincularEstadoNoVinculado').style.display = 'block';
          const cardSug = document.getElementById('vincularCardSugerencia');
          if (data.sugerencia && data.sugerencia.item) {
            currentSugerencia = data.sugerencia;
            cardSug.style.display = 'block';
            document.getElementById('vincularSugNombre').textContent = `${data.sugerencia.item.modelo} - ${data.sugerencia.item.variante}`;
            document.getElementById('vincularSugMotivo').textContent = data.sugerencia.motivo || '';
            document.getElementById('vincularSugBufferVal').textContent = data.sugerencia.buffer_sugerido;
            document.getElementById('vincularSugConfianza').textContent = `${Math.round((data.sugerencia.confianza || 0.95) * 100)}% Coincidencia`;

            const bufTxt = document.getElementById('vincularSugBufferText');
            if (bufTxt) {
              bufTxt.innerHTML = `Buffer sugerido: <b id="vincularSugBufferVal">${data.sugerencia.buffer_sugerido}</b> unidades menos`;
            }

            if (select) select.value = data.sugerencia.item.id;
            const bufInp = document.getElementById('inputBufferManual');
            if (bufInp) bufInp.value = data.sugerencia.buffer_sugerido;
          } else {
            cardSug.style.display = 'none';
            const bufInp = document.getElementById('inputBufferManual');
            if (bufInp) bufInp.value = 0;
          }
          actualizarPrevisualizacionRoles();
        }
      } catch (err) {
        toast('Error consultando vinculación: ' + err.message);
      }
    }

    function cerrarModalVincularStock() {
      const modal = document.getElementById('modalVincularStock');
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
      currentVincularItem = null;
      currentSugerencia = null;
      currentVincularContraparte = null;
      vincularInvertido = false;
      sugModalInvertido = false;
      const box = document.getElementById('vincularRolesBox');
      if (box) box.style.display = 'none';
    }

    async function invertirVinculacionExistente() {
      if (!currentVincularItem || !currentVincularContraparte) return;

      const btn = document.getElementById('btnInvertirActivo');
      if (btn) btn.disabled = true;

      const newBaseId = currentVincularEsBase ? currentVincularContraparte.id : currentVincularItem.id;
      const newContraId = currentVincularEsBase ? currentVincularItem.id : currentVincularContraparte.id;

      try {
        const res = await fetch('/api/stock-vinculado/vincular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_a_id: newBaseId,
            item_b_id: newContraId,
            buffer: currentVincularBuffer,
            sincronizar_inmediato: true,
            forzar_orden: true
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al invertir vinculación');

        toast('¡Dirección de vinculación invertida con éxito!');
        await cargarCodigosBarra(true);
        await abrirModalVincularStock(currentVincularItem.id);
      } catch (err) {
        toast('Error: ' + err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    function invertirSugerenciaModalDirecta() {
      if (!currentVincularItem || !currentSugerencia || !currentSugerencia.item) return;
      sugModalInvertido = !sugModalInvertido;

      const baseItem = sugModalInvertido ? currentSugerencia.item : currentVincularItem;
      const contraItem = sugModalInvertido ? currentVincularItem : currentSugerencia.item;
      const bufVal = currentSugerencia.buffer_sugerido || 0;

      const nomEl = document.getElementById('vincularSugNombre');
      const bufTxt = document.getElementById('vincularSugBufferText');
      if (nomEl) {
        nomEl.innerHTML = `<span style="color:var(--accent);">Base:</span> ${escapeHtml(baseItem.modelo)} ${escapeHtml(baseItem.variante)} ➔ <span style="color:#818cf8;">Buffer:</span> ${escapeHtml(contraItem.modelo)} ${escapeHtml(contraItem.variante)}`;
      }
      if (bufTxt) {
        bufTxt.innerHTML = `Buffer: <b>${escapeHtml(contraItem.modelo)}</b> tendrá <b id="vincularSugBufferVal">${bufVal}</b> unidades menos`;
      }
    }

    async function aceptarSugerenciaDirecta() {
      if (!currentVincularItem || !currentSugerencia || !currentSugerencia.item) return;

      const baseId = sugModalInvertido ? currentSugerencia.item.id : currentVincularItem.id;
      const contraId = sugModalInvertido ? currentVincularItem.id : currentSugerencia.item.id;

      try {
        const res = await fetch('/api/stock-vinculado/vincular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_a_id: baseId,
            item_b_id: contraId,
            buffer: currentSugerencia.buffer_sugerido,
            sincronizar_inmediato: true,
            forzar_orden: true
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al vincular');

        toast('¡Productos vinculados exitosamente!');
        cerrarModalVincularStock();
        await cargarCodigosBarra(true);
        consultarBadgeSugerencias();
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    function actualizarPrevisualizacionRoles() {
      const box = document.getElementById('vincularRolesBox');
      const select = document.getElementById('selectContraparteManual');
      const bufInp = document.getElementById('inputBufferManual');
      if (!box || !select) return;

      const targetId = select.value;
      if (!targetId || !currentVincularItem) {
        box.style.display = 'none';
        return;
      }

      const otherItem = codigosBarraData.find(x => String(x.id) === String(targetId));
      if (!otherItem) {
        box.style.display = 'none';
        return;
      }

      box.style.display = 'block';
      const bufferVal = bufInp ? Math.max(0, parseInt(bufInp.value, 10) || 0) : 0;

      const itemA = vincularInvertido ? otherItem : currentVincularItem;
      const itemB = vincularInvertido ? currentVincularItem : otherItem;

      const stockA = (itemA.stock !== null && itemA.stock !== undefined) ? itemA.stock : null;
      const stockB = (itemB.stock !== null && itemB.stock !== undefined) ? itemB.stock : null;

      const elA = document.getElementById('vincularRoleANombre');
      const elB = document.getElementById('vincularRoleBNombre');
      const elPrev = document.getElementById('vincularLiveCalcPreview');

      if (elA) {
        elA.textContent = `${itemA.modelo} - ${itemA.variante} (Stock: ${stockA !== null ? stockA : '-'})`;
        elA.title = elA.textContent;
      }
      if (elB) {
        elB.textContent = `${itemB.modelo} - ${itemB.variante} (Stock: ${stockB !== null ? stockB : '-'})`;
        elB.title = elB.textContent;
      }

      if (elPrev) {
        if (bufferVal > 0) {
          const stockBProyectado = stockA !== null ? Math.max(0, stockA - bufferVal) : '-';
          elPrev.innerHTML = `Regla: <b>${escapeHtml(itemB.modelo)} ${escapeHtml(itemB.variante)}</b> tendrá <b>${bufferVal} u menos</b> que la Base. Stock resultante: <b>${stockBProyectado} u</b>.`;
        } else {
          elPrev.innerHTML = `Regla: Ambos productos compartirán stock idéntico 1:1 (${stockA !== null ? stockA : '-'} u).`;
        }
      }
    }

    function invertirDireccionModalManual() {
      vincularInvertido = !vincularInvertido;
      actualizarPrevisualizacionRoles();
    }

    async function guardarVinculacionManualDesdeModal() {
      if (!currentVincularItem) return;
      const select = document.getElementById('selectContraparteManual');
      const bufInp = document.getElementById('inputBufferManual');
      const targetId = select ? select.value : '';
      const bufferVal = bufInp ? parseInt(bufInp.value, 10) : 0;

      if (!targetId) {
        toast('Selecciona un producto del catálogo para vincular');
        return;
      }

      const item_a_id = vincularInvertido ? parseInt(targetId, 10) : currentVincularItem.id;
      const item_b_id = vincularInvertido ? currentVincularItem.id : parseInt(targetId, 10);

      try {
        const res = await fetch('/api/stock-vinculado/vincular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_a_id: item_a_id,
            item_b_id: item_b_id,
            buffer: isNaN(bufferVal) ? 0 : Math.max(0, bufferVal),
            sincronizar_inmediato: true,
            forzar_orden: true
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al vincular');

        toast('¡Productos vinculados exitosamente!');
        cerrarModalVincularStock();
        await cargarCodigosBarra(true);
        consultarBadgeSugerencias();
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    async function desvincularProductoActual() {
      if (!currentVincularItem) return;
      if (!confirm('¿Deseas desvincular estos productos? Sus inventarios ya no se descontarán juntos.')) return;

      try {
        const res = await fetch('/api/stock-vinculado/desvincular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: currentVincularItem.id })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al desvincular');

        toast('Vinculación eliminada correctamente.');
        cerrarModalVincularStock();
        await cargarCodigosBarra(true);
        consultarBadgeSugerencias();
      } catch (err) {
        toast('Error: ' + err.message);
      }
    }

    // ── Utilidades ──────────────────────────────────────────────────────────────
    function escapeHtml(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Exposición global para callbacks HTML inline y compatibilidad absoluta
    window.abrirModalGeneradorManual = abrirModalGeneradorManual;
    window.cerrarModalGeneradorManual = cerrarModalGeneradorManual;
    window.guardarProductoManual = guardarProductoManual;
    window.abrirModalEditarStock = abrirModalEditarStock;
    window.cerrarModalEditarStock = cerrarModalEditarStock;
    window.ajustarStockDelta = ajustarStockDelta;
    window.confirmarAjusteStock = confirmarAjusteStock;
    window.abrirModalPreviewBarcode = abrirModalPreviewBarcode;
    window.cerrarModalPreviewBarcode = cerrarModalPreviewBarcode;
    window.descargarPngDesdePreview = descargarPngDesdePreview;
    window.descargarPngDirecto = descargarPngDirecto;
    window.imprimirEtiquetaActual = imprimirEtiquetaActual;
    window.imprimirTodasLasEtiquetas = imprimirTodasLasEtiquetas;
    window.imprimirSeleccionadosBarcodes = imprimirSeleccionadosBarcodes;
    window.descargarTodoPdfTermico = descargarTodoPdfTermico;
    window.descargarSeleccionadosPdfTermico = descargarSeleccionadosPdfTermico;
    window.limpiarCatalogoCodigos = limpiarCatalogoCodigos;
    window.eliminarSeleccionadosBarcodes = eliminarSeleccionadosBarcodes;
    window.eliminarCodigoItem = eliminarCodigoItem;
    window.eliminarCodigoIndividual = eliminarCodigoItem; // Alias de compatibilidad
    window.deseleccionarTodosBarcodes = deseleccionarTodosBarcodes;
    window.sincronizarSeleccionadosTN = sincronizarSeleccionadosTN;
    window.refrescarStockEnVivo = refrescarStockEnVivo;
    window.subirCodigosATiendanube = subirCodigosATiendanube;
    window.importarCatalogoTiendanube = importarCatalogoTiendanube;
    window.sincronizarTiendanubeManual = importarCatalogoTiendanube;
    window.setBarcodeView = setBarcodeView;
    window.cambiarVistaCodigos = setBarcodeView; // Alias de compatibilidad
    window.setQuickFilterBarcode = setQuickFilterBarcode;
    window.setScannerMode = setScannerMode;
    window.cambiarModoScanner = setScannerMode; // Alias de compatibilidad
    window.setScannerStep = setScannerStep;
    window.cambiarCantidadScanner = setScannerStep; // Alias de compatibilidad
    window.limpiarHistorialScanner = limpiarHistorialScanner;
    window.procesarDisparoScanner = procesarDisparoScanner;
    window.ejecutarAjustePistola = procesarDisparoScanner; // Alias de compatibilidad
    window.onSelectOrigenChange = onSelectOrigenChange;
    window.filtrarCodigosBarra = filtrarCodigosBarra;
    window.onToggleSelectAllBarcodes = onToggleSelectAllBarcodes;
    window.toggleSelectAllBarcodes = onToggleSelectAllBarcodes; // Alias de compatibilidad
    window.onToggleItemSelection = onToggleItemSelection;
    window.toggleSelectBarcode = onToggleItemSelection; // Alias de compatibilidad
    window.cargarCodigosBarra = cargarCodigosBarra;
    window.verificarSesionUsuario = verificarSesionUsuario;
    window.handleLogout = handleLogout;

    // Stock Vinculado y Asistente de Sugerencias
    window.abrirModalSugerenciasStock = abrirModalSugerenciasStock;
    window.cerrarModalSugerenciasStock = cerrarModalSugerenciasStock;
    window.toggleSeleccionarTodasSugerencias = toggleSeleccionarTodasSugerencias;
    window.ejecutarVinculacionLoteSugerencias = ejecutarVinculacionLoteSugerencias;
    window.actualizarContadorSugerenciasSeleccionadas = actualizarContadorSugerenciasSeleccionadas;
    window.invertirSugerenciaLote = invertirSugerenciaLote;
    window.abrirModalVincularStock = abrirModalVincularStock;
    window.cerrarModalVincularStock = cerrarModalVincularStock;
    window.aceptarSugerenciaDirecta = aceptarSugerenciaDirecta;
    window.guardarVinculacionManualDesdeModal = guardarVinculacionManualDesdeModal;
    window.desvincularProductoActual = desvincularProductoActual;
    window.consultarBadgeSugerencias = consultarBadgeSugerencias;
    window.invertirVinculacionExistente = invertirVinculacionExistente;
    window.invertirSugerenciaModalDirecta = invertirSugerenciaModalDirecta;
    window.invertirDireccionModalManual = invertirDireccionModalManual;
    window.actualizarPrevisualizacionRoles = actualizarPrevisualizacionRoles;

    // Inicializar al cargar la página (soporta carga inmediata si el DOM ya está listo)
    function inicializarAppCodigos() {
      verificarSesionUsuario();
      cargarCodigosBarra();
      consultarBadgeSugerencias();
      refocarScannerInput();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inicializarAppCodigos);
    } else {
      inicializarAppCodigos();
    }