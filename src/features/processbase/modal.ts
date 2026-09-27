/**
 * Modal do pedido de diagnóstico. Todo link para `#contato` (os botões
 * "Agendar diagnóstico") abre a modal `#agendar-diagnostico` em vez de rolar
 * até o formulário do fim da página. Sem JavaScript, o link continua levando
 * ao formulário aberto, que fica lá para quem não clicou em nenhum botão.
 *
 * O conteúdo da modal é nativo (título, texto, formulário); este script, num
 * widget HTML junto com o botão de fechar, só cuida do comportamento: abre e
 * fecha, prende o foco dentro dela, fecha com Esc ou clique fora, trava a
 * rolagem da página e devolve o foco a quem abriu. Numa página que não rola
 * (a miniatura do Space) a modal aparece parada, para dar para ver.
 */
export const PROCESSBASE_MODAL_SCRIPT = `
(function () {
  var modal = document.getElementById('agendar-diagnostico');
  if (!modal || modal.getAttribute('data-pb-modal')) return;
  modal.setAttribute('data-pb-modal', '1');
  var card = modal.querySelector('.pb-modal-card') || modal;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  card.setAttribute('tabindex', '-1');
  // o script roda antes do título ser lido: o nome da modal é ligado na primeira abertura
  function label() {
    var title = card.querySelector('h2');
    if (title && !modal.getAttribute('aria-labelledby')) { title.id = title.id || 'pb-modal-title'; modal.setAttribute('aria-labelledby', title.id); }
  }
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var opener = null, timer = 0;

  function isOpen() { return modal.classList.contains('is-open'); }
  function focusables() {
    return [].slice.call(card.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetWidth || el.offsetHeight || el.getClientRects().length; });
  }
  function open(from) {
    clearTimeout(timer);
    opener = from || document.activeElement;
    label();
    modal.classList.remove('is-closing');
    modal.classList.add('is-open');
    document.documentElement.classList.add('pb-modal-lock');
    var first = card.querySelector('input:not([type="hidden"]),textarea');
    (first || card).focus({ preventScroll: true });
  }
  function close() {
    if (!isOpen()) return;
    document.documentElement.classList.remove('pb-modal-lock');
    var done = function () { modal.classList.remove('is-open', 'is-closing'); };
    // saída mais curta que a entrada; com movimento reduzido, fecha na hora
    if (reduce) done(); else { modal.classList.add('is-closing'); timer = setTimeout(done, 160); }
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href$="#contato"]');
    if (link && !modal.contains(link)) {
      e.preventDefault();
      // o menu do celular fecha junto
      [].forEach.call(document.querySelectorAll('.pb-menu[open]'), function (menu) { menu.open = false; });
      open(link);
      return;
    }
    if (!isOpen()) return;
    // fundo: qualquer clique fora do card (o miolo do Elementor cobre a tela toda)
    if (!card.contains(e.target) || (e.target.closest && e.target.closest('.pb-modal-close'))) { e.preventDefault(); close(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var list = focusables();
    if (!list.length) { e.preventDefault(); card.focus(); return; }
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function preview() {
    var still = document.documentElement.scrollHeight - window.innerHeight <= 80 && !isOpen();
    modal.classList.toggle('is-preview', still);
  }
  preview();
  window.addEventListener('load', preview);
})();
`
