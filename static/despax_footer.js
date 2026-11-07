// ==========================================================================
// DESPAX SHARED GLOBAL FOOTER COMPONENT
// Único punto de control del pie de página para:
// - Preguntas Frecuentes (/faq)
// - Política de Privacidad (/privacidad)
// - Ayuda y Soporte (/soporte)
// - Términos y Condiciones (/terminos)
// Cualquier cambio realizado en este archivo se refleja automáticamente en todas las páginas.
// ==========================================================================

class DespaxFooter extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block';
    this.innerHTML = `
      <footer class="despax-global-footer" style="margin-top:40px; padding:24px 0 0; max-width:100%;">
        <div class="despax-footer-top">
          <div class="despax-footer-brand">
            <div class="despax-footer-logo-row">
              <img src="/static/img/despax_logo.png" alt="Despax" class="despax-footer-logo despax-logo-light">
              <img src="/static/img/despax_logo_dark.png" alt="Despax" class="despax-footer-logo despax-logo-dark">
            </div>
            <p class="despax-footer-tagline">Comandas claras, etiquetas precisas, despachos sin errores.</p>
          </div>
        </div>

        <div class="despax-footer-bottom">
          <div class="despax-footer-copy">
            © 2026 Despax. Todos los derechos reservados.
          </div>
          <div class="despax-footer-links-secondary">
            <a href="/faq">Preguntas Frecuentes</a>
            <a href="/privacidad">Política de Privacidad</a>
            <a href="/soporte">Ayuda</a>
          </div>
        </div>
      </footer>
    `;
  }
}

if (!customElements.get('despax-footer')) {
  customElements.define('despax-footer', DespaxFooter);
}
