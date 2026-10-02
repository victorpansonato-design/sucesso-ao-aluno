/* ==========================================================================
   app.js — Central de Atendimento UniAnchieta (protótipo estático)
   --------------------------------------------------------------------------
   Arquitetura de produto inspirada na Intercom Inbox; identidade visual e
   motion vindos do DESIGN_SYSTEM.md do projeto. Sem build, sem backend: todo
   o comportamento é estado local em JavaScript.

   Organização deste arquivo:
     1. utilidades          6. inbox — painel contextual e copilot
     2. estado e derivações 7. dashboard
     3. overlays            8. contatos e ficha 360
     4. shell               9. histórico (somente leitura)
     5. inbox — lista e conversa   10. teclado, rotas e boot
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA;
  var I = window.ICON;

  /* ======================================================================
     1. UTILIDADES
     ====================================================================== */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function cls() {
    return Array.prototype.filter
      .call(arguments, function (c) {
        return !!c;
      })
      .join(' ');
  }
  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** Relógio da operação: "agora", "12 min", "3 h", "ontem", "12/09". */
  function relTime(ts) {
    var diff = Math.round((Date.now() - ts) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return diff + ' min';
    var h = Math.floor(diff / 60);
    if (h < 24) return h + ' h';
    var d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    if (d < 7) return d + ' d';
    var dt = new Date(ts);
    return pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1);
  }
  function clock(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dayLabel(ts) {
    var d = new Date(ts);
    var today = new Date();
    var y = new Date(today.getTime() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === y.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }
  function fullDate(ts) {
    var d = new Date(ts);
    return (
      pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + clock(ts)
    );
  }
  /** Versão curta, para a linha de meta da fila: "24m", "3h10", "2d". */
  function durShort(min) {
    if (min < 60) return Math.round(min) + 'm';
    var h = Math.floor(min / 60);
    if (h < 24) return h + 'h' + pad(Math.round(min % 60));
    return Math.floor(h / 24) + 'd';
  }

  /** Duração em minutos → "4 min", "2h 51", "1d 3h". */
  function dur(min) {
    if (min < 60) return Math.round(min) + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return h + 'h ' + pad(Math.round(min % 60));
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  }
  function money(v) {
    return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function maskCpf(cpf) {
    return '***.' + cpf.slice(4, 7) + '.' + cpf.slice(8, 11) + '-**';
  }
  function maskMail(mail) {
    var at = mail.indexOf('@');
    return mail.slice(0, 2) + '***' + mail.slice(at);
  }
  /** Chave de busca sem acento, para "rematricula" achar "rematrícula". */
  function key(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  function student(id) {
    for (var i = 0; i < D.STUDENTS.length; i++) if (D.STUDENTS[i].id === id) return D.STUDENTS[i];
    return null;
  }
  function agent(id) {
    if (id === 'bot') return D.BOT;
    for (var i = 0; i < D.AGENTS.length; i++) if (D.AGENTS[i].id === id) return D.AGENTS[i];
    return null;
  }
  function queue(id) {
    for (var i = 0; i < D.QUEUES.length; i++) if (D.QUEUES[i].id === id) return D.QUEUES[i];
    return { id: id, name: id, icon: 'inbox' };
  }
  function channel(id) {
    for (var i = 0; i < D.CHANNELS.length; i++) if (D.CHANNELS[i].id === id) return D.CHANNELS[i];
    return { id: id, name: id, icon: 'messageSquare' };
  }
  function conv(id) {
    for (var i = 0; i < D.CONVERSATIONS.length; i++)
      if (D.CONVERSATIONS[i].id === id) return D.CONVERSATIONS[i];
    return null;
  }
  function lastMsg(c) {
    return c.messages[c.messages.length - 1];
  }
  /** A última mensagem que o aluno vê na lista — nota interna não conta. */
  function previewMsg(c) {
    for (var i = c.messages.length - 1; i >= 0; i--) {
      if (c.messages[i].from !== 'nota') return c.messages[i];
    }
    return lastMsg(c);
  }
  function updatedAt(c) {
    return lastMsg(c).at;
  }
  function createdAt(c) {
    return c.messages[0].at;
  }
  function isOpen(c) {
    return c.status === 'aberto' || c.status === 'pendente';
  }

  /**
   * Estado do SLA. É a informação que decide a ordem da fila, então ela é
   * calculada uma vez e usada em todo lugar: lista, cabeçalho e dashboard.
   */
  function sla(c) {
    if (c.status === 'encerrado') return { state: 'fechado', label: 'Encerrado', mins: 0 };
    if (c.status === 'snoozed')
      return { state: 'pausado', label: 'Adiado ' + relTime(c.snoozedUntil).replace('agora', 'agora'), mins: 9999 };
    var mins = Math.round((c.slaDue - Date.now()) / 60000);
    if (mins < 0) return { state: 'estourado', label: 'SLA estourado há ' + dur(-mins), mins: mins };
    if (mins <= 15) return { state: 'proximo', label: 'SLA em ' + dur(mins), mins: mins };
    return { state: 'ok', label: 'SLA em ' + dur(mins), mins: mins };
  }

  var PRIORITY = { urgente: 3, alta: 2, normal: 1, baixa: 0 };

  /* ======================================================================
     2. ESTADO
     ====================================================================== */

  var S = {
    route: { name: 'inbox', id: null },
    view: 'minha',
    selected: null,
    sort: 'sla',
    search: '',
    filters: {},
    composer: { mode: 'reply', text: '' },
    /* aluno · copilot · historico */
    ctxTab: 'aluno',
    /* Em telas estreitas o painel começa fechado — ele vira sobreposição, e
       abrir sobre a conversa sem o atendente ter pedido seria intrusivo. */
    ctxOpen: window.innerWidth >= 1400,
    bulk: null,
    copilot: { running: false, title: null, body: '', chips: null, insert: null },
    ask: { q: '', a: '', running: false },
    groups: { pastas: true },
    sections: { academico: true, financeiro: true, atendimento: true },
    histOrder: 'desc',
    revealed: {},
    contacts: { search: '', segment: 'todos', sortKey: 'ultima', sortDir: 'desc', filters: {} },
    contactTab: 'visao',
    dashPeriod: 'hoje',
    dashRange: null,
    dashDist: 'assunto',
    viewsOverlay: false,
    viewsCollapsed: false,
    autoReplied: {},
    flashAt: null,
    enterAnim: true,
    folders: [],
    newFolder: false,
    theme: document.documentElement.getAttribute('data-theme') || 'claro',
  };

  /* Visão do atendente: só o que ele usa no turno. Filas da equipe, menções,
     favoritos e visões salvas saem — o canal de hoje não tem esse volume, e
     cada aba a mais é uma aba a mais para conferir. Elas voltam quando o
     canal crescer. As pastas são do próprio atendente. */
  var VIEWS = [
    { id: 'minha', name: 'Minha caixa', icon: 'inbox', hint: 'As conversas que são suas' },
    { id: 'encerrados', name: 'Encerrados', icon: 'circleCheck', hint: 'Os que você finalizou' },
  ];

  function folder(id) {
    for (var i = 0; i < S.folders.length; i++) if (S.folders[i].id === id) return S.folders[i];
    return null;
  }

  function viewLabel(id) {
    for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) return VIEWS[i].name;
    if (id.indexOf('pasta:') === 0) return (folder(id.slice(6)) || { name: 'Pasta' }).name;
    return 'Conversas';
  }

  /** O predicado que define cada caixa. Cego a busca e filtros de propósito:
      esconder uma conversa não pode movê-la de caixa. */
  function inView(c, view) {
    if (view.indexOf('pasta:') === 0) return c.folder === view.slice(6) && c.assignee === D.ME.id;
    switch (view) {
      case 'minha':
        return isOpen(c) && c.assignee === D.ME.id;
      case 'encerrados':
        return c.status === 'encerrado' && c.assignee === D.ME.id;
      /* A fila não é uma caixa visível: é de onde "Atender próximo" puxa. */
      case 'fila':
        return isOpen(c) && c.assignee === null;
      default:
        return false;
    }
  }

  /* -- Pastas e fixados: a organização é do atendente, e sobrevive ao F5 --- */
  var ORG_KEY = 'atendimento.v2.org';

  function saveOrg() {
    try {
      var map = {};
      var pins = [];
      D.CONVERSATIONS.forEach(function (c) {
        if (c.folder) map[c.id] = c.folder;
        if (c.pinned) pins.push(c.id);
      });
      localStorage.setItem(ORG_KEY, JSON.stringify({ folders: S.folders, map: map, pins: pins }));
    } catch (e) {
      /* storage indisponível — vale só para esta sessão */
    }
  }

  function loadOrg() {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(ORG_KEY) || 'null');
    } catch (e) {
      saved = null;
    }
    if (saved && saved.folders) {
      S.folders = saved.folders;
      D.CONVERSATIONS.forEach(function (c) {
        c.folder = (saved.map && saved.map[c.id]) || null;
        c.pinned = (saved.pins || []).indexOf(c.id) >= 0;
      });
      return;
    }
    /* Primeira visita: duas pastas de exemplo, para a função se explicar. */
    S.folders = [
      { id: 'f-ouv', name: 'Ouvidoria em andamento' },
      { id: 'f-doc', name: 'Aguardando documento' },
    ];
    var seed = { c21: 'f-ouv', c22: 'f-ouv', c24: 'f-ouv', c04: 'f-doc', c11: 'f-doc' };
    D.CONVERSATIONS.forEach(function (c) {
      c.folder = seed[c.id] || null;
      c.pinned = c.id === 'c22';
    });
  }

  function countFor(view) {
    return D.CONVERSATIONS.filter(function (c) {
      return inView(c, view);
    }).length;
  }

  function matchesFilters(c) {
    var f = S.filters;
    if (f.canal && c.channel !== f.canal) return false;
    if (f.fila && c.queue !== f.fila) return false;
    if (f.prioridade && c.priority !== f.prioridade) return false;
    if (f.tag && c.tags.indexOf(f.tag) < 0) return false;
    if (f.modalidade && student(c.studentId).modality !== f.modalidade) return false;
    if (S.search) {
      var st = student(c.studentId);
      var hay = key(
        st.name + ' ' + st.ra + ' ' + c.subject + ' ' + c.tags.join(' ') + ' ' + previewMsg(c).text
      );
      if (hay.indexOf(key(S.search)) < 0) return false;
    }
    return true;
  }

  function listConversations() {
    var out = D.CONVERSATIONS.filter(function (c) {
      return inView(c, S.view) && matchesFilters(c);
    });
    out.sort(function (a, b) {
      /* Fixadas sempre no topo — e na mesma ordem que o J/K percorre. */
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      if (S.sort === 'recentes') return updatedAt(b) - updatedAt(a);
      if (S.sort === 'antigos') return createdAt(a) - createdAt(b);
      if (S.sort === 'prioridade') {
        var d = PRIORITY[b.priority] - PRIORITY[a.priority];
        return d !== 0 ? d : sla(a).mins - sla(b).mins;
      }
      return sla(a).mins - sla(b).mins;
    });
    return out;
  }

  function activeFilterCount() {
    var n = 0;
    for (var k in S.filters) if (S.filters[k]) n++;
    return n;
  }

  /* ======================================================================
     3. OVERLAYS — popover, menu, modal, drawer, toast, tooltip
     ====================================================================== */

  var overlayRoot = $('#overlay-root');
  var popLayer = null;
  var modalStack = [];

  /** `immediate` tira o menu do DOM na hora — a troca de tema precisa disso,
      senão a View Transition fotografa o popover no meio da saída. */
  function closePop(immediate) {
    if (!popLayer) return;
    var pop = $('.pop', popLayer);
    var layer = popLayer;
    popLayer = null;
    if (pop && !immediate) {
      pop.setAttribute('data-closing', 'true');
      setTimeout(function () {
        layer.remove();
      }, 100);
    } else layer.remove();
    /* Só o gatilho deste popover volta a "fechado". Zerar todo aria-expanded
       da página recolhia, de brinde, o grupo Pastas na coluna. */
    $$('[data-pop-anchor]').forEach(function (b) {
      b.removeAttribute('data-pop-anchor');
      b.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Popover ancorado. Mede o gatilho e vira para cima/esquerda quando não cabe
   * — um menu que abre para fora da janela é um menu que não abriu.
   */
  function openPop(anchor, html, opts) {
    opts = opts || {};
    closePop();
    popLayer = document.createElement('div');
    popLayer.className = 'pop-layer';
    popLayer.innerHTML = '<div class="pop" role="dialog">' + html + '</div>';
    overlayRoot.appendChild(popLayer);

    var pop = $('.pop', popLayer);
    if (opts.width) pop.style.width = opts.width + 'px';
    var r = anchor.getBoundingClientRect();
    var pw = pop.offsetWidth;
    var ph = pop.offsetHeight;
    var align = opts.align || 'left';
    var left = align === 'right' ? r.right - pw : r.left;
    if (left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
    if (left < 10) left = 10;
    var top = r.bottom + 6;
    if (top + ph > window.innerHeight - 10) {
      top = r.top - ph - 6;
      pop.style.transformOrigin = 'bottom left';
    }
    if (top < 10) top = 10;
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';

    popLayer.addEventListener('mousedown', function (e) {
      if (e.target === popLayer) closePop();
    });
    anchor.setAttribute('aria-expanded', 'true');
    anchor.setAttribute('data-pop-anchor', '');
    var auto = $('[data-autofocus]', pop);
    if (auto) setTimeout(function () { auto.focus(); }, 40);
    if (opts.onMount) opts.onMount(pop);
    return pop;
  }

  function menuHtml(items) {
    return (
      '<div class="pop__list scroll-slim">' +
      items
        .map(function (it) {
          if (it.sep) return '<div class="pop__sep"></div>';
          if (it.label === undefined) return '';
          return (
            '<button class="menuitem' +
            (it.danger ? ' menuitem--danger' : '') +
            '" data-mact="' +
            esc(it.act || '') +
            '"' +
            (it.value !== undefined ? ' data-value="' + esc(it.value) + '"' : '') +
            (it.checked ? ' aria-checked="true"' : '') +
            '>' +
            (it.icon ? I(it.icon, 14) : '') +
            '<span class="menuitem__label">' +
            esc(it.label) +
            (it.sub ? '<span class="menuitem__sub">' + esc(it.sub) + '</span>' : '') +
            '</span>' +
            (it.checked ? I('check', 14) : '') +
            (it.hint ? '<span class="menuitem__hint">' + esc(it.hint) + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function openMenu(anchor, items, onPick, opts) {
    var pop = openPop(anchor, menuHtml(items), opts || {});
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('.menuitem');
      if (!b) return;
      closePop();
      onPick(b.dataset.mact, b.dataset.value);
    });
    return pop;
  }

  /* -- Modal --------------------------------------------------------------- */
  var FOCUSABLE =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function openSheet(kind, opts) {
    var prev = document.activeElement;
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    var wrap = document.createElement('div');

    if (kind === 'modal') {
      wrap.className = 'modal-wrap';
      wrap.innerHTML =
        '<div class="modal modal--' +
        (opts.size || 'md') +
        '" role="dialog" aria-modal="true" tabindex="-1">' +
        (opts.title
          ? '<header class="modal__head"><div class="modal__head-id">' +
            (opts.icon ? '<div class="modal__icon">' + I(opts.icon, 18) + '</div>' : '') +
            '<div><h2 class="modal__title">' +
            esc(opts.title) +
            '</h2>' +
            (opts.sub ? '<p class="modal__sub">' + esc(opts.sub) + '</p>' : '') +
            '</div></div>' +
            '<button class="modal__close" data-close aria-label="Fechar">' +
            I('x', 16) +
            '</button></header>'
          : '') +
        '<div class="modal__body scroll-slim">' +
        opts.body +
        '</div>' +
        (opts.footer ? '<footer class="modal__foot' + (opts.footerSplit ? ' modal__foot--split' : '') + '">' + opts.footer + '</footer>' : '') +
        '</div>';
    } else {
      wrap.className = 'drawer-wrap';
      wrap.innerHTML =
        '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' +
        esc(opts.label || 'Painel') +
        '" tabindex="-1">' +
        opts.body +
        '</aside>';
    }

    overlayRoot.appendChild(scrim);
    overlayRoot.appendChild(wrap);
    var sheet = $('.modal, .drawer', wrap);

    function close() {
      var idx = modalStack.indexOf(entry);
      if (idx >= 0) modalStack.splice(idx, 1);
      sheet.setAttribute('data-closing', 'true');
      scrim.setAttribute('data-closing', 'true');
      setTimeout(function () {
        wrap.remove();
        scrim.remove();
        if (prev && prev.focus) prev.focus();
      }, 200);
    }
    var entry = { close: close, el: sheet };
    modalStack.push(entry);

    scrim.addEventListener('mousedown', close);
    wrap.addEventListener('mousedown', function (e) {
      if (e.target === wrap) close();
    });
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) close();
    });
    /* Trap de foco: a folha não devolve o Tab para o app atrás dela. */
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$(FOCUSABLE, sheet).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    setTimeout(function () {
      var target = $('[data-autofocus]', sheet) || $(FOCUSABLE, sheet) || sheet;
      target.focus();
    }, 60);

    if (opts.onMount) opts.onMount(sheet, close);
    return { el: sheet, close: close };
  }

  function openModal(opts) {
    return openSheet('modal', opts);
  }
  function openDrawer(opts) {
    return openSheet('drawer', opts);
  }

  /* -- Toast --------------------------------------------------------------- */
  function toast(text, opts) {
    opts = opts || {};
    var host = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast';
    if (opts.tone) el.setAttribute('data-tone', opts.tone);
    el.innerHTML =
      '<span class="toast__icon">' +
      I(opts.icon || 'check', 15) +
      '</span><div class="toast__text">' +
      esc(text) +
      (opts.sub ? '<div class="toast__sub">' + esc(opts.sub) + '</div>' : '') +
      '</div>' +
      (opts.action ? '<button class="toast__action" data-toast-action>' + esc(opts.action) + '</button>' : '');
    host.appendChild(el);
    var timer = setTimeout(remove, opts.timeout || 4200);
    function remove() {
      clearTimeout(timer);
      el.setAttribute('data-closing', 'true');
      setTimeout(function () {
        el.remove();
      }, 150);
    }
    if (opts.action) {
      $('[data-toast-action]', el).addEventListener('click', function () {
        remove();
        if (opts.onAction) opts.onAction();
      });
    }
    return remove;
  }

  /* -- Tooltip ------------------------------------------------------------- */
  var tipEl = null;
  var tipTimer = null;
  function showTip(target) {
    hideTip();
    tipTimer = setTimeout(function () {
      var text = target.getAttribute('data-tip');
      if (!text) return;
      var k = target.getAttribute('data-tip-key');
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
      tipEl.innerHTML = esc(text) + (k ? '<kbd>' + esc(k) + '</kbd>' : '');
      $('#tooltip-root').appendChild(tipEl);
      var r = target.getBoundingClientRect();
      var tw = tipEl.offsetWidth;
      var pos = target.getAttribute('data-tip-pos') || 'bottom';
      var left = r.left + r.width / 2 - tw / 2;
      var top = pos === 'right' ? r.top + r.height / 2 - tipEl.offsetHeight / 2 : r.bottom + 7;
      if (pos === 'right') left = r.right + 8;
      if (pos === 'top') top = r.top - tipEl.offsetHeight - 7;
      tipEl.style.left = Math.max(8, Math.min(left, window.innerWidth - tw - 8)) + 'px';
      tipEl.style.top = Math.max(8, top) + 'px';
    }, 380);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tipEl) {
      tipEl.remove();
      tipEl = null;
    }
  }

  /* ======================================================================
     4. SHELL — rail e coluna de views
     ====================================================================== */

  /**
   * Avatar. Com `photo`, a foto cobre as iniciais; se ela não carregar (sem
   * rede, link quebrado), o `onerror` remove a imagem e as iniciais — que
   * estavam embaixo o tempo todo — aparecem. Nunca um quadrado quebrado.
   */
  function avatarHtml(name, initials, size, tone, extra, photo) {
    return (
      '<span class="avatar avatar--' +
      (size || 'sm') +
      (tone ? ' avatar--' + tone : '') +
      (photo ? ' avatar--photo' : '') +
      '" title="' +
      esc(name) +
      '" aria-hidden="true">' +
      esc(initials) +
      (photo
        ? '<img src="' +
          esc(photo) +
          '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" ' +
          'onerror="this.parentNode.classList.remove(\'avatar--photo\');this.remove()">'
        : '') +
      (extra || '') +
      '</span>'
    );
  }

  function studentAvatar(st, size, tone) {
    return avatarHtml(st.name, st.initials, size, tone, '', st.photo);
  }

  function renderRail() {
    var nav = [
      { route: 'inbox', icon: 'inbox', label: 'Inbox', badge: unreadMine(), k: 'G I' },
      { route: 'dashboard', icon: 'gauge', label: 'Desempenho', k: 'G D' },
      { route: 'contatos', icon: 'users', label: 'Contatos', k: 'G C' },
    ];
    var railSnap = snapshotPill('.rail-pill');
    $('#rail-nav').innerHTML = '<span class="rail-pill"></span>' + nav
      .map(function (n) {
        return (
          '<a class="rail__btn" href="#/' +
          n.route +
          '" data-tip="' +
          n.label +
          '" data-tip-key="' +
          n.k +
          '" data-tip-pos="right" aria-label="' +
          n.label +
          '"' +
          (S.route.name === n.route ? ' aria-current="page"' : '') +
          '>' +
          I(n.icon, 18) +
          (n.badge ? '<span class="rail__badge">' + n.badge + '</span>' : '') +
          '</a>'
        );
      })
      .join('');
    restorePill('.rail-pill', railSnap);

    $('#rail-foot').innerHTML =
      '<button class="rail__btn" data-act="notifications" data-tip="Notificações" data-tip-pos="right" aria-label="Notificações">' +
      I('bell', 18) +
      '<span class="rail__badge">3</span></button>' +
      '<button class="rail__btn" data-act="theme" data-tip="Aparência" data-tip-pos="right" ' +
      'aria-label="Aparência: ' + esc(themeById(S.theme).name) + '" aria-haspopup="dialog">' +
      I(isDarkTheme(S.theme) ? 'moon' : 'sun', 18) +
      '</button>' +
      '<div class="rail__sep"></div>' +
      '<button class="rail__btn rail__avatar" data-act="me" data-tip="' +
      esc(D.ME.name) +
      '" data-tip-pos="right" aria-label="Sua conta">' +
      avatarHtml(D.ME.name, D.ME.initials, 'sm', 'brand') +
      '<span class="presence" data-state="' +
      D.ME.presence +
      '"></span></button>';
  }

  function navItemHtml(id, name, icon, count, tone, extraAttr) {
    return (
      '<button class="navitem" data-view="' +
      esc(id) +
      '"' +
      (S.view === id && S.route.name === 'inbox' ? ' aria-current="true"' : '') +
      (extraAttr || '') +
      '>' +
      I(icon, 15) +
      '<span class="navitem__label">' +
      esc(name) +
      '</span>' +
      '<span class="navitem__count"' +
      (tone ? ' data-tone="' + tone + '"' : '') +
      '>' +
      (count ? count : '') +
      '</span>' +
      '</button>'
    );
  }

  function unreadMine() {
    return D.CONVERSATIONS.filter(function (c) {
      return inView(c, 'minha') && c.unread > 0;
    }).length;
  }

  function brandBlockHtml() {
    return (
      '<div class="brandblock">' +
      (window.BRAND_WORDMARK ? window.BRAND_WORDMARK('brandblock__mark') : '') +
      '<div class="brandblock__unit"><span class="brandblock__rule"></span>' +
      '<span class="brandblock__label">Central de Atendimento</span></div>' +
      '<button class="iconbtn iconbtn--sm brandblock__collapse" data-act="collapse-views" ' +
      'data-tip="Recolher a coluna" aria-label="Recolher a coluna">' +
      I('chevronLeft', 15) +
      '</button></div>'
    );
  }

  /** Uma pasta na coluna: item de navegação, alvo de arrastar-e-soltar e,
      no hover, o menu para renomear ou excluir. */
  function folderItemHtml(f) {
    var n = countFor('pasta:' + f.id);
    return (
      '<div class="navfolder" data-drop-folder="' +
      esc(f.id) +
      '">' +
      navItemHtml('pasta:' + f.id, f.name, 'folder', n, null) +
      '<button class="iconbtn iconbtn--sm navfolder__more" data-folder-menu="' +
      esc(f.id) +
      '" aria-label="Opções da pasta ' +
      esc(f.name) +
      '">' +
      I('more', 13) +
      '</button></div>'
    );
  }

  function renderViewsColumn() {
    var col = $('#col-views');
    var navSnap = snapshotPill('.nav-pill');
    if (S.route.name === 'dashboard') {
      col.hidden = true;
      return;
    }
    col.hidden = false;

    if (S.route.name === 'contatos') {
      col.innerHTML = contactsNavHtml() + teamFootHtml() + resizerHtml('views', 'right', 'Largura da lista de segmentos');
      restorePill('.nav-pill', navSnap);
      syncNavPill($('.views__scroll'), '.navitem[aria-current="true"]', '.nav-pill');
      return;
    }

    var html =
      brandBlockHtml() +
      '<div class="views__title"><h1>Inbox</h1>' +
      '<button class="iconbtn iconbtn--sm" data-act="new-conversation" data-tip="Nova conversa" aria-label="Nova conversa">' +
      I('plus', 15) +
      '</button></div>' +
      '<button class="search-trigger" data-act="palette">' +
      I('search', 14) +
      '<span>Buscar aluno, RA ou conversa</span><span class="kbd">Ctrl K</span></button>' +
      '<div class="views__scroll scroll-slim"><span class="nav-pill"></span>';

    /* "Minha caixa" também é alvo de soltar: arrastar uma conversa para lá
       tira ela da pasta. */
    html += '<div class="navfolder" data-drop-folder="">' + navItemHtml('minha', 'Minha caixa', 'inbox', countFor('minha'), null) + '</div>';
    html += navItemHtml('encerrados', 'Encerrados', 'circleCheck', countFor('encerrados'), null);

    html +=
      '<div class="navgroup"><div class="navgroup__row"><button class="navgroup__head" data-group="pastas" aria-expanded="' +
      S.groups.pastas +
      '">' +
      I('chevronDown', 13) +
      'Pastas</button>' +
      '<button class="iconbtn iconbtn--sm" data-act="new-folder" data-tip="Nova pasta" aria-label="Nova pasta">' +
      I('folderPlus', 14) +
      '</button></div>' +
      '<div class="navgroup__body" data-collapsed="' +
      !S.groups.pastas +
      '"><div>' +
      S.folders.map(folderItemHtml).join('') +
      (S.newFolder
        ? '<div class="navfolder-input">' +
          I('folder', 15) +
          '<input id="new-folder-input" maxlength="40" placeholder="Nome da pasta" aria-label="Nome da nova pasta" autocomplete="off"></div>'
        : !S.folders.length
          ? '<button class="navgroup__empty" data-act="new-folder">' + I('plus', 12) + 'Criar a primeira pasta</button>'
          : '') +
      '</div></div></div>';

    html += '</div>' + teamFootHtml();

    col.innerHTML = html + resizerHtml('views', 'right', 'Largura da lista de caixas');
    restorePill('.nav-pill', navSnap);
    syncNavPill($('.views__scroll'), '.navitem[aria-current="true"]', '.nav-pill');
    var inp = $('#new-folder-input');
    if (inp) setTimeout(function () { inp.focus(); }, 30);
  }

  /* Rodapé da coluna: só a palavra "Equipe". O detalhe — quem está e em que
     estado — abre para cima, sob demanda. Contexto de distribuição não
     precisa ocupar a coluna o turno inteiro. */
  function teamFootHtml() {
    var avail = D.AGENTS.filter(function (a) {
      return a.presence === 'online';
    }).length;
    return (
      '<div class="views__foot"><button class="team-btn" data-act="team" aria-haspopup="dialog">' +
      I('users', 15) +
      '<span class="team-btn__label">Equipe</span>' +
      '<span class="team-btn__live" data-tip="' + avail + ' disponíveis agora"><i></i>' + avail + '</span>' +
      I('chevronUp', 13) +
      '</button></div>'
    );
  }

  var PRESENCE = {
    online: { label: 'Disponível', order: 0 },
    ocupado: { label: 'Em atendimento', order: 1 },
    ausente: { label: 'Ausente', order: 2 },
    offline: { label: 'Offline', order: 3 },
  };

  function openTeam(anchor) {
    var list = D.AGENTS.slice().sort(function (a, b) {
      if (a.id === D.ME.id) return -1;
      if (b.id === D.ME.id) return 1;
      return PRESENCE[a.presence].order - PRESENCE[b.presence].order || a.name.localeCompare(b.name);
    });
    var counts = {};
    D.AGENTS.forEach(function (a) {
      counts[a.presence] = (counts[a.presence] || 0) + 1;
    });
    var html =
      '<div class="pop__head team-pop__head"><span class="pop__title">Equipe agora</span>' +
      '<span class="team-pop__sum">' +
      ['online', 'ocupado', 'ausente', 'offline']
        .filter(function (k) {
          return counts[k];
        })
        .map(function (k) {
          return '<span><i class="presence-dot" data-state="' + k + '"></i>' + counts[k] + '</span>';
        })
        .join('') +
      '</span></div>' +
      '<div class="pop__list scroll-slim team-pop__list">' +
      list
        .map(function (a) {
          return (
            '<div class="team-row">' +
            '<span class="team-row__av">' +
            avatarHtml(a.name, a.initials, 'sm', a.id === D.ME.id ? 'brand' : null) +
            '<i class="presence-dot" data-state="' +
            a.presence +
            '"></i></span>' +
            '<span class="team-row__text"><span class="team-row__name">' +
            esc(a.name) +
            (a.id === D.ME.id ? ' <span class="team-row__you">você</span>' : '') +
            '</span><span class="team-row__role">' +
            esc(a.role) +
            '</span></span>' +
            '<span class="team-row__state" data-state="' +
            a.presence +
            '">' +
            PRESENCE[a.presence].label +
            '</span></div>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="pop__foot team-pop__foot"><span>Seu status</span>' +
      '<button class="linkbtn" data-act="me-status">' +
      PRESENCE[D.ME.presence].label +
      I('chevronDown', 12) +
      '</button></div>';
    var pop = openPop(anchor, html, { width: 300 });
    pop.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="me-status"]')) {
        e.stopPropagation();
        closePop(true);
        statusMenu(anchor);
      }
    });
  }

  function statusMenu(anchor) {
    openMenu(
      anchor,
      [
        { label: 'Disponível', act: 'p', value: 'online', checked: D.ME.presence === 'online' },
        { label: 'Em atendimento', act: 'p', value: 'ocupado', checked: D.ME.presence === 'ocupado' },
        { label: 'Ausente', act: 'p', value: 'ausente', checked: D.ME.presence === 'ausente' },
      ],
      function (a, v) {
        D.ME.presence = v;
        renderRail();
        renderViewsColumn();
        toast('Seu status: ' + PRESENCE[v].label, { icon: 'userCheck' });
      },
      { width: 220 }
    );
  }

  function contactsNavHtml() {
    var segs = [
      { id: 'todos', name: 'Todos os alunos', icon: 'users' },
      { id: 'meus', name: 'Atendidos por mim', icon: 'userCheck' },
      { id: 'abertos', name: 'Com conversa aberta', icon: 'messageSquare' },
      { id: 'risco', name: 'Risco de evasão', icon: 'shieldAlert' },
      { id: 'inadimplentes', name: 'Com débito', icon: 'banknote' },
      { id: 'formandos', name: 'Formandos', icon: 'graduationCap' },
      { id: 'ead', name: 'EAD e híbrido', icon: 'bookOpen' },
    ];
    return (
      brandBlockHtml() +
      '<div class="views__title"><h1>Contatos</h1></div>' +
      '<button class="search-trigger" data-act="palette">' +
      I('search', 14) +
      '<span>Buscar aluno ou RA</span><span class="kbd">Ctrl K</span></button>' +
      '<div class="views__scroll scroll-slim"><span class="nav-pill"></span>' +
      segs
        .map(function (sg) {
          return (
            '<button class="navitem" data-segment="' +
            sg.id +
            '"' +
            (S.contacts.segment === sg.id ? ' aria-current="true"' : '') +
            '>' +
            I(sg.icon, 15) +
            '<span class="navitem__label">' +
            esc(sg.name) +
            '</span><span class="navitem__count">' +
            segmentStudents(sg.id).length +
            '</span></button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  /* ======================================================================
     5. INBOX — lista e conversa
     ====================================================================== */

  function convRowHtml(c, i) {
    var st = student(c.studentId);
    var sl = sla(c);
    var pm = previewMsg(c);
    var who = pm.from === 'aluno' ? '' : pm.from === 'bot' ? 'IA: ' : 'Você: ';
    if (pm.from === 'agente' && pm.authorId !== D.ME.id) {
      var ag = agent(pm.authorId);
      who = (ag ? ag.name.split(' ')[0] : 'Equipe') + ': ';
    }
    var selectable = S.bulk !== null;
    var fd = c.folder && S.view.indexOf('pasta:') !== 0 ? folder(c.folder) : null;

    return (
      '<button class="conv" style="--i:' +
      Math.min(i || 0, 12) +
      '" data-conv="' +
      c.id +
      '" role="option"' +
      (S.selected === c.id ? ' aria-selected="true"' : ' aria-selected="false"') +
      ' data-unread="' +
      (c.unread > 0) +
      '" data-sla="' +
      sl.state +
      '" data-pinned="' +
      !!c.pinned +
      '"' +
      (selectable ? '' : ' draggable="true"') +
      '>' +
      '<span class="conv__rail"></span>' +
      '<span class="conv__top">' +
      (selectable
        ? '<span class="conv__check" data-check="' +
          c.id +
          '" aria-checked="' +
          (S.bulk.indexOf(c.id) >= 0) +
          '">' +
          I('check', 11) +
          '</span>'
        : '<span class="conv__avatar">' +
          studentAvatar(st, 'sm', c.priority === 'urgente' ? 'crit' : null) +
          (c.unread > 0 ? '<span class="conv__unread"></span>' : '') +
          '</span>') +
      '<span class="conv__who"><span class="conv__name">' +
      esc(st.name) +
      '</span><span class="conv__ra">' +
      esc(st.ra) +
      '</span></span>' +
      '<span class="conv__time">' +
      relTime(updatedAt(c)) +
      '</span>' +
      /* Fixar mora no hover da linha: aparece onde o olho já está. Um span
         com papel de botão, porque um <button> dentro do <button> da linha
         seria HTML inválido. */
      (selectable
        ? ''
        : '<span class="conv__pin" role="button" tabindex="-1" data-pin="' +
          c.id +
          '" aria-label="' +
          (c.pinned ? 'Desafixar' : 'Fixar no topo') +
          '" data-tip="' +
          (c.pinned ? 'Desafixar' : 'Fixar no topo') +
          '">' +
          I(c.pinned ? 'pinOff' : 'pin', 13) +
          '</span>') +
      '</span>' +
      '<span class="conv__subject" title="' +
      esc(c.subject) +
      '">' +
      (c.pinned ? '<span class="conv__pinned" aria-label="Fixada">' + I('pin', 11) + '</span>' : '') +
      esc(c.subject) +
      '</span>' +
      '<span class="conv__preview" title="' +
      esc(who + pm.text) +
      '">' +
      esc(who + pm.text) +
      '</span>' +
      '<span class="conv__meta">' +
      (c.priority === 'urgente' || c.priority === 'alta'
        ? '<span class="conv__prio" data-level="' +
          c.priority +
          '" title="Prioridade ' +
          c.priority +
          '">' +
          I('flag', 12) +
          '</span>'
        : '') +
      (c.ouvidoria
        ? '<span class="tag tag--ouv">' + I('megaphone', 10) + 'Ouvidoria</span>'
        : '<span class="tag">' + esc(queue(c.queue).name) + '</span>') +
      (fd ? '<span class="tag tag--folder">' + I('folder', 10) + esc(fd.name) + '</span>' : c.tags[0] && !c.ouvidoria ? '<span class="tag">' + esc(c.tags[0]) + '</span>' : '') +
      '<span class="conv__meta-right">' +
      (c.status === 'encerrado'
        ? '<span class="status status--quiet">Encerrado ' + relTime(c.closedAt) + '</span>'
        : '<span class="sla" data-state="' +
          sl.state +
          '">' +
          (sl.state === 'estourado' ? I('alertTriangle', 11) : I('clock', 11)) +
          (sl.state === 'estourado' ? '-' + durShort(-sl.mins) : durShort(sl.mins)) +
          '</span>') +
      '</span></span></button>'
    );
  }

  function filterBarHtml() {
    var chips = [];
    var labels = {
      canal: function (v) { return channel(v).name; },
      fila: function (v) { return queue(v).name; },
      prioridade: function (v) { return 'Prioridade ' + v; },
      tag: function (v) { return v; },
      modalidade: function (v) { return v; },
    };
    for (var k in S.filters) {
      if (!S.filters[k]) continue;
      chips.push(
        '<span class="tag tag--removable">' +
          esc(labels[k] ? labels[k](S.filters[k]) : S.filters[k]) +
          '<button class="tag__x" data-clear-filter="' +
          k +
          '" aria-label="Remover filtro">' +
          I('x', 10) +
          '</button></span>'
      );
    }
    if (S.search)
      chips.push(
        '<span class="tag tag--removable">Busca: ' +
          esc(S.search) +
          '<button class="tag__x" data-clear-search aria-label="Limpar busca">' +
          I('x', 10) +
          '</button></span>'
      );
    if (!chips.length) return '';
    return (
      '<div class="filterbar">' +
      chips.join('') +
      '<button class="linkbtn" data-act="clear-filters" style="margin-left:2px">Limpar tudo</button></div>'
    );
  }

  function renderList() {
    var pane = $('#pane-list');
    if (!pane) return;
    var items = listConversations();
    var waiting = countFor('fila');
    var scroller = $('.conv-list', pane);
    var keepScroll = scroller ? scroller.scrollTop : 0;
    var isFolder = S.view.indexOf('pasta:') === 0;

    var head =
      '<div class="panehead">' +
      (S.viewsCollapsed
        ? '<button class="iconbtn" data-act="expand-views" data-tip="Mostrar as caixas" aria-label="Mostrar as caixas">' +
          I('panelLeft', 15) +
          '</button>'
        : '') +
      '<div class="panehead__title"><h2>' +
      (isFolder ? '<span class="panehead__folder">' + I('folder', 14) + '</span>' : '') +
      esc(viewLabel(S.view)) +
      '</h2><span class="panehead__sub">' +
      items.length +
      (items.length === 1 ? ' conversa' : ' conversas') +
      (S.view === 'minha' && unreadMine() ? ' · ' + unreadMine() + ' com mensagem nova' : '') +
      '</span></div>' +
      '<div class="panehead__spacer"></div>' +
      '<div class="panehead__tools">' +
      '<button class="iconbtn" data-act="filters" data-tip="Filtrar" aria-label="Filtrar">' +
      I('listFilter', 15) +
      (activeFilterCount() ? '<span class="iconbtn__badge">' + activeFilterCount() + '</span>' : '') +
      '</button>' +
      '<button class="iconbtn" data-act="sort" data-tip="Ordenar" aria-label="Ordenar">' +
      I('arrowUpDown', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="bulk" data-tip="Selecionar" aria-label="Selecionar várias" data-on="' +
      (S.bulk !== null) +
      '">' +
      I('checkCheck', 15) +
      '</button>' +
      '</div></div>';

    var dis = S.bulk && S.bulk.length ? '' : ' disabled';
    var bulkbar =
      S.bulk !== null
        ? '<div class="bulkbar"><span class="bulkbar__count">' +
          S.bulk.length +
          ' selecionada' +
          (S.bulk.length === 1 ? '' : 's') +
          '</span>' +
          '<button class="btn btn--xs btn--secondary" data-act="bulk-folder"' + dis + '>' +
          I('folderInput', 13) +
          'Pasta</button>' +
          '<button class="btn btn--xs btn--secondary" data-act="bulk-transfer"' + dis + '>' +
          I('arrowRightLeft', 13) +
          'Transferir</button>' +
          '<button class="btn btn--xs btn--secondary" data-act="bulk-close"' + dis + '>' +
          I('circleCheck', 13) +
          'Encerrar</button>' +
          '<button class="iconbtn iconbtn--sm" data-act="bulk" style="margin-left:auto" aria-label="Sair da seleção">' +
          I('x', 14) +
          '</button></div>'
        : '';

    /* Fixadas ganham um rótulo só quando existem — e só então o resto ganha
       o dele, para a fronteira entre os dois grupos ficar legível. */
    var pinnedCount = items.filter(function (c) { return c.pinned; }).length;
    var rows = '';
    items.forEach(function (c, i) {
      if (pinnedCount && i === 0) rows += '<div class="conv-group">' + I('pin', 11) + 'Fixadas</div>';
      if (pinnedCount && i === pinnedCount) rows += '<div class="conv-group">Demais conversas</div>';
      rows += convRowHtml(c, i);
    });

    var body = items.length
      ? '<div class="conv-list scroll-slim' +
        (S.enterAnim ? ' stagger' : '') +
        '" role="listbox" aria-label="Conversas">' +
        rows +
        '</div>'
      : '<div class="conv-list scroll-slim">' +
        emptyHtml(
          isFolder ? 'folder' : 'inbox',
          activeFilterCount() || S.search ? 'Nenhuma conversa neste recorte' : isFolder ? 'Pasta vazia' : 'Caixa vazia',
          activeFilterCount() || S.search
            ? 'Os filtros ativos escondem todas as conversas desta caixa.'
            : isFolder
              ? 'Arraste uma conversa para cá, ou use "Mover para pasta" no menu da conversa.'
              : S.view === 'encerrados'
                ? 'O que você encerrar aparece aqui, para consulta.'
                : waiting
                  ? 'Nada com você agora. Há ' + waiting + ' na fila esperando atendimento.'
                  : 'Nada esperando por você aqui.',
          activeFilterCount() || S.search
            ? '<button class="btn btn--sm btn--secondary" data-act="clear-filters">Limpar filtros</button>'
            : ''
        ) +
        '</div>';

    /* "Atender próximo" reproduz o botão Atender do sistema antigo: pega a
       conversa da fila mais crítica e já abre com ela atribuída. Fica no
       TOPO da coluna porque é a primeira decisão do turno. */
    var pickNext =
      waiting > 0 && S.bulk === null && S.view !== 'encerrados'
        ? '<div class="pick-next">' +
          '<button class="btn btn--sm btn--primary btn--full" data-act="next-up">' +
          I('hand', 14) +
          'Atender próximo · ' +
          waiting +
          ' na fila</button></div>'
        : '';

    pane.innerHTML =
      resizerHtml('list', 'right', 'Largura da fila') +
      head +
      pickNext +
      bulkbar +
      filterBarHtml() +
      body;
    S.enterAnim = false;
    var newScroller = $('.conv-list', pane);
    if (newScroller) {
      newScroller.scrollTop = keepScroll;
      /* Navegar com J/K não pode empurrar a seleção para fora da janela. */
      var sel = $('.conv[aria-selected="true"]', newScroller);
      if (sel) {
        var top = sel.offsetTop;
        var bottom = top + sel.offsetHeight;
        if (top < newScroller.scrollTop) newScroller.scrollTop = top - 8;
        else if (bottom > newScroller.scrollTop + newScroller.clientHeight)
          newScroller.scrollTop = bottom - newScroller.clientHeight + 8;
      }
    }
  }

  function emptyHtml(icon, title, msg, action) {
    return (
      '<div class="empty"><div class="empty__icon">' +
      I(icon, 20) +
      '</div><div><p class="empty__title">' +
      esc(title) +
      '</p><p class="empty__msg">' +
      esc(msg) +
      '</p></div>' +
      (action || '') +
      '</div>'
    );
  }

  /* -- Conversa ------------------------------------------------------------ */

  function threadHeadHtml(c) {
    var st = student(c.studentId);
    var sl = sla(c);
    var assignee = c.assignee ? agent(c.assignee) : null;
    var mine = c.assignee === D.ME.id;
    var closed = c.status === 'encerrado';

    /* Visão do atendente: assumir, transferir para uma FILA e encerrar. Não
       há "atribuir para fulano" — quem distribui é a fila, não o colega. */
    var actions = '';
    if (!closed) {
      if (!c.assignee) {
        actions += '<button class="btn btn--sm btn--primary" data-act="claim" data-tip-key="A">' + I('hand', 14) + 'Assumir</button>';
      } else if (mine) {
        actions +=
          '<button class="btn btn--sm btn--ghost" data-act="transfer" data-tip="Transferir para outra fila" data-tip-key="F">' +
          I('arrowRightLeft', 14) +
          'Transferir</button>' +
          '<button class="btn btn--sm btn--secondary" data-act="close-conv" data-tip-key="E">' +
          I('circleCheck', 14) +
          'Encerrar</button>';
      }
    } else if (mine) {
      actions +=
        '<button class="btn btn--sm btn--secondary" data-act="reopen">' + I('rotateCcw', 14) + 'Reabrir</button>';
    }
    actions +=
      '<button class="iconbtn" data-act="more" data-tip="Mais ações" aria-label="Mais ações">' +
      I('more', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="toggle-context" data-tip="' +
      (S.ctxOpen ? 'Ocultar painel' : 'Mostrar painel') +
      '" aria-label="Painel do aluno" data-on="' +
      S.ctxOpen +
      '">' +
      I('panelRight', 15) +
      '</button>';

    var strip = '';
    if (c.ouvidoria) strip += ouvStripHtml(c);
    if (!closed && (sl.state === 'estourado' || sl.state === 'proximo' || (!c.firstResponseAt && c.assignee)))
      strip += slaCalloutHtml(c, sl);

    return (
      '<div class="thread-head"><div class="thread-head__id">' +
      studentAvatar(st, 'md', c.priority === 'urgente' ? 'crit' : null) +
      '<div class="thread-head__text">' +
      '<div class="thread-head__name"><h2>' +
      esc(st.name) +
      '</h2><span class="thread-head__ra">RA ' +
      esc(st.ra) +
      '</span>' +
      (c.pinned ? '<span class="thread-head__pin" data-tip="Fixada no topo">' + I('pin', 12) + '</span>' : '') +
      '</div>' +
      '<div class="thread-head__meta">' +
      '<span class="thread-head__subject" title="' +
      esc(c.subject) +
      '">' +
      esc(c.subject) +
      '</span>' +
      '<span class="thread-head__dot">·</span><span>' +
      esc(queue(c.queue).name) +
      '</span>' +
      (closed
        ? '<span class="thread-head__dot">·</span><span class="status status--quiet">Encerrado ' + relTime(c.closedAt) + '</span>'
        : assignee
          ? mine
            ? ''
            : '<span class="thread-head__dot">·</span><span class="status" data-tone="info"><span class="status__dot"></span>Com ' +
              esc(assignee.name.split(' ')[0]) +
              '</span>'
          : '<span class="thread-head__dot">·</span><span class="status" data-tone="warn" data-solid="true"><span class="status__dot"></span>Na fila</span>') +
      '</div></div></div>' +
      '<div class="thread-head__actions">' +
      actions +
      '</div></div>' +
      (strip ? '<div class="thread-strip">' + strip + '</div>' : '')
    );
  }

  /** Dias úteis entre agora e `ts` — a régua da Ouvidoria é em dias úteis. */
  function businessDays(ts) {
    var d = new Date();
    var end = new Date(ts);
    var n = 0;
    var sign = end >= d ? 1 : -1;
    var cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while ((sign > 0 && cur < last) || (sign < 0 && cur > last)) {
      cur.setDate(cur.getDate() + sign);
      var w = cur.getDay();
      if (w !== 0 && w !== 6) n += sign;
    }
    return n;
  }

  function ouvDeadline(o) {
    var n = businessDays(o.deadline);
    if (n < 0) return { tone: 'crit', label: 'prazo vencido há ' + -n + (n === -1 ? ' dia útil' : ' dias úteis') };
    if (n === 0) return { tone: 'crit', label: 'prazo vence hoje' };
    if (n <= 3) return { tone: 'warn', label: 'prazo em ' + n + (n === 1 ? ' dia útil' : ' dias úteis') };
    return { tone: 'info', label: 'prazo em ' + n + ' dias úteis' };
  }

  /* A faixa da Ouvidoria: protocolo, tipo, etapa e prazo — as quatro coisas
     que o aluno vai perguntar. Clicar abre o histórico completo ao lado. */
  function ouvStripHtml(c) {
    var o = c.ouvidoria;
    var dl = ouvDeadline(o);
    return (
      '<button class="ouv-strip" data-tone="' +
      dl.tone +
      '" data-act="open-ouv-history">' +
      '<span class="ouv-strip__icon">' +
      I('megaphone', 14) +
      '</span>' +
      '<span class="ouv-strip__body"><span class="ouv-strip__title">Ouvidoria · <span class="mono">' +
      esc(o.protocol) +
      '</span> · ' +
      esc(o.type) +
      '</span><span class="ouv-strip__meta">' +
      esc(D.OUV_STAGES[o.stage - 1]) +
      ' · ' +
      esc(o.sector) +
      '</span></span>' +
      '<span class="ouv-strip__deadline">' +
      I('clock', 12) +
      esc(dl.label) +
      '</span>' +
      '<span class="ouv-strip__go">Ver linha do tempo' +
      I('arrowRight', 12) +
      '</span></button>'
    );
  }

  /* A faixa que o sistema antigo resolvia com "Sem resposta do atendente há
     11 min" — aqui ela diz o que fazer, e some quando não há nada a fazer. */
  function slaCalloutHtml(c, sl) {
    var tone = sl.state === 'estourado' ? 'crit' : sl.state === 'proximo' ? 'warn' : 'info';
    var title, text;
    if (sl.state === 'estourado') {
      title = 'SLA estourado há ' + dur(-sl.mins);
      text = 'Esta conversa passou do tempo de resposta acordado para a fila ' + queue(c.queue).name + '.';
    } else if (sl.state === 'proximo') {
      title = 'SLA vence em ' + dur(sl.mins);
      text = 'Responda agora para manter o acordo da fila ' + queue(c.queue).name + '.';
    } else {
      title = 'Sem primeira resposta há ' + dur(Math.round((Date.now() - createdAt(c)) / 60000));
      text = 'O aluno ainda não falou com uma pessoa nesta conversa.';
    }
    return (
      '<div class="callout" data-tone="' +
      tone +
      '"><span class="callout__rail"></span><span class="callout__icon">' +
      I(tone === 'crit' ? 'alertTriangle' : 'clock', 15) +
      '</span><div class="callout__body"><p class="callout__title">' +
      esc(title) +
      '</p><p class="callout__text">' +
      esc(text) +
      '</p></div></div>'
    );
  }

  function msgHtml(m, c, isNew) {
    var isNote = m.from === 'nota';
    var isIn = m.from === 'aluno';
    var st = student(c.studentId);
    var who = isIn ? st : agent(m.authorId) || D.BOT;
    var direction = isNote ? 'note' : isIn ? 'in' : m.from === 'bot' ? 'bot' : 'out';
    var body = withMentions(m.text);

    return (
      '<div class="msg msg--' +
      direction +
      (isNew ? ' msg--new' : '') +
      '">' +
      (isNote ? '' : avatarHtml(who.name, who.initials, 'sm', m.from === 'bot' ? 'bot' : isIn ? null : 'brand', '', isIn ? who.photo : null)) +
      '<div class="msg__col">' +
      (isNote
        ? '<div class="msg__author">' + I('note', 12) + 'Nota interna · ' + esc(who.name) + '</div>'
        : m.from === 'bot'
          ? '<div class="msg__author">' + I('bot', 12) + 'Assistente UniAnchieta</div>'
          : !isIn
            ? '<div class="msg__author">' + esc(who.name) + '</div>'
            : '') +
      '<div class="msg__bubble">' +
      body +
      (m.attachment
        ? '<div style="margin-top:8px"><span class="tag">' + I('paperclip', 11) + esc(m.attachment) + '</span></div>'
        : '') +
      '</div>' +
      '<div class="msg__foot"><span>' +
      clock(m.at) +
      '</span>' +
      (!isIn && !isNote && m.from !== 'bot'
        ? '<span class="msg__read">' + I('checkCheck', 12) + '</span>'
        : '') +
      (m.handoff ? '<span>· transferido para a fila</span>' : '') +
      '</div></div>' +
      '<div class="msg__actions">' +
      '<button class="iconbtn iconbtn--sm" data-act="quote" data-msg="' +
      esc(m.at) +
      '" data-tip="Citar" aria-label="Citar mensagem">' +
      I('cornerUpLeft', 13) +
      '</button>' +
      '<button class="iconbtn iconbtn--sm" data-act="copy-msg" data-msg="' +
      esc(m.at) +
      '" data-tip="Copiar" aria-label="Copiar mensagem">' +
      I('copy', 13) +
      '</button></div></div>'
    );
  }

  function messagesHtml(c) {
    var out = '';
    var lastDay = null;
    c.messages.forEach(function (m) {
      var d = new Date(m.at).toDateString();
      if (d !== lastDay) {
        out += '<div class="daysep"><span>' + esc(dayLabel(m.at)) + '</span></div>';
        lastDay = d;
      }
      out += msgHtml(m, c, S.flashAt === m.at);
    });
    return out;
  }

  function composerHtml(c) {
    if (c.status === 'encerrado') {
      return (
        '<div class="composer"><div class="composer__lock">' +
        '<p><strong>Atendimento encerrado</strong> ' +
        relTime(c.closedAt) +
        (c.rating ? ' · nota ' + c.rating : '') +
        (c.assignee === D.ME.id ? '. Reabra para voltar a responder.' : '.') +
        '</p>' +
        (c.assignee === D.ME.id
          ? '<button class="btn btn--sm btn--secondary" data-act="reopen">' + I('rotateCcw', 14) + 'Reabrir</button>'
          : '') +
        '</div></div>'
      );
    }
    if (!c.assignee) {
      return (
        '<div class="composer"><div class="composer__lock">' +
        '<p><strong>Esta conversa está na fila de ' +
        esc(queue(c.queue).name) +
        '.</strong> Assuma para responder — ela passa para a sua caixa.</p>' +
        '<button class="btn btn--sm btn--primary" data-act="claim">' +
        I('hand', 14) +
        'Assumir</button></div></div>'
      );
    }
    if (c.assignee !== D.ME.id) {
      return (
        '<div class="composer"><div class="composer__lock">' +
        '<p><strong>Em atendimento com ' +
        esc(agent(c.assignee).name.split(' ')[0]) +
        '.</strong> Você pode ler a conversa; quem responde é quem está com ela.</p></div></div>'
      );
    }

    var note = S.composer.mode === 'note';
    return (
      '<div class="composer' +
      (note ? ' composer--note' : '') +
      '"><div class="composer__shell">' +
      '<div class="composer__tabs">' +
      '<div class="seg seg--xs" data-seg="composer">' +
      '<span class="seg__thumb"></span>' +
      '<button class="seg__opt" data-mode="reply" role="tab" aria-selected="' +
      !note +
      '">' +
      I('messageSquare', 12) +
      'Responder</button>' +
      '<button class="seg__opt" data-mode="note" role="tab" aria-selected="' +
      note +
      '">' +
      I('note', 12) +
      'Nota interna</button></div>' +
      (note
        ? '<span class="composer__note-hint">' + I('lock', 12) + 'Só a equipe vê. Use @ para citar alguém.</span>'
        : '') +
      '</div>' +
      '<textarea class="composer__box" id="composer-box" rows="2" placeholder="' +
      (note ? 'Escreva uma nota para a equipe…' : 'Escreva para ' + student(c.studentId).name.split(' ')[0] + '…  (# insere um template)') +
      '">' +
      esc(S.composer.text) +
      '</textarea>' +
      '<div class="composer__tools">' +
      '<button class="iconbtn" data-act="macro" data-tip="Templates" data-tip-key="#" aria-label="Templates">' +
      I('hash', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="attach" data-tip="Anexar arquivo" aria-label="Anexar">' +
      I('paperclip', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="emoji" data-tip="Emoji" aria-label="Emoji">' +
      I('smile', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="ai-compose" data-tip="Assistente de escrita" aria-label="Assistente de escrita">' +
      I('sparkles', 15) +
      '</button>' +
      '<div class="composer__send">' +
      '<button class="btn btn--sm ' +
      (note ? 'btn--ink' : 'btn--primary') +
      '" data-act="send">' +
      (note ? I('note', 14) + 'Salvar nota' : I('send', 14) + 'Enviar') +
      '</button></div></div></div>' +
      '<p class="composer__hint"><b>Enter</b> envia · <b>Shift+Enter</b> quebra linha · <b>#</b> insere template · ' +
      '<button class="linkbtn" data-act="shortcuts" style="font-size:11px;color:var(--ink-4)"><b>?</b> atalhos</button></p></div>'
    );
  }

  function renderThread() {
    var pane = $('#pane-thread');
    if (!pane) return;
    var c = S.selected ? conv(S.selected) : null;
    if (!c) {
      pane.innerHTML =
        '<div class="panehead"><div class="panehead__title"><h2>Conversa</h2></div>' +
        '<div class="panehead__spacer"></div>' +
        '<button class="iconbtn" data-act="toggle-context" data-tip="' +
        (S.ctxOpen ? 'Ocultar painel' : 'Mostrar painel') +
        '" aria-label="Painel do aluno" data-on="' +
        S.ctxOpen +
        '">' +
        I('panelRight', 15) +
        '</button></div>' +
        emptyHtml(
          'messageSquare',
          'Nenhuma conversa aberta',
          'Escolha uma conversa na fila à esquerda, ou use Ctrl+K para buscar um aluno pelo nome ou RA.',
          '<button class="btn btn--sm btn--secondary" data-act="palette">' + I('search', 14) + 'Buscar aluno</button>'
        );
      return;
    }
    /* Trocar de conversa revela o fio novo; responder anima só a bolha nova. */
    var switched = lastThreadId !== c.id;
    lastThreadId = c.id;

    pane.innerHTML =
      threadHeadHtml(c) +
      '<div class="msgs scroll-slim' +
      (switched ? ' msgs--switch' : '') +
      '" id="msgs" role="log" aria-label="Mensagens da conversa com ' +
      esc(student(c.studentId).name) +
      '"><div class="msgs__inner">' +
      messagesHtml(c) +
      '</div></div>' +
      composerHtml(c);
    scrollMessages(false);
    syncSegThumbs(pane);
    var box = $('#composer-box');
    if (box && box.value) autoGrow(box);
    /* A marca de "recém-chegada" é gasta na primeira pintura: um render
       posterior do mesmo fio não pode reanimar uma mensagem antiga. */
    S.flashAt = null;
  }

  var lastThreadId = null;

  function scrollMessages(smooth) {
    var el = $('#msgs');
    if (!el) return;
    if (smooth && el.scrollTo) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  }

  /**
   * Move a pílula azul para o item ativo. É o `layoutId` do Motion escrito à
   * mão: um único nó que se desloca, em vez de um fundo que acende num item e
   * apaga no outro. Na primeira pintura ela NASCE no lugar — deixar a
   * transição ligada a faria voar do topo da lista a cada render.
   */
  function syncNavPill(container, activeSel, pillSel) {
    if (!container) return;
    var pill = $(pillSel, container);
    var active = $(activeSel, container);
    if (!pill) return;
    if (!active || active.offsetParent === null) {
      pill.style.opacity = '0';
      return;
    }
    var first = pill.dataset.init !== '1';
    if (first) pill.style.transition = 'none';
    if (pillSel === '.rail-pill') {
      pill.style.transform = 'translateY(' + active.offsetTop + 'px)';
    } else {
      /* Medido por retângulo, não por offsetTop: um item dentro de uma pasta
         (ou de um grupo) tem outro offsetParent e a pílula pousaria no topo. */
      var cr = container.getBoundingClientRect();
      var ar = active.getBoundingClientRect();
      pill.style.width = ar.width + 'px';
      pill.style.height = ar.height + 'px';
      pill.style.transform =
        'translate(' + (ar.left - cr.left + container.scrollLeft) + 'px,' + (ar.top - cr.top + container.scrollTop) + 'px)';
    }
    pill.style.opacity = '1';
    if (first) {
      void pill.offsetWidth;
      pill.style.transition = '';
      pill.dataset.init = '1';
    }
  }

  /**
   * Re-renderizar a coluna troca a pilula por um no novo, e transicao nao roda
   * em elemento recem-nascido — ela piscaria no destino em vez de deslizar.
   * Estas duas funcoes carregam a posicao antiga para o no novo e forcam um
   * reflow antes de religar a transicao: do ponto de vista do olho, e a MESMA
   * pilula continuando o movimento, que e o que o `layoutId` do Motion faz.
   */
  function snapshotPill(sel) {
    var p = $(sel);
    return p && p.dataset.init === '1'
      ? { t: p.style.transform, w: p.style.width, h: p.style.height, o: p.style.opacity }
      : null;
  }

  function restorePill(sel, snap) {
    var p = $(sel);
    if (!p || !snap) return;
    p.style.transition = 'none';
    p.style.transform = snap.t;
    p.style.width = snap.w;
    p.style.height = snap.h;
    p.style.opacity = snap.o;
    p.dataset.init = '1';
    void p.offsetWidth;
    p.style.transition = '';
  }

  function syncPills() {
    syncNavPill($('#rail-nav'), '.rail__btn[aria-current="page"]', '.rail-pill');
    syncNavPill($('.views__scroll'), '.navitem[aria-current="true"]', '.nav-pill');
  }

  /** A pastilha do segmented é posicionada em JS — é o equivalente do
      `layoutId` do Motion, e por isso ela desliza em vez de piscar. */
  function syncSegThumbs(root) {
    $$('.seg', root || document).forEach(function (seg) {
      var thumb = $('.seg__thumb', seg);
      if (!thumb) return;
      var active = $('[aria-selected="true"]', seg);
      if (!active) {
        thumb.style.opacity = '0';
        return;
      }
      /* Na primeira pintura a pastilha NASCE no lugar. Deixar a transição
         ligada faria ela voar da esquerda toda vez que o painel re-renderiza
         — movimento que não comunica nada, só chama atenção. */
      var first = thumb.dataset.init !== '1';
      if (first) thumb.style.transition = 'none';
      thumb.style.opacity = '1';
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + (active.offsetLeft - 2) + 'px)';
      if (first) {
        void thumb.offsetWidth;
        thumb.style.transition = '';
        thumb.dataset.init = '1';
      }
    });
  }

  /* ======================================================================
     6. PAINEL CONTEXTUAL E COPILOT
     ====================================================================== */

  function accHtml(id, title, badge, body) {
    var open = S.sections[id] !== false;
    return (
      '<section class="acc"><button class="acc__head" data-section="' +
      id +
      '" aria-expanded="' +
      open +
      '">' +
      I('chevronDown', 13, 'acc__chev') +
      '<h3>' +
      esc(title) +
      '</h3>' +
      (badge ? '<span class="acc__badge">' + esc(badge) + '</span>' : '') +
      '</button><div class="acc__body" data-collapsed="' +
      !open +
      '"><div class="acc__inner"><div class="acc__pad">' +
      body +
      '</div></div></div></section>'
    );
  }

  function kv(k, v) {
    return '<div class="kv"><span class="kv__k">' + esc(k) + '</span><span class="kv__v">' + v + '</span></div>';
  }

  function maskedKv(k, id, masked, full) {
    var shown = S.revealed[id];
    return (
      '<div class="kv"><span class="kv__k">' +
      esc(k) +
      '</span><span class="kv__v"><span class="masked"><span class="mono">' +
      esc(shown ? full : masked) +
      '</span><button data-reveal="' +
      id +
      '">' +
      (shown ? 'ocultar' : 'revelar') +
      '</button></span></span></div>'
    );
  }

  function financialTone(st) {
    if (st.financial === 'inadimplente') return { tone: 'crit', label: 'Inadimplente' };
    if (st.financial === 'negociação') return { tone: 'warn', label: 'Em negociação' };
    if (st.financial === 'bolsista') return { tone: 'info', label: 'Bolsista PROUNI' };
    return { tone: 'ok', label: 'Adimplente', quiet: true };
  }
  /**
   * Um veredito só ganha cor quando existe algo a fazer sobre ele. "Formando"
   * e "transferência em análise" são fatos do cadastro, não urgências — eles
   * saem em tinta, para que o vermelho de evasão e o âmbar de DP continuem
   * pulando numa lista de vinte e seis linhas.
   */
  function academicTone(st) {
    if (st.academic === 'risco') return { tone: 'crit', label: 'Risco de evasão' };
    if (st.academic === 'dp') return { tone: 'warn', label: st.dps + ' DP em aberto' };
    if (st.academic === 'formando') return { tone: 'ok', label: 'Formando', quiet: true };
    if (st.academic === 'transferido') return { tone: 'ok', label: 'Transferência em análise', quiet: true };
    return { tone: 'ok', label: 'Situação regular', quiet: true };
  }
  function statusHtml(t) {
    return (
      '<span class="status' +
      (t.quiet ? ' status--quiet' : '') +
      '" data-tone="' +
      t.tone +
      '"' +
      (t.quiet ? '' : ' data-solid="true"') +
      '><span class="status__dot"></span>' +
      esc(t.label) +
      '</span>'
    );
  }

  function historyFor(studentId) {
    var past = D.HISTORY.filter(function (h) {
      return h.studentId === studentId;
    });
    var closed = D.CONVERSATIONS.filter(function (c) {
      return c.studentId === studentId && c.status === 'encerrado';
    }).map(function (c) {
      return {
        id: c.id,
        studentId: c.studentId,
        subject: c.subject,
        channel: c.channel,
        queue: c.queue,
        agent: c.assignee,
        openedAt: createdAt(c),
        closedAt: c.closedAt,
        durationMin: Math.round((c.closedAt - createdAt(c)) / 60000),
        waitMin: 4,
        frtMin: Math.round((c.firstResponseAt - createdAt(c)) / 60000),
        rating: c.rating,
        tags: c.tags,
        summary: c.aiSummary,
        messages: c.messages,
      };
    });
    return closed.concat(past).sort(function (a, b) {
      return b.closedAt - a.closedAt;
    });
  }

  function shortDate(ts) {
    var d = new Date(ts);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  }

  /** Destaca @menções num texto já escapado. */
  function withMentions(text) {
    return esc(text).replace(
      /@([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+(?: [A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+){0,2})/g,
      '<span class="msg__mention">@$1</span>'
    );
  }

  /* ----------------------------------------------------------------------
     O painel direito tem três andares fixos:
       1. abas (Aluno · Copilot · Histórico)
       2. o conteúdo da aba, que rola
       3. as notas internas — ancoradas no rodapé, com rolagem PRÓPRIA.
     Rolar o painel nunca leva as notas embora: elas são a primeira coisa a
     ler ao abrir um atendimento, então não podem depender de rolagem.
     ---------------------------------------------------------------------- */

  var ctxMemo = { id: null, tab: null, scroll: 0, notesScroll: 0 };

  function renderContext() {
    var pane = $('#pane-context');
    if (!pane) return;
    var c = S.selected ? conv(S.selected) : null;
    if (!c) {
      pane.innerHTML =
        resizerHtml('context', 'left', 'Largura do painel do aluno') +
        '<div class="panehead"><div class="panehead__title"><h2>Contexto</h2></div></div>' +
        emptyHtml('user', 'Sem aluno em foco', 'Abra uma conversa para ver o contexto acadêmico e financeiro do aluno aqui.');
      return;
    }
    var st = student(c.studentId);

    /* Re-render no mesmo aluno e na mesma aba preserva as duas rolagens. */
    var oldBody = $('.ctx', pane);
    var oldNotes = $('.notes-dock__list', pane);
    var same = ctxMemo.id === c.id && ctxMemo.tab === S.ctxTab;
    var keep = same && oldBody ? oldBody.scrollTop : 0;
    var keepNotes = ctxMemo.id === c.id && oldNotes ? oldNotes.scrollTop : 0;
    var draft = $('#dock-note', pane);
    if (draft) S.noteDraft = draft.value;
    if (ctxMemo.id !== c.id) S.noteDraft = '';

    var tabs = [
      { id: 'aluno', label: 'Aluno', icon: 'user' },
      { id: 'copilot', label: 'Copilot', icon: 'sparkles' },
      { id: 'historico', label: 'Histórico', icon: 'history' },
    ];
    var head =
      '<div class="panehead"><div class="seg seg--fill" data-seg="ctx" role="tablist">' +
      '<span class="seg__thumb"></span>' +
      tabs
        .map(function (t) {
          return (
            '<button class="seg__opt" data-ctx-tab="' +
            t.id +
            '" role="tab" aria-selected="' +
            (S.ctxTab === t.id) +
            '">' +
            I(t.icon, 12) +
            t.label +
            '</button>'
          );
        })
        .join('') +
      '</div></div>';

    var body =
      S.ctxTab === 'copilot' ? copilotHtml(c, st) : S.ctxTab === 'historico' ? historyPanelHtml(c, st) : studentPanelHtml(c, st);

    pane.innerHTML =
      resizerHtml('context', 'left', 'Largura do painel do aluno') +
      head +
      '<div class="ctx scroll-slim' +
      (same ? '' : ' ctx--enter') +
      '">' +
      body +
      '</div>' +
      notesDockHtml(c, st);
    syncSegThumbs(pane);

    var nb = $('.ctx', pane);
    if (nb) nb.scrollTop = keep;
    var nl = $('.notes-dock__list', pane);
    if (nl) nl.scrollTop = keepNotes;
    var ta = $('#dock-note', pane);
    if (ta && S.noteDraft) {
      ta.value = S.noteDraft;
      autoGrowNote(ta);
    }
    ctxMemo.id = c.id;
    ctxMemo.tab = S.ctxTab;
  }

  /* -- Notas internas (rodapé fixo) ---------------------------------------- */

  function notesFor(c, st) {
    var out = st.notes.map(function (n) {
      return { author: n.author, at: n.at, text: n.text, scope: 'aluno' };
    });
    D.CONVERSATIONS.forEach(function (o) {
      if (o.studentId !== st.id) return;
      o.messages.forEach(function (m) {
        if (m.from === 'nota') out.push({ author: m.authorId, at: m.at, text: m.text, scope: o.id === c.id ? 'conversa' : 'outra', fresh: S.flashAt === m.at });
      });
    });
    return out.sort(function (a, b) {
      return b.at - a.at;
    });
  }

  function notesDockHtml(c, st) {
    var notes = notesFor(c, st);
    var scopeLabel = { aluno: 'ficha do aluno', conversa: 'nesta conversa', outra: 'outra conversa' };
    return (
      '<section class="notes-dock" data-has="' +
      (notes.length > 0) +
      '" aria-label="Notas internas">' +
      '<header class="notes-dock__head">' +
      '<span class="notes-dock__title">' +
      I('note', 13) +
      'Notas internas' +
      (notes.length ? '<span class="notes-dock__count">' + notes.length + '</span>' : '') +
      '</span><span class="notes-dock__hint">' +
      I('lock', 11) +
      'só a equipe vê</span></header>' +
      '<div class="notes-dock__list scroll-slim">' +
      (notes.length
        ? notes
            .map(function (n) {
              var who = agent(n.author) || D.ME;
              return (
                '<article class="note-card' +
                (n.fresh ? ' note-card--new' : '') +
                '"><div class="note-card__meta"><span class="note-card__who">' +
                esc(who.id === D.ME.id ? 'Você' : who.name.split(' ').slice(0, 2).join(' ')) +
                '</span><span class="note-card__when" title="' +
                fullDate(n.at) +
                '">' +
                relTime(n.at) +
                '</span><span class="note-card__scope">' +
                scopeLabel[n.scope] +
                '</span></div><p class="note-card__text">' +
                withMentions(n.text) +
                '</p></article>'
              );
            })
            .join('')
        : '<p class="notes-dock__empty">Nenhuma nota ainda. O que você registrar aqui fica com o aluno e aparece para quem atender depois.</p>') +
      '</div>' +
      '<div class="notes-dock__form">' +
      '<textarea id="dock-note" rows="1" placeholder="Adicionar nota para a equipe…" aria-label="Nova nota interna"></textarea>' +
      '<button class="iconbtn iconbtn--sm notes-dock__send" data-act="dock-note-save" data-tip="Salvar nota (Enter)" aria-label="Salvar nota">' +
      I('send', 13) +
      '</button></div></section>'
    );
  }

  function autoGrowNote(box) {
    box.style.height = 'auto';
    box.style.height = Math.min(96, box.scrollHeight) + 'px';
  }

  function saveDockNote() {
    var c = S.selected ? conv(S.selected) : null;
    var ta = $('#dock-note');
    if (!c || !ta || !ta.value.trim()) return;
    var at = Date.now();
    c.messages.push({ from: 'nota', authorId: D.ME.id, text: ta.value.trim(), at: at });
    S.noteDraft = '';
    ta.value = '';
    S.flashAt = at;
    var list = $('.notes-dock__list');
    if (list) list.scrollTop = 0;
    renderThread();
    scrollMessages(true);
    S.flashAt = at;
    renderContext();
    S.flashAt = null;
    var again = $('#dock-note');
    if (again) again.focus();
    toast('Nota salva para a equipe', { icon: 'note', sub: 'Aparece na conversa e no painel. O aluno não vê.' });
  }

  /* -- Aba Aluno ----------------------------------------------------------- */

  function insightFor(c) {
    var base = D.COPILOT[c.id];
    if (base) return base;
    return {
      need: 'Resolver: ' + c.aiIntent.charAt(0).toLowerCase() + c.aiIntent.slice(1) + '.',
      sentiment: c.priority === 'urgente' ? 'urgente' : c.priority === 'alta' ? 'ansioso' : 'calmo',
      todo: [nextAction(c, student(c.studentId)).split('\n')[0]],
      watch: null,
    };
  }

  var SENTIMENT = {
    calmo: { label: 'Tranquilo', tone: 'ok' },
    satisfeito: { label: 'Satisfeito', tone: 'info' },
    ansioso: { label: 'Ansioso', tone: 'warn' },
    frustrado: { label: 'Frustrado', tone: 'risk' },
    urgente: { label: 'Urgente', tone: 'crit' },
  };

  function ouvStepsHtml(o, compact) {
    return (
      '<ol class="ouv-steps' +
      (compact ? ' ouv-steps--compact' : '') +
      '">' +
      D.OUV_STAGES.map(function (label, i) {
        var state = i + 1 < o.stage ? 'done' : i + 1 === o.stage ? 'now' : 'next';
        return (
          '<li class="ouv-steps__item" data-state="' +
          state +
          '"><span class="ouv-steps__dot">' +
          (state === 'done' ? I('check', 9) : '') +
          '</span><span class="ouv-steps__label">' +
          esc(label) +
          '</span></li>'
        );
      }).join('') +
      '</ol>'
    );
  }

  function studentPanelHtml(c, st) {
    var fin = financialTone(st);
    var aca = academicTone(st);
    var ins = insightFor(c);
    var sen = SENTIMENT[ins.sentiment] || SENTIMENT.calmo;

    var alerts = st.alerts.length
      ? '<div class="stack stack--sm" style="padding:0 16px 14px">' +
        st.alerts
          .map(function (a) {
            return (
              '<div class="callout" data-tone="' +
              a.tone +
              '"><span class="callout__rail"></span><span class="callout__icon">' +
              I(a.tone === 'crit' ? 'alertTriangle' : 'alertCircle', 14) +
              '</span><div class="callout__body"><p class="callout__text" style="margin:0;color:var(--ink-2)">' +
              esc(a.text) +
              '</p></div></div>'
            );
          })
          .join('') +
        '</div>'
      : '';

    var ouv = c.ouvidoria
      ? '<button class="ouv-mini" data-ctx-tab="historico">' +
        '<span class="ouv-mini__top"><span class="ouv-mini__title">' +
        I('megaphone', 13) +
        'Ouvidoria <span class="mono">' +
        esc(c.ouvidoria.protocol) +
        '</span></span><span class="ouv-mini__dl" data-tone="' +
        ouvDeadline(c.ouvidoria).tone +
        '">' +
        esc(ouvDeadline(c.ouvidoria).label) +
        '</span></span>' +
        ouvStepsHtml(c.ouvidoria, true) +
        '</button>'
      : '';

    var fd = c.folder ? folder(c.folder) : null;

    return (
      '<div class="ctx__id">' +
      studentAvatar(st, 'lg', st.academic === 'risco' ? 'crit' : null) +
      '<div><div class="ctx__name">' +
      esc(st.name) +
      '</div><div class="ctx__ra">RA ' +
      esc(st.ra) +
      '</div>' +
      '<div class="ctx__course">' +
      esc(st.course) +
      '<br>' +
      esc(st.modality + ' · ' + st.shift + ' · ' + st.period + 'º período') +
      '</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:2px">' +
      statusHtml(aca) +
      statusHtml(fin) +
      '</div></div>' +
      '<div class="ctx__quick">' +
      '<button class="btn btn--xs btn--secondary" data-act="open-360">' +
      I('user', 13) +
      'Ficha 360</button>' +
      '<button class="iconbtn" data-act="call" data-tip="' +
      esc(st.phone) +
      '" aria-label="Telefone">' +
      I('phone', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="mail" data-tip="Enviar e-mail" aria-label="E-mail">' +
      I('mail', 15) +
      '</button></div>' +
      /* O Copilot já abre dizendo o que o aluno precisa — o atendente não
         precisa trocar de aba para saber por onde começar. */
      '<button class="cp-teaser" data-ctx-tab="copilot">' +
      '<span class="cp-teaser__head">' +
      I('sparkles', 12) +
      'O que o aluno precisa<span class="cp-teaser__sent" data-tone="' +
      sen.tone +
      '"><i></i>' +
      sen.label +
      '</span></span>' +
      '<span class="cp-teaser__need">' +
      esc(ins.need) +
      '</span><span class="cp-teaser__go">Abrir o Copilot' +
      I('arrowRight', 11) +
      '</span></button>' +
      ouv +
      alerts +
      accHtml(
        'atendimento',
        'Este atendimento',
        null,
        kv('Fila', esc(queue(c.queue).name)) +
          kv('Canal', esc(channel(c.channel).name)) +
          kv('Prioridade', esc(c.priority.charAt(0).toUpperCase() + c.priority.slice(1))) +
          kv('Aberta', relTime(createdAt(c))) +
          kv(
            '1ª resposta',
            c.firstResponseAt
              ? '<span class="mono">' + dur(Math.round((c.firstResponseAt - createdAt(c)) / 60000)) + '</span>'
              : '<span style="color:var(--crit-ink)">pendente</span>'
          ) +
          (fd ? kv('Pasta', '<span class="kv-folder">' + I('folder', 12) + esc(fd.name) + '</span>') : '') +
          '<div style="margin-top:10px" class="tagrow">' +
          c.tags
            .map(function (t) {
              return (
                '<span class="tag tag--removable">' +
                esc(t) +
                '<button class="tag__x" data-untag="' +
                esc(t) +
                '" aria-label="Remover marcador">' +
                I('x', 10) +
                '</button></span>'
              );
            })
            .join('') +
          '<button class="tag" data-act="tags" style="color:var(--ink-4)">' +
          I('plus', 10) +
          'marcador</button></div>'
      ) +
      accHtml(
        'academico',
        'Acadêmico',
        st.dps ? st.dps + ' DP' : null,
        kv('Curso', esc(st.course)) +
          kv('Tipo', esc(st.type)) +
          kv('Unidade', esc(st.unit)) +
          kv('Turno', esc(st.shift)) +
          kv('Período', '<span class="mono">' + st.period + 'º</span>') +
          kv('Dependências', '<span class="mono">' + st.dps + '</span>') +
          (st.enrollments.length > 1 ? kv('Matrículas', st.enrollments.map(esc).join('<br>')) : '')
      ) +
      accHtml(
        'financeiro',
        'Financeiro',
        st.balance > 0 ? money(st.balance) : null,
        kv('Situação', statusHtml(fin)) +
          kv('Total em aberto', '<span class="mono"' + (st.balance > 0 ? ' style="color:var(--crit-ink)"' : '') + '>' + money(st.balance) + '</span>') +
          kv('Forma de ingresso', st.financial === 'bolsista' ? 'PROUNI integral' : 'Particular') +
          (st.balance > 0
            ? '<div style="margin-top:10px"><button class="btn btn--xs btn--secondary btn--full" data-act="negotiate">' +
              I('banknote', 13) +
              'Simular renegociação</button></div>'
            : '')
      ) +
      '<div style="padding:14px 16px 4px"><button class="btn btn--xs btn--ghost btn--full" data-act="sync">' +
      I('refresh', 12) +
      'Sincronizado ' +
      relTime(st.syncedAt) +
      '</button></div>'
    );
  }

  /* -- Aba Histórico: tudo o que aconteceu com o aluno, em ordem ---------- */

  function timelineItems(c, st) {
    var items = [];
    var linked = {};
    D.CONVERSATIONS.forEach(function (o) {
      if (o.studentId !== st.id || !o.ouvidoria) return;
      o.ouvidoria.events.forEach(function (ev) {
        if (ev.ref) linked[ev.ref] = true;
        items.push({
          at: ev.at,
          kind: ev.kind,
          title: ev.title,
          body: ev.text,
          meta: o.ouvidoria.protocol,
          history: ev.ref || null,
        });
      });
    });
    historyFor(st.id).forEach(function (h) {
      if (linked[h.id]) return;
      items.push({
        at: h.openedAt,
        kind: 'contato',
        title: h.subject,
        body: h.summary,
        meta: queue(h.queue).name + ' · ' + (h.agent === 'bot' ? 'resolvido pela IA' : (agent(h.agent) || D.BOT).name.split(' ')[0]) + (h.rating ? ' · nota ' + h.rating : ''),
        history: h.id,
      });
    });
    D.CONVERSATIONS.forEach(function (o) {
      if (o.studentId !== st.id || o.status === 'encerrado') return;
      items.push({
        at: createdAt(o),
        kind: o.id === c.id ? 'atual' : 'aberta',
        title: o.id === c.id ? 'Esta conversa começou' : 'Outra conversa em aberto: ' + o.subject,
        body: o.messages[0].text,
        meta: channel(o.channel).name + ' · ' + queue(o.queue).name,
        conv: o.id === c.id ? null : o.id,
      });
      (o.events || []).forEach(function (ev) {
        items.push({ at: ev.at, kind: 'setor', title: ev.title, body: ev.text, meta: 'registro do atendimento' });
      });
    });
    st.notes.forEach(function (n) {
      items.push({ at: n.at, kind: 'nota', title: 'Nota interna · ' + (agent(n.author) || D.ME).name.split(' ').slice(0, 2).join(' '), body: n.text, meta: 'visível só para a equipe' });
    });
    return items.sort(function (a, b) {
      return S.histOrder === 'asc' ? a.at - b.at : b.at - a.at;
    });
  }

  var KIND = {
    ouvidoria: { label: 'Ouvidoria', icon: 'megaphone' },
    setor: { label: 'Setor', icon: 'building' },
    prazo: { label: 'Prazo', icon: 'alertTriangle' },
    aluno: { label: 'Aluno', icon: 'messageCircle' },
    contato: { label: 'Atendimento', icon: 'messageSquare' },
    atual: { label: 'Agora', icon: 'messageSquare' },
    aberta: { label: 'Em aberto', icon: 'messageSquare' },
    nota: { label: 'Nota', icon: 'note' },
  };

  function historyPanelHtml(c, st) {
    var o = c.ouvidoria;
    var items = timelineItems(c, st);
    var card = '';
    if (o) {
      var dl = ouvDeadline(o);
      card =
        '<div class="ouv-card">' +
        '<div class="ouv-card__head"><span class="ouv-card__title">' +
        I('megaphone', 14) +
        'Manifestação de ouvidoria</span><span class="ouv-card__type">' +
        esc(o.type) +
        '</span></div>' +
        '<div class="ouv-card__protocol mono">' +
        esc(o.protocol) +
        '</div>' +
        ouvStepsHtml(o, false) +
        '<dl class="ouv-card__grid">' +
        '<div><dt>Registrada</dt><dd>' +
        shortDate(o.openedAt) +
        ' · ' +
        esc(o.origin) +
        '</dd></div>' +
        '<div><dt>Setor responsável</dt><dd>' +
        esc(o.sector) +
        '</dd></div>' +
        '<div><dt>Prazo final</dt><dd><span class="ouv-card__dl" data-tone="' +
        dl.tone +
        '">' +
        shortDate(o.deadline) +
        ' · ' +
        esc(dl.label) +
        '</span></dd></div>' +
        '<div><dt>Regra</dt><dd>' +
        esc(o.deadlineRule) +
        '</dd></div></dl>' +
        '<button class="btn btn--xs btn--secondary btn--full" data-act="copilot-ouv">' +
        I('sparkles', 12) +
        'Resumir a ouvidoria com o Copilot</button></div>';
    }

    var lastDay = null;
    var rows = items
      .map(function (it) {
        var day = dayLabel(it.at);
        var sep = day !== lastDay ? '<div class="hist-day">' + esc(day) + '</div>' : '';
        lastDay = day;
        var k = KIND[it.kind] || KIND.contato;
        return (
          sep +
          '<div class="hist-item" data-kind="' +
          it.kind +
          '"><span class="hist-item__dot">' +
          I(k.icon, 11) +
          '</span><div class="hist-item__main">' +
          '<div class="hist-item__head"><span class="hist-item__title">' +
          esc(it.title) +
          '</span><span class="hist-item__when">' +
          clock(it.at) +
          '</span></div>' +
          '<p class="hist-item__body">' +
          esc(it.body) +
          '</p>' +
          '<div class="hist-item__meta"><span class="hist-item__kind">' +
          k.label +
          '</span>' +
          (it.meta ? '<span>' + esc(it.meta) + '</span>' : '') +
          (it.history ? '<button class="linkbtn" data-history="' + it.history + '">Ler' + I('arrowRight', 11) + '</button>' : '') +
          (it.conv ? '<button class="linkbtn" data-goto-conv="' + it.conv + '">Abrir' + I('arrowRight', 11) + '</button>' : '') +
          '</div></div></div>'
        );
      })
      .join('');

    return (
      '<div class="hist">' +
      card +
      '<div class="hist__bar"><span class="hist__label">Linha do tempo · ' +
      items.length +
      ' registros</span>' +
      '<div class="seg seg--xs" data-seg="hist"><span class="seg__thumb"></span>' +
      '<button class="seg__opt" data-hist-order="desc" role="tab" aria-selected="' +
      (S.histOrder === 'desc') +
      '">Recentes</button>' +
      '<button class="seg__opt" data-hist-order="asc" role="tab" aria-selected="' +
      (S.histOrder === 'asc') +
      '">Cronológica</button></div></div>' +
      '<div class="hist__list">' +
      (rows || '<p class="notes-dock__empty">Primeiro contato deste aluno.</p>') +
      '</div></div>'
    );
  }

  /* -- Copilot ------------------------------------------------------------- */

  function copilotActions(c) {
    var list = [
      { id: 'sugerir', label: 'Sugerir resposta', icon: 'messageSquare' },
      { id: 'proxima', label: 'Próxima melhor ação', icon: 'target' },
      { id: 'resumo', label: 'Resumir conversa', icon: 'fileText' },
      { id: 'base', label: 'Buscar na base', icon: 'bookOpen' },
      { id: 'similares', label: 'Casos parecidos', icon: 'copy' },
      { id: 'nota-ia', label: 'Redigir nota interna', icon: 'note' },
    ];
    if (c.ouvidoria) {
      list.unshift({ id: 'ouv-resumo', label: 'Resumo da ouvidoria', icon: 'megaphone' });
      list.splice(2, 0, { id: 'ouv-retorno', label: 'Retorno formal', icon: 'scale' });
    }
    return list;
  }

  function askChips(c) {
    if (c.ouvidoria) return ['Qual o prazo da ouvidoria?', 'O que já foi feito até aqui?', 'Ele já reclamou antes?'];
    return ['Ele já teve esse problema antes?', 'Tem pendência financeira?', 'O que eu respondo?'];
  }

  function copilotHtml(c, st) {
    var ins = insightFor(c);
    var sen = SENTIMENT[ins.sentiment] || SENTIMENT.calmo;
    S.todo = S.todo || {};
    var o = c.ouvidoria;

    var chrono = '';
    if (o) {
      chrono =
        '<div class="cp-brief__sec"><div class="cp-brief__k">Linha do tempo resumida</div><ol class="cp-chrono">' +
        o.events
          .map(function (ev) {
            return '<li><span class="mono">' + shortDate(ev.at) + '</span>' + esc(ev.title) + '</li>';
          })
          .join('') +
        '</ol></div>';
    }

    var brief =
      '<section class="cp-brief">' +
      '<div class="cp-brief__head"><span class="cp-brief__title">' +
      I('sparkles', 13) +
      (o ? 'Resumo do caso e da ouvidoria' : 'Resumo do caso') +
      '</span><span class="cp-brief__stamp">gerado agora</span></div>' +
      '<div class="cp-brief__k">O que o aluno precisa</div>' +
      '<p class="cp-brief__need">' +
      esc(ins.need) +
      '</p>' +
      '<div class="cp-brief__chips">' +
      '<span class="cp-sent" data-tone="' +
      sen.tone +
      '"><i></i>' +
      sen.label +
      '</span>' +
      '<span class="cp-intent">' +
      I('zap', 11) +
      esc(c.aiIntent) +
      '</span></div>' +
      '<div class="cp-brief__sec"><div class="cp-brief__k">Contexto</div><p class="cp-brief__text">' +
      esc(c.aiSummary) +
      '</p></div>' +
      chrono +
      '<div class="cp-brief__sec"><div class="cp-brief__k">Para resolver</div><ul class="cp-todo">' +
      ins.todo
        .map(function (t, i) {
          var done = !!S.todo[c.id + ':' + i];
          return (
            '<li><button class="cp-todo__item" data-todo="' +
            i +
            '" aria-pressed="' +
            done +
            '">' +
            I(done ? 'circleCheck' : 'circle', 14) +
            '<span>' +
            esc(t) +
            '</span></button></li>'
          );
        })
        .join('') +
      '</ul></div>' +
      (ins.watch
        ? '<div class="cp-watch">' + I('alertCircle', 13) + '<span>' + esc(ins.watch) + '</span></div>'
        : '') +
      '<div class="cp-brief__foot"><button class="btn btn--xs btn--primary" data-copilot="sugerir">' +
      I('messageSquare', 12) +
      'Sugerir resposta</button>' +
      (o
        ? '<button class="btn btn--xs btn--secondary" data-copilot="ouv-retorno">' + I('scale', 12) + 'Retorno formal</button>'
        : '<button class="btn btn--xs btn--secondary" data-copilot="proxima">' + I('target', 12) + 'Próxima ação</button>') +
      '</div></section>';

    var result = '';
    if (S.copilot.title) {
      result =
        '<div class="copilot__result" id="copilot-result"><div class="copilot__result-head">' +
        I('sparkles', 12) +
        esc(S.copilot.title) +
        '</div><div class="copilot__result-body" id="copilot-body">' +
        S.copilot.body +
        (S.copilot.running ? '<span class="copilot__caret"></span>' : '') +
        '</div>' +
        (S.copilot.chips && !S.copilot.running
          ? '<div class="copilot__chips">' +
            S.copilot.chips
              .map(function (ch) {
                return '<span class="tag">' + esc(ch) + '</span>';
              })
              .join('') +
            '</div>'
          : '') +
        (S.copilot.insert && !S.copilot.running
          ? '<div class="copilot__result-foot"><button class="btn btn--xs btn--primary" data-act="copilot-insert">' +
            I('arrowRight', 13) +
            (S.copilot.insertMode === 'note' ? 'Usar como nota' : 'Inserir no composer') +
            '</button><button class="btn btn--xs btn--ghost" data-act="copilot-dismiss">Descartar</button></div>'
          : S.copilot.running
            ? ''
            : '<div class="copilot__result-foot"><button class="btn btn--xs btn--ghost" data-act="copilot-dismiss">Fechar</button></div>') +
        '</div>';
    }

    var ask =
      '<section class="cp-ask">' +
      '<div class="cp-ask__field">' +
      I('sparkles', 13) +
      '<input id="copilot-ask" placeholder="Pergunte sobre este aluno…" autocomplete="off" value="' +
      esc(S.ask.q) +
      '"><button class="iconbtn iconbtn--sm" data-act="copilot-ask" aria-label="Perguntar">' +
      I('send', 13) +
      '</button></div>' +
      (S.ask.a || S.ask.running
        ? '<div class="cp-ask__answer" id="copilot-ask-answer">' + S.ask.a + (S.ask.running ? '<span class="copilot__caret"></span>' : '') + '</div>'
        : '<div class="cp-ask__chips">' +
          askChips(c)
            .map(function (q) {
              return '<button class="chip chip--sm" data-ask="' + esc(q) + '">' + esc(q) + '</button>';
            })
            .join('') +
          '</div>') +
      '</section>';

    return (
      '<div class="copilot">' +
      brief +
      result +
      ask +
      '<div class="cp-sec"><div class="cp-sec__title">Ações</div><div class="copilot__grid">' +
      copilotActions(c)
        .map(function (a) {
          return '<button class="copilot__action" data-copilot="' + a.id + '">' + I(a.icon, 14) + esc(a.label) + '</button>';
        })
        .join('') +
      '</div></div>' +
      '<div class="cp-sec"><div class="cp-sec__title">Ajustar o que você escreveu</div>' +
      '<div class="copilot__grid">' +
      [
        { id: 'empatia', label: 'Mais empática', icon: 'smile' },
        { id: 'curta', label: 'Mais curta', icon: 'minus' },
        { id: 'formal', label: 'Mais formal', icon: 'fileText' },
        { id: 'revisar', label: 'Corrigir texto', icon: 'check' },
      ]
        .map(function (a) {
          return '<button class="copilot__action" data-copilot="' + a.id + '">' + I(a.icon, 14) + esc(a.label) + '</button>';
        })
        .join('') +
      '</div></div>' +
      '<p class="copilot__intro">O Copilot lê a conversa, o cadastro, o histórico e a ouvidoria. Nada é enviado sem você revisar.</p>' +
      '</div>'
    );
  }

  /** Resultados simulados — texto derivado do caso real da conversa. */
  function copilotRun(id, c) {
    var st = student(c.studentId);
    var first = st.name.split(' ')[0];
    var out = { title: '', text: '', chips: null, insert: null, insertMode: 'reply' };
    var o = c.ouvidoria;
    var hist = historyFor(st.id);

    switch (id) {
      case 'resumo':
        out.title = 'Resumo da conversa';
        out.text =
          c.aiSummary +
          '\n\nMensagens: ' +
          c.messages.length +
          ' · Aberta há ' +
          dur(Math.round((Date.now() - createdAt(c)) / 60000)) +
          (c.firstResponseAt ? ' · 1ª resposta em ' + dur(Math.round((c.firstResponseAt - createdAt(c)) / 60000)) : ' · sem 1ª resposta');
        out.chips = c.tags.concat([queue(c.queue).name]);
        break;
      case 'ouv-resumo':
        out.title = 'Resumo da ouvidoria · ' + o.protocol;
        out.text =
          o.type + ' registrada em ' + shortDate(o.openedAt) + ' (' + o.origin.toLowerCase() + '), hoje na etapa "' +
          D.OUV_STAGES[o.stage - 1] + '" com ' + o.sector + '. ' + ouvDeadline(o).label.charAt(0).toUpperCase() + ouvDeadline(o).label.slice(1) + ' (' + shortDate(o.deadline) + ').\n\n' +
          'Em ordem:\n' +
          o.events
            .map(function (ev) {
              return '• ' + shortDate(ev.at) + ' — ' + ev.title + ': ' + ev.text;
            })
            .join('\n') +
          '\n\nO que o aluno precisa agora: ' + insightFor(c).need;
        out.chips = [o.protocol, o.type, o.sector];
        break;
      case 'ouv-retorno':
        out.title = 'Retorno formal ao manifestante';
        out.text = formalReply(c, st, first);
        out.insert = out.text;
        break;
      case 'intencao':
        out.title = 'Intenção detectada';
        out.text = c.aiIntent + '\n\nConfiança alta. A classificação usa o texto do aluno, a fila de origem e o histórico de ' + hist.length + ' conversas anteriores deste RA.';
        out.chips = [queue(c.queue).name, 'Prioridade ' + c.priority];
        break;
      case 'sugerir':
        out.title = 'Resposta sugerida';
        out.text = suggestReply(c, st, first);
        out.insert = out.text;
        break;
      case 'proxima':
        out.title = 'Próxima melhor ação';
        out.text = nextAction(c, st);
        break;
      case 'nota-ia':
        out.title = 'Nota interna sugerida';
        out.text =
          'Atendimento ' + (o ? 'da ouvidoria ' + o.protocol : 'de ' + c.aiIntent.toLowerCase()) + '. ' +
          insightFor(c).need + ' Próximo passo: ' + insightFor(c).todo[0].toLowerCase() + '.' +
          (insightFor(c).watch ? ' Atenção: ' + insightFor(c).watch : '');
        out.insert = out.text;
        out.insertMode = 'note';
        break;
      case 'base':
        out.title = 'Da base de conhecimento';
        out.text = o
          ? 'Procedimento: "Atendimento de manifestação de ouvidoria".\n\n1. Nunca pedir ao aluno que repita o relato — ele já está no protocolo.\n2. Dar uma data concreta, mesmo que seja a data do próximo retorno.\n3. Registrar cada contato como nota, citando a Ouvidoria (@Helena Martins Castro).\n4. Encerrar só depois que o aluno confirmar que o assunto foi resolvido.\n\nPrazo legal de resposta: ' + o.deadlineRule + '.'
          : 'Artigo: "' + c.aiIntent + '" — procedimento vigente para ' + queue(c.queue).name + '.\n\n1. Confirmar RA e identidade do aluno.\n2. Verificar bloqueios no acadêmico e no financeiro.\n3. Abrir protocolo na fila responsável.\n4. Informar o prazo oficial e registrar a nota interna.\n\nÚltima revisão: há 12 dias, por Coordenação de Atendimento.';
        out.chips = ['Procedimento interno', queue(c.queue).name];
        break;
      case 'similares':
        out.title = 'Casos parecidos';
        var sim = D.CONVERSATIONS.filter(function (x) {
          return x.id !== c.id && x.queue === c.queue;
        }).slice(0, 3);
        out.text = sim.length
          ? sim
              .map(function (x) {
                return '• ' + x.subject + ' — ' + student(x.studentId).name + ' (' + relTime(updatedAt(x)) + ')';
              })
              .join('\n') + '\n\nTodos seguiram o procedimento da fila ' + queue(c.queue).name + '.'
          : 'Nenhuma conversa parecida nas últimas semanas.';
        break;
      case 'empatia':
        out.title = 'Versão mais empática';
        out.text = S.composer.text ? empathize(S.composer.text, first) : 'Escreva algo no composer primeiro — eu reescrevo em cima do seu texto, não do zero.';
        out.insert = S.composer.text ? out.text : null;
        break;
      case 'curta':
        out.title = 'Versão mais curta';
        out.text = S.composer.text ? S.composer.text.split(/(?<=\.)\s+/).slice(0, 2).join(' ').slice(0, 260) : 'Não há texto no composer para encurtar.';
        out.insert = S.composer.text ? out.text : null;
        break;
      case 'formal':
        out.title = 'Versão mais formal';
        out.text = S.composer.text
          ? 'Prezado(a) ' + first + ',\n\n' + S.composer.text.replace(/^(oi|olá|ei)[,!]?\s*/i, '') + '\n\nAtenciosamente,\n' + D.ME.name + ' — ' + D.ME.role
          : 'Não há texto no composer para ajustar.';
        out.insert = S.composer.text ? out.text : null;
        break;
      case 'revisar':
        out.title = 'Texto revisado';
        out.text = S.composer.text
          ? S.composer.text.replace(/\bvc\b/gi, 'você').replace(/\bpq\b/gi, 'porque').replace(/\bpf\b/gi, 'por favor').replace(/\bta\b/gi, 'está').replace(/\bmatricula\b/gi, 'matrícula').replace(/\bhistorico\b/gi, 'histórico')
          : 'Não há texto no composer para revisar.';
        out.insert = S.composer.text ? out.text : null;
        break;
    }
    return out;
  }

  /* Respostas escritas para o caso — não para a fila. É a diferença entre um
     Copilot que ajuda e um que só preenche saudação. */
  var REPLY_BY_CONV = {
    c21: function (f) {
      return 'Oi, ' + f + '. Peço desculpas: você não deveria ter precisado voltar aqui três vezes pelo mesmo assunto.\n\nAgora tenho uma resposta concreta. O Financeiro confirmou o pagamento em duplicidade e aprovou o estorno de R$ 389,00. Ele entra no lote bancário desta sexta-feira (03/10) e o crédito cai em até 2 dias úteis na mesma conta/cartão do pagamento.\n\nNa segunda-feira eu volto a falar com você para confirmar que o dinheiro chegou — e só então a sua manifestação na Ouvidoria (OUV-2026-0412) é concluída.';
    },
    c22: function (f) {
      return 'Oi, ' + f + '! Tenho novidade sobre a reposição.\n\nA coordenação propôs 3 encontros de reposição das aulas práticas, aos sábados, a partir de 11/10 — todos com intérprete de Libras. A proposta será confirmada por escrito até amanhã, e eu te mando aqui as datas e os horários assim que chegar.\n\nO intérprete nas aulas regulares começa na segunda, 06/10.';
    },
    c23: function (f) {
      return 'Boa noite, ' + f + '. Estou com a sua manifestação (OUV-2026-0431) e vou acompanhar pessoalmente.\n\nSe você tiver a ata da banca em PDF ou foto, pode anexar aqui mesmo — assim eu envio junto à coordenação, com a Ouvidoria em cópia, ainda hoje.\n\nTe dou um retorno até amanhã às 18h, com a posição da coordenação sobre a correção da nota. Sei que a colação está próxima e isso é prioridade.';
    },
    c24: function (f) {
      return 'Oi, ' + f + '! Chegou sim 🙂\n\nO seu elogio foi encaminhado à coordenação do EAD e à própria tutora Simone. Esse tipo de retorno faz muita diferença para a equipe — obrigada por ter tirado um tempo para escrever.\n\nBons estudos, e conte com a gente no que precisar!';
    },
    c09: function (f) {
      return 'Oi, ' + f + '. Obrigada por me contar o motivo — isso muda o que eu posso fazer por você.\n\nAntes de falar de trancamento, quero te mostrar duas opções: parcelar o valor em aberto em até 6x sem juros e verificar se você tem direito a algum desconto ou bolsa para o próximo semestre. Assim você não perde o semestre que já cursou.\n\nPosso simular agora? Se mesmo assim preferir trancar, eu te explico o prazo e o passo a passo.';
    },
    c14: function (f) {
      return 'Boa tarde, ' + f + '. Sinto muito pela perda do emprego — vamos encontrar um caminho.\n\nConsigo um acordo para o valor em aberto com entrada reduzida e parcelas que caibam no seu momento. Fechando o acordo, a suspensão da matrícula é cancelada.\n\nQuanto você consegue pagar por mês, mais ou menos? Com isso eu já monto a proposta aqui.';
    },
  };

  function suggestReply(c, st, first) {
    if (REPLY_BY_CONV[c.id]) return REPLY_BY_CONV[c.id](first);
    var base = {
      financeiro:
        'Oi, ' + first + '! Localizei sua mensalidade aqui.\n\nO erro no portal acontece quando o título já foi reemitido com a multa. Eu gerei uma segunda via atualizada, com vencimento para daqui a 3 dias úteis, e vou anexar o PDF nesta conversa.\n\nSe preferir parcelar o valor em aberto, também consigo simular aqui mesmo. Quer que eu faça?',
      secretaria:
        'Oi, ' + first + '! Já verifiquei seu cadastro.\n\nVou abrir a solicitação na Secretaria Acadêmica agora e te passo o número do protocolo ainda hoje. O prazo de análise é de até 5 dias úteis, e o retorno chega por aqui e no seu e-mail.\n\nPrecisa que eu adiante alguma coisa com a coordenação enquanto isso?',
      estagios:
        'Oi, ' + first + '! Recebi sua solicitação.\n\nVou protocolar o documento junto ao setor de Estágios e te aviso assim que sair. Enquanto isso, confirme comigo se os dados da concedente estão corretos — qualquer divergência trava a assinatura.',
      coordenacao:
        'Oi, ' + first + '! Consultei a coordenação do seu curso.\n\nVou confirmar a informação e te retorno por aqui ainda hoje. Se houver mudança de data ou de oferta, você é avisado por esta mesma conversa, sem precisar recomeçar.',
      suporte:
        'Oi, ' + first + '! Abri um chamado com o time de sistemas para liberar seu acesso.\n\nA previsão é de até 4 horas úteis. Sobre o prazo da atividade: eu registro na sua ocorrência que a falha foi do nosso lado, então a entrega não fica prejudicada.',
      'pos-ead':
        'Oi, ' + first + '! Verifiquei a sua matrícula na optativa.\n\nA escolha está registrada, mas a liberação no AVA ficou pendente. Já solicitei a sincronização manual — costuma entrar em até 24h e eu te aviso por aqui quando estiver disponível.',
      ouvidoria:
        'Oi, ' + first + '! Estou acompanhando o seu protocolo junto à Ouvidoria e já tenho uma posição do setor responsável. Te explico abaixo o que foi feito e qual é o próximo passo.',
    };
    return base[c.queue] || base.secretaria;
  }

  function formalReply(c, st, first) {
    var o = c.ouvidoria;
    return (
      'Prezado(a) ' + st.name + ',\n\n' +
      'Em atenção à sua manifestação registrada sob o protocolo ' + o.protocol + ' em ' + shortDate(o.openedAt) + ', informamos que o caso foi analisado pelo setor responsável (' + o.sector + ').\n\n' +
      (REPLY_BY_CONV[c.id] ? REPLY_BY_CONV[c.id](first).split('\n\n').slice(1, 2).join('') + '\n\n' : '') +
      'Permanecemos à disposição por este canal. A manifestação será concluída após a sua confirmação de que a demanda foi atendida.\n\n' +
      'Atenciosamente,\n' + D.ME.name + ' — Central de Atendimento UniAnchieta, em nome da Ouvidoria'
    );
  }

  function nextAction(c, st) {
    if (c.ouvidoria) {
      var dl = ouvDeadline(c.ouvidoria);
      return 'Responder com data concreta e registrar para a Ouvidoria.\n\nA manifestação ' + c.ouvidoria.protocol + ' está em "' + D.OUV_STAGES[c.ouvidoria.stage - 1] + '", ' + dl.label + '. Envie a resposta ao aluno, depois deixe uma nota citando @Helena Martins Castro com o que foi informado — é assim que a Ouvidoria consegue concluir no prazo.';
    }
    if (st.academic === 'risco')
      return 'Oferecer renegociação antes de processar o pedido.\n\nO aluno tem ' + money(st.balance) + ' em aberto e sinalizou dificuldade financeira. Casos parecidos que receberam proposta de parcelamento na primeira resposta tiveram 3x menos evasão.';
    if (!c.assignee) return 'Assumir a conversa.\n\nEla está há ' + dur(Math.round((Date.now() - createdAt(c)) / 60000)) + ' na fila de ' + queue(c.queue).name + ' e o SLA ' + (sla(c).state === 'estourado' ? 'já estourou' : 'vence em ' + dur(sla(c).mins)) + '.';
    if (!c.firstResponseAt) return 'Enviar a primeira resposta agora.\n\nO aluno ainda não falou com uma pessoa. Uma primeira resposta, mesmo sem a solução final, reduz em 40% a chance de ele reabrir o assunto por outro canal.';
    if (st.balance > 0) return 'Registrar a pendência financeira na conversa.\n\nO aluno tem ' + money(st.balance) + ' em aberto, o que pode bloquear a solicitação atual. Vale avisar antes que ele descubra sozinho no portal.';
    return 'Confirmar o prazo e encerrar.\n\nO assunto já foi respondido e não há pendência no cadastro. Encerre com o template de encerramento cordial para liberar a fila.';
  }

  function empathize(text, first) {
    return (
      'Oi, ' +
      first +
      '! Entendo perfeitamente a sua preocupação, e vou cuidar disso com você.\n\n' +
      text.replace(/^(oi|olá|ei)[,!]?\s*/i, '').replace(/^\w/, function (m) { return m.toUpperCase(); }) +
      '\n\nQualquer dúvida no caminho, é só me chamar por aqui que eu retomo de onde paramos.'
    );
  }

  /** Perguntas livres ao Copilot — respondidas a partir dos dados do aluno. */
  function answerQuestion(q, c, st) {
    var k = key(q);
    var o = c.ouvidoria;
    var hist = historyFor(st.id);
    if (/prazo|quando|vence/.test(k)) {
      if (o) return 'O prazo final da manifestação ' + o.protocol + ' é ' + shortDate(o.deadline) + ' (' + ouvDeadline(o).label + '). Regra: ' + o.deadlineRule + '. O SLA desta conversa ' + (sla(c).state === 'estourado' ? 'já estourou' : 'vence em ' + dur(sla(c).mins)) + '.';
      return 'O SLA desta conversa ' + (sla(c).state === 'estourado' ? 'estourou há ' + dur(-sla(c).mins) : 'vence em ' + dur(sla(c).mins)) + ' (fila ' + queue(c.queue).name + ').';
    }
    if (/feito|ja foi|andamento|aconteceu/.test(k) && o) {
      return o.events
        .map(function (ev) {
          return shortDate(ev.at) + ' — ' + ev.title + '.';
        })
        .join('\n');
    }
    if (/antes|ja teve|reclamou|historico|anterior|outra vez/.test(k)) {
      if (!hist.length) return 'Não. Esta é a primeira conversa registrada deste RA.';
      return 'Sim, ' + hist.length + (hist.length === 1 ? ' atendimento anterior' : ' atendimentos anteriores') + ':\n' +
        hist
          .slice(0, 4)
          .map(function (h) {
            return '• ' + shortDate(h.openedAt) + ' — ' + h.subject + (h.rating ? ' (nota ' + h.rating + ')' : '');
          })
          .join('\n') +
        (hist.some(function (h) { return h.rating && h.rating <= 5; }) ? '\n\nAtenção: há avaliação baixa no histórico.' : '');
    }
    if (/debito|financeir|deve|pagamento|boleto|divida/.test(k)) {
      return st.balance > 0
        ? financialTone(st).label + ': ' + money(st.balance) + ' em aberto. Vale oferecer renegociação antes de qualquer bloqueio.'
        : 'Não há débito em aberto. Situação: ' + financialTone(st).label.toLowerCase() + '.';
    }
    if (/nota|observa|registr/.test(k)) {
      var ns = notesFor(c, st);
      return ns.length ? ns.length + ' notas internas. A mais recente (' + relTime(ns[0].at) + '): "' + ns[0].text.slice(0, 160) + (ns[0].text.length > 160 ? '…' : '') + '"' : 'Nenhuma nota interna sobre este aluno.';
    }
    if (/respond|dizer|escrev|falar/.test(k)) return suggestReply(c, st, st.name.split(' ')[0]);
    if (/ouvidoria|protocolo/.test(k)) return o ? 'Manifestação ' + o.protocol + ' (' + o.type.toLowerCase() + '), etapa "' + D.OUV_STAGES[o.stage - 1] + '", setor ' + o.sector + '.' : 'Este aluno não tem manifestação de ouvidoria aberta.';
    return 'Pelo que li na conversa e no cadastro: ' + insightFor(c).need + ' O próximo passo sugerido é: ' + insightFor(c).todo[0].toLowerCase() + '.';
  }

  /** Escrita simulada, reaproveitada pelas ações e pela pergunta livre. */
  function typeInto(text, onStep, onDone) {
    var i = 0;
    var step = Math.max(3, Math.round(text.length / 42));
    var timer = setInterval(function () {
      i += step;
      onStep(esc(text.slice(0, i)).replace(/\n/g, '<br>'));
      if (i >= text.length) {
        clearInterval(timer);
        onDone(esc(text).replace(/\n/g, '<br>'));
      }
    }, 18);
  }

  function askCopilot(q) {
    var c = S.selected ? conv(S.selected) : null;
    if (!c || !q.trim()) return;
    var text = answerQuestion(q, c, student(c.studentId));
    S.ask = { q: q, a: '', running: true };
    renderContext();
    typeInto(
      text,
      function (html) {
        S.ask.a = html;
        var el = $('#copilot-ask-answer');
        if (el) el.innerHTML = html + '<span class="copilot__caret"></span>';
      },
      function (html) {
        S.ask = { q: q, a: html, running: false };
        renderContext();
      }
    );
  }

  /* ======================================================================
     7. DASHBOARD
     ====================================================================== */

  /**
   * Invariante nº1 dos gráficos (DESIGN_SYSTEM §11): MEDIR O CONTÊINER antes
   * de desenhar, e descartar a medição zero do meio de um reflow — senão o
   * SVG desmonta e a animação recomeça a cada resize.
   */
  function mountChart(el, draw) {
    if (!el) return;
    var last = 0;
    function run() {
      var w = el.clientWidth;
      if (w > 0) last = w;
      if (last > 0) el.innerHTML = draw(last);
    }
    run();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        var w = el.clientWidth;
        if (w > 0 && Math.abs(w - last) > 4) {
          last = w;
          el.innerHTML = draw(last);
        }
      });
      ro.observe(el);
    }
  }

  /** Ticks redondos: um eixo que termina em 34 obriga a ler cada rótulo. */
  function niceMax(v) {
    var step = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var n = v / step;
    var mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return mult * step;
  }

  function columnChartSvg(w, data) {
    var h = 208;
    var padL = 30;
    var padB = 22;
    var padT = 8;
    var iw = Math.max(40, w - padL - 6);
    var ih = h - padB - padT;
    var max = niceMax(
      Math.max.apply(
        null,
        data.map(function (d) {
          return Math.max(d.abertos, d.finalizados);
        })
      )
    );
    var slot = iw / data.length;
    var bw = Math.max(2, Math.min(14, slot * 0.32));
    /* Com 30 colunas, rotular todas vira borrão: mostra um rótulo a cada N. */
    var every = Math.ceil(data.length / 12);
    var out = '<svg class="chart" width="' + w + '" height="' + h + '" role="img" aria-label="Atendimentos abertos e finalizados pela equipe">';
    [0, 0.5, 1].forEach(function (t) {
      var y = padT + ih - ih * t;
      out +=
        '<line class="chart__grid" x1="' + padL + '" y1="' + y + '" x2="' + (padL + iw) + '" y2="' + y + '"/>' +
        '<text x="' + (padL - 7) + '" y="' + (y + 3) + '" text-anchor="end">' + Math.round(max * t) + '</text>';
    });
    data.forEach(function (d, i) {
      var cx = padL + slot * i + slot / 2;
      var he = Math.max(2, (d.abertos / max) * ih);
      var hr = Math.max(2, (d.finalizados / max) * ih);
      out +=
        '<g class="chart__col"><title>' + d.label + ' — ' + d.abertos + ' abertos, ' + d.finalizados + ' finalizados</title>' +
        '<rect class="chart__hover" x="' + (cx - slot / 2) + '" y="' + padT + '" width="' + slot + '" height="' + ih + '" rx="4"/>' +
        '<rect x="' + (cx - bw - 1) + '" y="' + (padT + ih - he) + '" width="' + bw + '" height="' + he + '" rx="2" fill="var(--brand)" style="animation-delay:' + Math.min(i, 20) * 30 + 'ms"/>' +
        '<rect x="' + (cx + 1) + '" y="' + (padT + ih - hr) + '" width="' + bw + '" height="' + hr + '" rx="2" fill="var(--ink-4)" style="animation-delay:' + (Math.min(i, 20) * 30 + 60) + 'ms"/>' +
        (i % every === 0 ? '<text x="' + cx + '" y="' + (h - 6) + '" text-anchor="middle">' + d.k + '</text>' : '') +
        '</g>';
    });
    return out + '</svg>';
  }

  function sparkSvg(w, series, tone) {
    var h = 44;
    var max = Math.max.apply(null, series);
    var min = Math.min.apply(null, series);
    var span = max - min || 1;
    var pts = series.map(function (v, i) {
      return [(i / (series.length - 1)) * (w - 4) + 2, h - 4 - ((v - min) / span) * (h - 10)];
    });
    var d = pts
      .map(function (p, i) {
        return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      })
      .join(' ');
    return (
      '<svg class="chart" width="' + w + '" height="' + h + '" aria-hidden="true">' +
      '<path class="chart__spark" d="' + d + '"' + (tone ? ' stroke="' + tone + '"' : '') + '/>' +
      '<circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="2.5" fill="var(--ink-2)"/></svg>'
    );
  }

  function barListHtml(rows) {
    var max = Math.max.apply(
      null,
      rows.map(function (r) {
        return r.value;
      })
    );
    var total = rows.reduce(function (a, r) {
      return a + r.value;
    }, 0);
    return (
      '<div class="barlist">' +
      rows
        .map(function (r) {
          return (
            '<div class="barlist__row"><span class="barlist__fill" style="width:' +
            ((r.value / max) * 100).toFixed(1) +
            '%"></span><span class="barlist__label">' +
            esc(r.label) +
            '</span><span class="barlist__value">' +
            r.value +
            '</span><span class="barlist__pct">' +
            Math.round((r.value / total) * 100) +
            '%</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  /* -- Dados do período ----------------------------------------------------- */

  function dayKey(offset) {
    var d = new Date(Date.now() - offset * 86400000);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  }

  function dailySeries(src, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var off = n - 1 - i;
      out.push({ k: dayKey(off), label: dayKey(off), abertos: src.abertos[i % src.abertos.length], finalizados: src.finalizados[i % src.finalizados.length], eu: src.eu[i % src.eu.length] });
    }
    return out;
  }

  /** Período personalizado: escala a média diária dos últimos 30 dias, com
      variação determinística — o mesmo intervalo sempre dá o mesmo número. */
  function customPeriod(range) {
    var base = D.DASHBOARD.periods['30d'];
    var from = new Date(range.from + 'T00:00:00');
    var to = new Date(range.to + 'T00:00:00');
    var days = Math.max(1, Math.round((to - from) / 86400000) + 1);
    var f = days / 30;
    var j = 1 + (Math.sin(days * 2.3) * 0.06);
    function scale(o, isTeam) {
      return {
        abertos: Math.max(1, Math.round(o.abertos * f * j)),
        finalizados: Math.max(1, Math.round(o.finalizados * f * j * 0.99)),
        transferidos: Math.max(0, Math.round(o.transferidos * f * (2 - j))),
        tma: +(o.tma * (2 - j)).toFixed(1),
        tmr: +(o.tmr * (2 - j)).toFixed(1),
        csat: +Math.min(10, o.csat * (j > 1 ? 1.01 : 0.99)).toFixed(1),
        sla: isTeam ? Math.round(o.sla * (j > 1 ? 1.01 : 0.99)) : undefined,
      };
    }
    var src = { abertos: [], finalizados: [], eu: [] };
    for (var i = 0; i < days; i++) {
      var w = Math.sin((i + days) * 1.7) * 0.5 + Math.cos((i + days) * 0.6) * 0.5;
      src.abertos.push(Math.round(113 + 26 * w));
      src.finalizados.push(Math.round(106 + 24 * w * 0.9));
      src.eu.push(Math.max(1, Math.round(11 + 4 * w)));
    }
    var ser = [];
    for (var k = 0; k < days; k++) {
      var d = new Date(from.getTime() + k * 86400000);
      var lab = pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
      ser.push({ k: lab, label: lab, abertos: src.abertos[k], finalizados: src.finalizados[k], eu: src.eu[k] });
    }
    /* Mais de 31 dias: agrupa por semana, senão o gráfico vira um pente. */
    if (days > 31) {
      var wk = [];
      for (var x = 0; x < ser.length; x += 7) {
        var chunk = ser.slice(x, x + 7);
        wk.push({
          k: chunk[0].k,
          label: 'Semana de ' + chunk[0].k,
          abertos: chunk.reduce(function (a, r) { return a + r.abertos; }, 0),
          finalizados: chunk.reduce(function (a, r) { return a + r.finalizados; }, 0),
          eu: chunk.reduce(function (a, r) { return a + r.eu; }, 0),
        });
      }
      ser = wk;
    }
    return {
      label: shortDate(from) + ' – ' + shortDate(to),
      unit: days > 31 ? 'semana' : 'dia',
      days: days,
      me: scale(base.me),
      mePrev: scale(base.mePrev),
      team: scale(base.team, true),
      teamPrev: scale(base.teamPrev, true),
      series: ser,
    };
  }

  function periodData() {
    if (S.dashPeriod === 'custom' && S.dashRange) return customPeriod(S.dashRange);
    var p = D.DASHBOARD.periods[S.dashPeriod];
    var out = {};
    for (var k in p) out[k] = p[k];
    if (!p.series) out.series = dailySeries(S.dashPeriod === '7d' ? D.DASHBOARD.daily7 : D.DASHBOARD.daily30, S.dashPeriod === '7d' ? 7 : 30);
    else
      out.series = p.series.map(function (r) {
        return { k: r.k + 'h', label: r.k + 'h', abertos: r.abertos, finalizados: r.finalizados, eu: r.eu };
      });
    return out;
  }

  /* -- Formatação ---------------------------------------------------------- */

  function fmtMin(m) {
    if (m < 1) return Math.round(m * 60) + ' s';
    if (m < 10) {
      var mm = Math.floor(m);
      var ss = Math.round((m - mm) * 60);
      return mm + ' min' + (ss ? ' ' + pad(ss) + ' s' : '');
    }
    if (m < 60) return Math.round(m) + ' min';
    return dur(m);
  }
  function fmtNum(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function fmtDec(n) {
    return n.toFixed(1).replace('.', ',');
  }

  var METRICS = [
    { id: 'abertos', label: 'Atendimentos abertos', hint: 'conversas que você assumiu', fmt: fmtNum, better: null, perAgent: true },
    { id: 'finalizados', label: 'Finalizados', hint: 'encerrados por você', fmt: fmtNum, better: 'up', perAgent: true },
    { id: 'transferidos', label: 'Transferidos', hint: 'enviados para outra fila', fmt: fmtNum, better: null, perAgent: true },
    { id: 'tma', label: 'Tempo médio de atendimento', hint: 'da primeira resposta ao encerramento', fmt: fmtMin, better: 'down' },
    { id: 'tmr', label: 'Tempo até a 1ª resposta', hint: 'quanto o aluno espera por você', fmt: fmtMin, better: 'down' },
    { id: 'csat', label: 'Nota média do aluno', hint: 'pesquisa após o encerramento, 0 a 10', fmt: fmtDec, better: 'up' },
  ];

  function deltaHtml(cur, prev, better) {
    if (!prev) return '';
    var pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) return '<span class="trend" data-dir="flat">= 0%</span>';
    var up = pct > 0;
    var good = better ? (better === 'up') === up : null;
    return (
      '<span class="trend" data-dir="' +
      (up ? 'up' : 'down') +
      '"' +
      (good === null ? '' : ' data-good="' + good + '"') +
      ' title="vs. período anterior">' +
      I(up ? 'arrowUpRight' : 'arrowDownRight', 12) +
      Math.abs(pct) +
      '%</span>'
    );
  }

  function renderDashboard() {
    var p = periodData();
    var size = D.DASHBOARD.teamSize;
    var dist =
      S.dashDist === 'fila' ? D.DASHBOARD.byQueue : S.dashDist === 'transf' ? D.DASHBOARD.transferTargets : D.DASHBOARD.bySubject;
    var waiting = countFor('fila');
    var avail = D.AGENTS.filter(function (a) {
      return a.presence === 'online' && a.id !== D.ME.id;
    }).length;
    var busy = D.AGENTS.filter(function (a) {
      return a.presence === 'ocupado';
    }).length;

    var periods = [
      { id: 'hoje', label: 'Hoje' },
      { id: 'ontem', label: 'Ontem' },
      { id: '7d', label: '7 dias' },
      { id: '30d', label: '30 dias' },
    ];

    /* Cada número seu vem com a média POR ATENDENTE da equipe embaixo. Nunca
       o colega com o melhor número: o atendente se situa, não se ranqueia. */
    var kpis = METRICS.map(function (m, i) {
      var me = p.me[m.id];
      var avg = m.perAgent ? p.team[m.id] / size : p.team[m.id];
      var top = Math.max(me, avg) || 1;
      return (
        '<div class="kpi" style="--i:' +
        i +
        '"><div class="kpi__top"><span class="kpi__label">' +
        esc(m.label) +
        '</span>' +
        deltaHtml(me, p.mePrev[m.id], m.better) +
        '</div><div class="kpi__value">' +
        m.fmt(me) +
        '</div><div class="kpi__hint">' +
        esc(m.hint) +
        '</div>' +
        '<div class="kpi__cmp"><div class="kpi__bars" aria-hidden="true">' +
        '<span class="kpi__bar kpi__bar--me" style="width:' +
        ((me / top) * 100).toFixed(1) +
        '%"></span><span class="kpi__bar kpi__bar--team" style="width:' +
        ((avg / top) * 100).toFixed(1) +
        '%"></span></div>' +
        '<div class="kpi__legend"><span><i class="kpi__sw kpi__sw--me"></i>Você</span><span><i class="kpi__sw kpi__sw--team"></i>Média da equipe <b>' +
        (m.perAgent ? fmtDec(avg).replace(',0', '') : m.fmt(avg)) +
        '</b></span></div></div></div>'
      );
    }).join('');

    var t = p.team;
    var resolution = Math.round((t.finalizados / t.abertos) * 100);
    var teamCells = [
      { v: fmtNum(t.abertos), label: 'Abertos', foot: deltaHtml(t.abertos, p.teamPrev.abertos, null) },
      { v: fmtNum(t.finalizados), label: 'Finalizados', foot: deltaHtml(t.finalizados, p.teamPrev.finalizados, 'up') },
      { v: fmtNum(t.transferidos), label: 'Transferidos', foot: '<span class="metric__foot">' + Math.round((t.transferidos / t.abertos) * 100) + '% dos abertos</span>' },
      { v: fmtMin(t.tma), label: 'Tempo médio de atendimento', foot: deltaHtml(t.tma, p.teamPrev.tma, 'down') },
      { v: fmtMin(t.tmr), label: 'Tempo até a 1ª resposta', foot: deltaHtml(t.tmr, p.teamPrev.tmr, 'down') },
    ];

    var rangeLabel = S.dashPeriod === 'custom' && S.dashRange ? p.label : null;

    var html =
      '<div class="page scroll-slim"><div class="page__inner stack route-enter stagger">' +
      '<header class="pagehead" style="--i:0"><div><div class="pagehead__eyebrow">' +
      '<span class="live-dot pulse-dot"></span>' +
      'Desempenho · ' +
      esc(p.label) +
      '</div>' +
      '<h1>Seu desempenho e o da equipe</h1>' +
      '<p>Seus números ao lado do agregado da equipe. A equipe aparece como total e média por atendente — sem nomes, para você se situar no turno, não se comparar com ninguém.</p></div>' +
      '<div class="pagehead__actions">' +
      '<div class="seg" data-seg="period"><span class="seg__thumb"></span>' +
      periods
        .map(function (k) {
          return '<button class="seg__opt" data-dash-period="' + k.id + '" role="tab" aria-selected="' + (S.dashPeriod === k.id) + '">' + k.label + '</button>';
        })
        .join('') +
      '<button class="seg__opt" data-act="dash-range" role="tab" aria-selected="' +
      (S.dashPeriod === 'custom') +
      '">' +
      I('calendar', 12) +
      (rangeLabel ? esc(rangeLabel) : 'Período') +
      '</button></div>' +
      '<button class="btn btn--sm btn--secondary" data-act="export">' +
      I('download', 14) +
      'Exportar</button></div></header>' +

      '<section class="perf-now" style="--i:1">' +
      '<span class="perf-now__item"><span class="live-dot pulse-dot" style="background:var(--brand-2);color:var(--brand-2)"></span><b>Agora</b></span>' +
      '<span class="perf-now__item"><b class="mono">' + waiting + '</b> na fila esperando atendimento</span>' +
      '<span class="perf-now__item"><b class="mono">' + avail + '</b> colegas disponíveis · <b class="mono">' + busy + '</b> em atendimento</span>' +
      '<span class="perf-now__item"><b class="mono">' + countFor('minha') + '</b> conversas com você</span>' +
      '</section>' +

      '<section style="--i:2"><div class="section-label" style="margin-bottom:14px"><h2>Você</h2><span class="section-label__hint">comparado ao período anterior e à média da equipe</span></div>' +
      '<div class="kpi-grid">' +
      kpis +
      '</div></section>' +

      '<section style="--i:3"><div class="section-label" style="margin-bottom:16px"><h2>A equipe como um todo</h2><span class="section-label__hint">' +
      size +
      ' atendentes · ' +
      resolution +
      '% de resolução · nota média ' +
      fmtDec(t.csat) +
      '</span></div>' +
      '<div class="nowrow nowrow--team">' +
      teamCells
        .map(function (n) {
          return '<div class="nowrow__cell"><span class="metric__value">' + n.v + '</span><span class="metric__label">' + esc(n.label) + '</span><span class="metric__foot">' + n.foot + '</span></div>';
        })
        .join('') +
      '</div></section>' +

      '<section class="grid grid--dash" style="--i:4">' +
      '<div class="card card--inset"><div class="cardhead"><div><h2>Volume da equipe por ' +
      p.unit +
      '</h2>' +
      '<p>Quanto entra e quanto a equipe finaliza. O vão entre as barras é a fila crescendo.</p></div>' +
      '<div class="chart__legend"><span><i class="chart__swatch" style="background:var(--brand)"></i>Abertos</span>' +
      '<span><i class="chart__swatch" style="background:var(--ink-4)"></i>Finalizados</span></div></div>' +
      '<div id="chart-volume" style="margin-top:14px"></div>' +
      '<div class="dash-sla"><div class="dash-sla__row"><span class="metric__label" style="margin:0">Equipe dentro do SLA</span>' +
      '<span class="mono" style="font-size:13px;font-weight:500">' +
      t.sla +
      '% <span style="color:var(--ink-4);font-size:11px">meta 90%</span></span></div>' +
      '<div class="meter"><div class="meter__fill" data-tone="' +
      (t.sla >= 90 ? 'brand' : 'warn') +
      '" style="width:' +
      t.sla +
      '%"></div></div></div></div>' +

      '<div class="card card--inset"><div class="cardhead"><div><h2>Onde o volume se concentra</h2>' +
      '<p>Assuntos, filas e para onde a equipe mais transfere.</p></div></div>' +
      '<div style="margin-top:12px;margin-bottom:12px"><div class="seg seg--xs" data-seg="dist"><span class="seg__thumb"></span>' +
      [
        { id: 'assunto', label: 'Assunto' },
        { id: 'fila', label: 'Fila' },
        { id: 'transf', label: 'Transferências' },
      ]
        .map(function (k) {
          return '<button class="seg__opt" data-dist="' + k.id + '" role="tab" aria-selected="' + (S.dashDist === k.id) + '">' + k.label + '</button>';
        })
        .join('') +
      '</div></div>' +
      barListHtml(dist) +
      '</div></section></div></div>';

    $('#main').innerHTML = html;
    mountChart($('#chart-volume'), function (w) {
      return columnChartSvg(w, p.series);
    });
    syncSegThumbs($('#main'));
  }

  function rangePopover(anchor) {
    var today = new Date();
    function iso(d) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    var r = S.dashRange || { from: iso(new Date(today.getTime() - 13 * 86400000)), to: iso(today) };
    var html =
      '<div class="pop__head"><span class="pop__title">Período personalizado</span></div>' +
      '<div class="range-pop">' +
      '<label class="label">De<input class="input" type="date" id="range-from" value="' + r.from + '" max="' + iso(today) + '"></label>' +
      '<label class="label">Até<input class="input" type="date" id="range-to" value="' + r.to + '" max="' + iso(today) + '"></label>' +
      '<div class="range-pop__quick">' +
      [
        { d: 14, l: '14 dias' },
        { d: 60, l: '60 dias' },
        { d: 90, l: '90 dias' },
      ]
        .map(function (q) {
          return '<button class="chip chip--sm" data-range-days="' + q.d + '">' + q.l + '</button>';
        })
        .join('') +
      '</div><p class="help" id="range-err" hidden>A data final precisa ser depois da inicial (até 90 dias).</p></div>' +
      '<div class="pop__foot" style="display:flex;justify-content:flex-end;gap:6px">' +
      '<button class="btn btn--xs btn--ghost" data-close-pop>Cancelar</button>' +
      '<button class="btn btn--xs btn--primary" data-range-apply>Aplicar</button></div>';
    var pop = openPop(anchor, html, { width: 300, align: 'right' });
    pop.addEventListener('click', function (e) {
      var q = e.target.closest('[data-range-days]');
      if (q) {
        var n = parseInt(q.dataset.rangeDays, 10);
        $('#range-from', pop).value = iso(new Date(today.getTime() - (n - 1) * 86400000));
        $('#range-to', pop).value = iso(today);
        return;
      }
      if (e.target.closest('[data-close-pop]')) closePop();
      if (e.target.closest('[data-range-apply]')) {
        var from = $('#range-from', pop).value;
        var to = $('#range-to', pop).value;
        var days = (new Date(to) - new Date(from)) / 86400000;
        if (!from || !to || days < 0 || days > 89) {
          $('#range-err', pop).hidden = false;
          return;
        }
        S.dashRange = { from: from, to: to };
        S.dashPeriod = 'custom';
        closePop();
        renderDashboard();
      }
    });
  }

  /* ======================================================================
     8. CONTATOS E FICHA 360
     ====================================================================== */

  function openConvsOf(id) {
    return D.CONVERSATIONS.filter(function (c) {
      return c.studentId === id && isOpen(c);
    });
  }
  function allConvsOf(id) {
    return D.CONVERSATIONS.filter(function (c) {
      return c.studentId === id;
    });
  }
  function lastInteraction(id) {
    var all = allConvsOf(id).map(updatedAt);
    var hist = D.HISTORY.filter(function (h) {
      return h.studentId === id;
    }).map(function (h) {
      return h.closedAt;
    });
    var arr = all.concat(hist);
    return arr.length ? Math.max.apply(null, arr) : student(id).firstContact;
  }
  function lastAgentOf(id) {
    var cs = allConvsOf(id).filter(function (c) {
      return c.assignee;
    });
    if (cs.length) return agent(cs[0].assignee);
    var h = D.HISTORY.filter(function (x) {
      return x.studentId === id && x.agent !== 'bot';
    });
    return h.length ? agent(h[0].agent) : null;
  }

  function segmentStudents(seg) {
    return D.STUDENTS.filter(function (st) {
      switch (seg) {
        case 'meus':
          return allConvsOf(st.id).some(function (c) {
            return c.assignee === D.ME.id;
          });
        case 'abertos':
          return openConvsOf(st.id).length > 0;
        case 'risco':
          return st.academic === 'risco';
        case 'inadimplentes':
          return st.balance > 0;
        case 'formandos':
          return st.academic === 'formando';
        case 'ead':
          return st.modality === 'EAD' || st.modality === 'Híbrido';
        default:
          return true;
      }
    });
  }

  function contactRows() {
    var rows = segmentStudents(S.contacts.segment).filter(function (st) {
      var f = S.contacts.filters;
      if (f.modalidade && st.modality !== f.modalidade) return false;
      if (f.unidade && st.unit !== f.unidade) return false;
      if (f.situacao === 'com-debito' && !(st.balance > 0)) return false;
      if (f.situacao === 'regular' && st.balance > 0) return false;
      if (S.contacts.search) {
        var hay = key(st.name + ' ' + st.ra + ' ' + st.course + ' ' + st.email);
        if (hay.indexOf(key(S.contacts.search)) < 0) return false;
      }
      return true;
    });
    var k = S.contacts.sortKey;
    var dir = S.contacts.sortDir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      var va, vb;
      if (k === 'nome') { va = a.name; vb = b.name; return va.localeCompare(vb) * dir; }
      if (k === 'curso') return a.course.localeCompare(b.course) * dir;
      if (k === 'conversas') { va = allConvsOf(a.id).length; vb = allConvsOf(b.id).length; }
      else if (k === 'periodo') { va = a.period; vb = b.period; }
      else { va = lastInteraction(a.id); vb = lastInteraction(b.id); }
      return (va - vb) * dir;
    });
    return rows;
  }

  function sortHeader(k, label, align) {
    var active = S.contacts.sortKey === k;
    return (
      '<th' +
      (active ? ' aria-sort="' + (S.contacts.sortDir === 'asc' ? 'ascending' : 'descending') + '"' : '') +
      (align ? ' style="text-align:' + align + '"' : '') +
      '><button data-sort-col="' +
      k +
      '">' +
      esc(label) +
      (active ? I(S.contacts.sortDir === 'asc' ? 'chevronUp' : 'chevronDown', 11) : '') +
      '</button></th>'
    );
  }

  function renderContacts() {
    var rows = contactRows();
    var html =
      '<div class="page scroll-slim"><div class="page__inner stack route-enter stagger">' +
      '<header class="pagehead" style="--i:0"><div><h1>Contatos</h1>' +
      '<p>Todo aluno que já falou com a UniAnchieta por qualquer canal. ' +
      rows.length +
      ' no recorte atual.</p></div>' +
      '<div class="pagehead__actions">' +
      '<button class="btn btn--sm btn--secondary" data-act="export">' +
      I('download', 14) +
      'Exportar</button>' +
      '<button class="btn btn--sm btn--primary" data-act="new-conversation">' +
      I('plus', 14) +
      'Nova conversa</button></div></header>' +

      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<div class="searchfield" style="max-width:340px">' +
      I('search', 14) +
      '<input class="input" id="contacts-search" type="search" placeholder="Buscar por nome, RA, curso ou e-mail" value="' +
      esc(S.contacts.search) +
      '">' +
      (S.contacts.search
        ? '<button class="searchfield__clear" data-act="clear-contact-search" aria-label="Limpar busca">' + I('x', 13) + '</button>'
        : '') +
      '</div>' +
      '<button class="chip" data-contact-filter="modalidade" aria-pressed="' +
      !!S.contacts.filters.modalidade +
      '">' +
      esc(S.contacts.filters.modalidade || 'Modalidade') +
      I('chevronDown', 11) +
      '</button>' +
      '<button class="chip" data-contact-filter="unidade" aria-pressed="' +
      !!S.contacts.filters.unidade +
      '">' +
      esc(S.contacts.filters.unidade ? S.contacts.filters.unidade.replace('Campus Jundiaí — ', '') : 'Unidade') +
      I('chevronDown', 11) +
      '</button>' +
      '<button class="chip" data-contact-filter="situacao" aria-pressed="' +
      !!S.contacts.filters.situacao +
      '">' +
      esc(S.contacts.filters.situacao === 'com-debito' ? 'Com débito' : S.contacts.filters.situacao === 'regular' ? 'Sem débito' : 'Situação') +
      I('chevronDown', 11) +
      '</button>' +
      (Object.keys(S.contacts.filters).length
        ? '<button class="linkbtn" data-act="clear-contact-filters">Limpar</button>'
        : '') +
      '</div>' +

      (rows.length
        ? '<table class="table"><thead><tr>' +
          sortHeader('nome', 'Aluno') +
          sortHeader('curso', 'Curso e modalidade') +
          '<th>Situação</th>' +
          sortHeader('conversas', 'Conversas') +
          sortHeader('ultima', 'Última interação') +
          '<th>Falando com</th><th></th></tr></thead><tbody>' +
          rows
            .map(function (st) {
              var open = openConvsOf(st.id);
              var owner = open.length && open[0].assignee ? agent(open[0].assignee) : lastAgentOf(st.id);
              var aca = academicTone(st);
              var fin = financialTone(st);
              var showTone = !aca.quiet ? aca : !fin.quiet ? fin : aca;
              return (
                '<tr data-student="' +
                st.id +
                '"><td><div class="cell-who">' +
                studentAvatar(st, 'sm', st.academic === 'risco' ? 'crit' : null) +
                '<div style="min-width:0"><div class="cell-who__name">' +
                esc(st.name) +
                '</div><div class="cell-who__ra">RA ' +
                esc(st.ra) +
                '</div></div></div></td>' +
                '<td><div class="cell-course">' +
                esc(st.course) +
                '</div><div class="cell-sub">' +
                esc(st.modality + ' · ' + st.period + 'º período') +
                '</div></td>' +
                '<td>' +
                statusHtml(showTone) +
                '</td>' +
                '<td class="mono">' +
                allConvsOf(st.id).length +
                (open.length ? ' <span style="color:var(--ink-3)">· ' + open.length + ' aberta</span>' : '') +
                '</td>' +
                '<td class="mono">' +
                relTime(lastInteraction(st.id)) +
                '</td>' +
                '<td>' +
                (open.length && !open[0].assignee
                  ? '<span class="status status--quiet">Sem dono</span>'
                  : owner
                    ? '<span class="cell-owner">' + avatarHtml(owner.name, owner.initials, 'xs') + '<span>' + esc(owner.name.split(' ')[0]) + '</span></span>'
                    : '<span class="status status--quiet">Só a IA</span>') +
                '</td>' +
                '<td style="width:36px"><span style="color:var(--ink-4)">' +
                I('chevronRight', 14) +
                '</span></td></tr>'
              );
            })
            .join('') +
          '</tbody></table>'
        : emptyHtml('users', 'Nenhum aluno neste recorte', 'Ajuste a busca ou os filtros para encontrar quem você procura.', '<button class="btn btn--sm btn--secondary" data-act="clear-contact-filters">Limpar filtros</button>')) +
      '</div></div>';
    $('#main').innerHTML = html;
  }

  /* -- Ficha 360 ----------------------------------------------------------- */

  function timelineFor(st) {
    var items = [];
    allConvsOf(st.id).forEach(function (c) {
      items.push({
        at: updatedAt(c),
        tone: isOpen(c) ? (sla(c).state === 'estourado' ? 'crit' : 'info') : null,
        title: c.subject,
        body: previewMsg(c).text,
        meta: [queue(c.queue).name, channel(c.channel).name, isOpen(c) ? 'em aberto' : 'encerrada'],
        conv: c.id,
      });
    });
    D.HISTORY.filter(function (h) {
      return h.studentId === st.id;
    }).forEach(function (h) {
      items.push({
        at: h.closedAt,
        tone: null,
        title: h.subject,
        body: h.summary,
        meta: [queue(h.queue).name, h.agent === 'bot' ? 'resolvido pela IA' : (agent(h.agent) || D.BOT).name.split(' ')[0], h.rating ? 'nota ' + h.rating : 'sem nota'],
        history: h.id,
      });
    });
    st.notes.forEach(function (n) {
      items.push({ at: n.at, tone: 'warn', title: 'Nota interna — ' + (agent(n.author) || D.ME).name, body: n.text, meta: ['visível só para a equipe'] });
    });
    st.alerts.forEach(function (a, i) {
      items.push({ at: Date.now() - (i + 1) * 3600000 * 6, tone: a.tone, title: 'Alerta do sistema', body: a.text, meta: ['automático'] });
    });
    return items.sort(function (a, b) {
      return b.at - a.at;
    });
  }

  function render360() {
    var st = student(S.route.id);
    if (!st) {
      $('#main').innerHTML = emptyHtml('users', 'Aluno não encontrado', 'O RA solicitado não existe nesta base.');
      return;
    }
    var open = openConvsOf(st.id);
    var hist = historyFor(st.id);
    var aca = academicTone(st);
    var fin = financialTone(st);
    var tabs = [
      { id: 'visao', label: 'Visão geral' },
      { id: 'conversas', label: 'Conversas', count: allConvsOf(st.id).length + D.HISTORY.filter(function (h) { return h.studentId === st.id; }).length },
      { id: 'atendimentos', label: 'Atendimentos', count: hist.length },
      { id: 'notas', label: 'Notas', count: st.notes.length },
    ];

    var content = '';
    if (S.contactTab === 'visao') {
      content =
        '<div class="stack">' +
        (st.alerts.length
          ? '<div class="stack stack--sm">' +
            st.alerts
              .map(function (a) {
                return (
                  '<div class="callout" data-tone="' +
                  a.tone +
                  '"><span class="callout__rail"></span><span class="callout__icon">' +
                  I(a.tone === 'crit' ? 'alertTriangle' : 'alertCircle', 15) +
                  '</span><div class="callout__body"><p class="callout__text" style="margin:0;color:var(--ink-2)">' +
                  esc(a.text) +
                  '</p></div></div>'
                );
              })
              .join('') +
            '</div>'
          : '') +
        (open.length
          ? '<div><div class="section-label" style="margin-bottom:12px"><h2>Conversas em aberto</h2></div>' +
            open
              .map(function (c) {
                var sl = sla(c);
                return (
                  '<button class="ticket" style="width:100%;text-align:left;display:block;margin-bottom:8px" data-goto-conv="' +
                  c.id +
                  '"><div class="ticket__head"><span class="ticket__id">' +
                  esc(queue(c.queue).name + ' · ' + channel(c.channel).name) +
                  '</span>' +
                  (c.status === 'snoozed'
                    ? '<span class="sla">' + I('alarm', 11) + relTime(c.snoozedUntil) + '</span>'
                    : '<span class="sla" data-state="' + sl.state + '">' + I('clock', 11) + (sl.mins < 0 ? '-' + dur(-sl.mins) : dur(sl.mins)) + '</span>') +
                  '</div><div class="ticket__subject">' +
                  esc(c.subject) +
                  '</div><div class="tl-item__body" style="margin-top:4px">' +
                  esc(previewMsg(c).text.slice(0, 150)) +
                  '</div><div class="tl-item__meta">' +
                  (c.assignee
                    ? '<span class="tag">' + esc(agent(c.assignee).name.split(' ')[0]) + '</span>'
                    : '<span class="status" data-tone="warn"><span class="status__dot"></span>Sem dono</span>') +
                  c.tags
                    .map(function (t) {
                      return '<span class="tag">' + esc(t) + '</span>';
                    })
                    .join('') +
                  '</div></button>'
                );
              })
              .join('') +
            '</div>'
          : '') +
        '<div><div class="section-label" style="margin-bottom:14px"><h2>Linha do tempo</h2>' +
        '<span style="font-size:11px;color:var(--ink-4)">tudo que aconteceu com este RA</span></div>' +
        '<div class="timeline">' +
        timelineFor(st)
          .map(function (it) {
            return (
              '<div class="tl-item"' +
              (it.tone ? ' data-tone="' + it.tone + '"' : '') +
              '><span class="tl-item__dot"><i></i></span>' +
              '<div class="tl-item__head"><span class="tl-item__title">' +
              esc(it.title) +
              '</span><span class="tl-item__when">' +
              relTime(it.at) +
              '</span></div>' +
              '<p class="tl-item__body">' +
              esc(it.body) +
              '</p><div class="tl-item__meta">' +
              it.meta
                .map(function (m) {
                  return '<span class="tag">' + esc(m) + '</span>';
                })
                .join('') +
              (it.history ? '<button class="linkbtn" data-history="' + it.history + '">Ler a conversa' + I('arrowRight', 11) + '</button>' : '') +
              (it.conv ? '<button class="linkbtn" data-goto-conv="' + it.conv + '">Abrir no inbox' + I('arrowRight', 11) + '</button>' : '') +
              '</div></div>'
            );
          })
          .join('') +
        '</div></div></div>';
    } else if (S.contactTab === 'conversas') {
      content =
        '<div class="stack stack--sm">' +
        allConvsOf(st.id)
          .concat([])
          .map(function (c) {
            return (
              '<button class="ticket" style="width:100%;text-align:left;display:block" data-goto-conv="' +
              c.id +
              '"><div class="ticket__head"><span class="ticket__id">' +
              esc(channel(c.channel).name) +
              ' · ' +
              relTime(updatedAt(c)) +
              '</span>' +
              (isOpen(c)
                ? '<span class="status" data-tone="info" data-solid="true"><span class="status__dot"></span>Em aberto</span>'
                : '<span class="status status--quiet">Encerrada</span>') +
              '</div><div class="ticket__subject">' +
              esc(c.subject) +
              '</div><div class="tl-item__body" style="margin-top:4px">' +
              esc(previewMsg(c).text.slice(0, 160)) +
              '</div></button>'
            );
          })
          .join('') +
        D.HISTORY.filter(function (h) {
          return h.studentId === st.id;
        })
          .map(function (h) {
            return (
              '<button class="ticket" style="width:100%;text-align:left;display:block" data-history="' +
              h.id +
              '"><div class="ticket__head"><span class="ticket__id">' +
              esc(channel(h.channel).name) +
              ' · ' +
              relTime(h.closedAt) +
              '</span><span class="status status--quiet">Encerrada</span></div>' +
              '<div class="ticket__subject">' +
              esc(h.subject) +
              '</div><div class="tl-item__body" style="margin-top:4px">' +
              esc(h.summary) +
              '</div></button>'
            );
          })
          .join('') +
        '</div>';
    } else if (S.contactTab === 'atendimentos') {
      content = hist.length
        ? '<div class="stack stack--sm">' +
          hist
            .map(function (h) {
              return (
                '<div class="ticket"><div class="ticket__head"><span class="ticket__id">#' +
                h.id.toUpperCase() +
                ' · ' +
                esc(queue(h.queue).name) +
                '</span><span class="status status--quiet">' +
                fullDate(h.closedAt) +
                '</span></div>' +
                '<div class="ticket__subject">' +
                esc(h.subject) +
                '</div>' +
                '<div class="ticket__grid">' +
                '<div><div class="ticket__k">Atendente</div><div class="ticket__v" style="font-family:var(--font-sans)">' +
                esc(h.agent === 'bot' ? 'Assistente IA' : (agent(h.agent) || D.BOT).name) +
                '</div></div>' +
                '<div><div class="ticket__k">1ª resposta</div><div class="ticket__v">' +
                (h.frtMin ? dur(h.frtMin) : '—') +
                '</div></div>' +
                '<div><div class="ticket__k">Duração</div><div class="ticket__v">' +
                dur(h.durationMin) +
                '</div></div>' +
                '<div><div class="ticket__k">Nota</div><div class="ticket__v">' +
                (h.rating || '—') +
                '</div></div></div>' +
                '<div class="tl-item__meta" style="margin-top:10px">' +
                (h.tags || [])
                  .map(function (t) {
                    return '<span class="tag">' + esc(t) + '</span>';
                  })
                  .join('') +
                '<button class="linkbtn" data-history="' +
                h.id +
                '" style="margin-left:auto">Ler a conversa' +
                I('arrowRight', 11) +
                '</button></div></div>'
              );
            })
            .join('') +
          '</div>'
        : emptyHtml('ticket', 'Nenhum atendimento encerrado', 'Este aluno ainda não teve um atendimento humano concluído.');
    } else {
      content =
        '<div class="stack stack--sm">' +
        '<div class="card card--inset"><textarea class="textarea" id="new-note" rows="3" placeholder="Nota visível só para a equipe. Use @ para citar alguém."></textarea>' +
        '<div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="btn btn--sm btn--ink" data-act="save-note">' +
        I('note', 14) +
        'Salvar nota</button></div></div>' +
        (st.notes.length
          ? st.notes
              .map(function (n) {
                return (
                  '<div class="ticket"><div class="ticket__head"><span class="ticket__id">' +
                  esc((agent(n.author) || D.ME).name) +
                  '</span><span class="ticket__id">' +
                  fullDate(n.at) +
                  '</span></div><p style="margin-top:8px;font-size:13px;line-height:1.65;color:var(--ink-2)">' +
                  esc(n.text) +
                  '</p></div>'
                );
              })
              .join('')
          : emptyHtml('note', 'Nenhuma nota interna', 'Notas ficam com o aluno, não com a conversa — a próxima pessoa que atender vai ler.')) +
        '</div>';
    }

    $('#main').innerHTML =
      '<div class="page scroll-slim"><div class="page__inner stack route-enter">' +
      '<div><button class="linkbtn" data-act="back-contacts">' +
      I('arrowLeft', 13) +
      'Contatos</button></div>' +
      '<header class="hero360"><div class="hero360__id">' +
      studentAvatar(st, 'lg', st.academic === 'risco' ? 'crit' : null) +
      '<div style="min-width:0"><div class="hero360__name"><h1>' +
      esc(st.name) +
      '</h1><span class="hero360__ra">RA ' +
      esc(st.ra) +
      '</span></div>' +
      '<div class="hero360__line"><span>' +
      esc(st.course) +
      '</span><span style="color:var(--ink-4)">·</span><span>' +
      esc(st.modality + ' · ' + st.shift) +
      '</span><span style="color:var(--ink-4)">·</span><span>' +
      esc(st.unit) +
      '</span></div>' +
      '<div class="hero360__line">' +
      statusHtml(aca) +
      statusHtml(fin) +
      (open.length ? '<span class="tag">' + open.length + ' conversa em aberto</span>' : '') +
      '</div></div></div>' +
      '<div class="pagehead__actions">' +
      (open.length
        ? '<button class="btn btn--sm btn--primary" data-goto-conv="' + open[0].id + '">' + I('messageSquare', 14) + 'Abrir conversa</button>'
        : '<button class="btn btn--sm btn--primary" data-act="new-conversation">' + I('plus', 14) + 'Nova conversa</button>') +
      '<button class="iconbtn" data-act="call" data-tip="' +
      esc(st.phone) +
      '" aria-label="Telefone">' +
      I('phone', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="mail" data-tip="' +
      esc(st.email) +
      '" aria-label="E-mail">' +
      I('mail', 15) +
      '</button>' +
      '<button class="iconbtn" data-act="more-student" data-tip="Mais ações" aria-label="Mais ações">' +
      I('more', 15) +
      '</button></div></header>' +

      '<section class="grid grid--360">' +
      '<div><div class="tabs" data-tabs="contact">' +
      tabs
        .map(function (t) {
          return (
            '<button class="tab" role="tab" data-tab="' +
            t.id +
            '" aria-selected="' +
            (S.contactTab === t.id) +
            '"><span class="tab__inner">' +
            esc(t.label) +
            (t.count !== undefined ? '<span class="tab__count">' + t.count + '</span>' : '') +
            '</span></button>'
          );
        })
        .join('') +
      '<span class="tabs__ink"></span></div>' +
      '<div style="margin-top:20px">' +
      content +
      '</div></div>' +

      '<aside class="stack stack--sm">' +
      '<div class="card card--inset"><h2 style="font-size:12px;font-weight:600;color:var(--ink-3);margin-bottom:12px">Ficha do aluno</h2>' +
      kv('RA', '<span class="mono">' + esc(st.ra) + '</span>') +
      maskedKv('CPF', 'cpf-' + st.id, maskCpf(st.cpf), st.cpf) +
      maskedKv('WhatsApp', 'tel-' + st.id, st.phone.slice(0, 9) + '****', st.phone) +
      maskedKv('E-mail', 'mail-' + st.id, maskMail(st.email), st.email) +
      kv('Tipo de curso', esc(st.type)) +
      kv('Unidade', esc(st.unit)) +
      kv('Turno', esc(st.shift)) +
      kv('Período', '<span class="mono">' + st.period + 'º</span>') +
      kv('Dependências', '<span class="mono">' + st.dps + '</span>') +
      kv('Total em aberto', '<span class="mono"' + (st.balance > 0 ? ' style="color:var(--crit-ink)"' : '') + '>' + money(st.balance) + '</span>') +
      kv('Primeiro contato', fullDate(st.firstContact).split(' · ')[0]) +
      '<p style="margin-top:12px;font-size:11px;color:var(--ink-4)">Sincronizado com o acadêmico ' +
      relTime(st.syncedAt) +
      '</p></div>' +
      '<div class="card card--inset"><h2 style="font-size:12px;font-weight:600;color:var(--ink-3);margin-bottom:10px">Matrículas</h2>' +
      st.enrollments
        .map(function (e) {
          return '<p style="font-size:12.5px;line-height:1.6;color:var(--ink-2);padding:4px 0">' + esc(e) + '</p>';
        })
        .join('') +
      '</div>' +
      '<div class="card card--inset"><h2 style="font-size:12px;font-weight:600;color:var(--ink-3);margin-bottom:10px">Marcadores</h2>' +
      '<div class="tagrow">' +
      (st.tags.length
        ? st.tags
            .map(function (t) {
              return '<span class="tag">' + esc(t) + '</span>';
            })
            .join('')
        : '<span style="font-size:12px;color:var(--ink-4)">Nenhum marcador.</span>') +
      '</div></div></aside></section></div></div>';

    syncTabInk($('[data-tabs="contact"]'));
  }

  function syncTabInk(tabs) {
    if (!tabs) return;
    var ink = $('.tabs__ink', tabs);
    var active = $('[aria-selected="true"]', tabs);
    if (!ink || !active) return;
    ink.style.width = active.offsetWidth - 16 + 'px';
    ink.style.transform = 'translateX(' + (active.offsetLeft + 8) + 'px)';
  }

  /* ======================================================================
     9. HISTÓRICO — leitura, e só leitura
     ====================================================================== */

  function openHistory(id) {
    var h = null;
    for (var i = 0; i < D.HISTORY.length; i++) if (D.HISTORY[i].id === id) h = D.HISTORY[i];
    if (!h) {
      var c = conv(id);
      if (!c) return;
      h = {
        id: c.id, studentId: c.studentId, subject: c.subject, channel: c.channel, queue: c.queue,
        agent: c.assignee, openedAt: createdAt(c), closedAt: c.closedAt || Date.now(),
        durationMin: Math.round(((c.closedAt || Date.now()) - createdAt(c)) / 60000),
        frtMin: c.firstResponseAt ? Math.round((c.firstResponseAt - createdAt(c)) / 60000) : null,
        rating: c.rating, tags: c.tags, summary: c.aiSummary, messages: c.messages,
      };
    }
    var st = student(h.studentId);
    var fake = { studentId: h.studentId, messages: h.messages };

    openDrawer({
      label: 'Conversa encerrada — ' + h.subject,
      body:
        '<div class="panehead"><div class="panehead__title"><h2>' +
        esc(h.subject) +
        '</h2><span class="panehead__sub">' +
        esc(st.name) +
        ' · RA ' +
        esc(st.ra) +
        '</span></div><div class="panehead__spacer"></div>' +
        '<button class="iconbtn" data-act="open-360-from-history" data-student="' +
        st.id +
        '" data-tip="Abrir ficha do aluno" aria-label="Ficha do aluno">' +
        I('user', 15) +
        '</button>' +
        '<button class="iconbtn" data-close aria-label="Fechar">' +
        I('x', 16) +
        '</button></div>' +
        '<div class="readonly-banner">' +
        I('lock', 13) +
        'Conversa encerrada · somente leitura</div>' +
        '<div class="scroll-slim" style="flex:1;min-height:0">' +
        '<div style="padding:16px 18px 0"><div class="ticket"><div class="ticket__head">' +
        '<span class="ticket__id">#' +
        h.id.toUpperCase() +
        ' · ' +
        esc(queue(h.queue).name) +
        ' · ' +
        esc(channel(h.channel).name) +
        '</span>' +
        (h.rating ? '<span class="status status--quiet">Nota ' + h.rating + '</span>' : '<span class="status status--quiet">Sem nota</span>') +
        '</div><div class="ticket__grid">' +
        '<div><div class="ticket__k">Atendente</div><div class="ticket__v" style="font-family:var(--font-sans)">' +
        esc(h.agent === 'bot' ? 'Assistente IA' : (agent(h.agent) || D.BOT).name) +
        '</div></div>' +
        '<div><div class="ticket__k">Início</div><div class="ticket__v">' +
        fullDate(h.openedAt) +
        '</div></div>' +
        '<div><div class="ticket__k">Encerramento</div><div class="ticket__v">' +
        fullDate(h.closedAt) +
        '</div></div>' +
        '<div><div class="ticket__k">Duração</div><div class="ticket__v">' +
        dur(h.durationMin) +
        '</div></div></div>' +
        (h.summary
          ? '<div style="margin-top:12px;border-top:1px solid var(--hairline);padding-top:10px">' +
            '<div class="ticket__k" style="display:flex;align-items:center;gap:5px;margin-bottom:4px">' +
            I('sparkles', 11) +
            'Resumo</div><p style="font-size:12.5px;line-height:1.65;color:var(--ink-2)">' +
            esc(h.summary) +
            '</p></div>'
          : '') +
        (h.tags && h.tags.length
          ? '<div class="tl-item__meta" style="margin-top:10px">' +
            h.tags
              .map(function (t) {
                return '<span class="tag">' + esc(t) + '</span>';
              })
              .join('') +
            '</div>'
          : '') +
        '</div></div>' +
        '<div class="msgs" style="padding-top:12px"><div class="msgs__inner">' +
        messagesHtml(fake) +
        '</div></div></div>',
      onMount: function (sheet, close) {
        sheet.addEventListener('click', function (e) {
          var b = e.target.closest('[data-act="open-360-from-history"]');
          if (b) {
            close();
            location.hash = '#/contatos/' + b.dataset.student;
          }
        });
      },
    });
  }

  /* ======================================================================
     10. AÇÕES
     ====================================================================== */

  function rerenderInbox() {
    renderViewsColumn();
    renderRail();
    syncPills();
    renderList();
    renderThread();
    renderContext();
  }

  /**
   * Uma caixa aberta sem nada selecionado é meia tela vazia. Ao entrar numa
   * caixa, a conversa do topo — a mais crítica pela ordenação — já abre; se a
   * seleção atual ainda pertence à caixa, ela é mantida.
   */
  function ensureSelection() {
    var list = listConversations();
    if (S.selected && conv(S.selected) && inView(conv(S.selected), S.view)) return;
    if (!list.length) {
      S.selected = null;
      return;
    }
    S.selected = list[0].id;
    list[0].unread = 0;
    S.composer.text = '';
    S.composer.mode = 'reply';
    S.copilot = { running: false, title: null, body: '', chips: null, insert: null };
  }

  function claim(c) {
    c.assignee = D.ME.id;
    c.status = 'aberto';
    D.ME.open++;
    /* Assumir tira a conversa de "Não atribuídos". Se a gente deixasse a
       caixa como estava, ela sumiria da lista enquanto continua aberta ao
       lado — então a gente segue a conversa para onde ela foi. */
    if (!inView(c, S.view)) S.view = 'minha';
    rerenderInbox();
    setTimeout(function () {
      var box = $('#composer-box');
      if (box) box.focus();
    }, 80);
    toast('Atendimento assumido', {
      sub: student(c.studentId).name + ' · ' + queue(c.queue).name,
      icon: 'hand',
      action: 'Desfazer',
      onAction: function () {
        c.assignee = null;
        D.ME.open--;
        rerenderInbox();
      },
    });
  }

  function closeConv(c) {
    openModal({
      icon: 'circleCheck',
      title: 'Encerrar atendimento',
      sub: student(c.studentId).name + ' · ' + c.subject,
      size: 'sm',
      body:
        '<label class="label">Desfecho</label>' +
        '<div class="select-wrap"><select class="select" id="close-reason">' +
        ['Resolvido na conversa', 'Encaminhado para outro setor', 'Aluno não respondeu', 'Duplicado', 'Fora do escopo do atendimento']
          .map(function (o) {
            return '<option>' + o + '</option>';
          })
          .join('') +
        '</select>' +
        I('chevronDown', 14) +
        '</div>' +
        '<div style="margin-top:14px"><label class="label">Mensagem de encerramento <span style="color:var(--ink-4);font-weight:400">(opcional)</span></label>' +
        '<textarea class="textarea" id="close-msg" rows="3" data-autofocus>Fico à disposição! Se surgir qualquer outra dúvida, é só chamar por aqui mesmo. Bons estudos.</textarea></div>' +
        '<p class="help">O aluno recebe a pesquisa de satisfação logo depois do encerramento.</p>',
      footer:
        '<button class="btn btn--sm btn--ghost" data-close>Cancelar</button>' +
        '<button class="btn btn--sm btn--primary" data-confirm-close>Encerrar atendimento</button>',
      onMount: function (sheet, close) {
        $('[data-confirm-close]', sheet).addEventListener('click', function () {
          var text = $('#close-msg', sheet).value.trim();
          var reason = $('#close-reason', sheet).value;
          if (text) c.messages.push({ from: 'agente', authorId: D.ME.id, text: text, at: Date.now() });
          c.status = 'encerrado';
          c.closedAt = Date.now();
          c.closeReason = reason;
          c.unread = 0;
          if (c.assignee === D.ME.id) D.ME.open = Math.max(0, D.ME.open - 1);
          close();
          rerenderInbox();
          toast('Atendimento encerrado', {
            sub: reason,
            icon: 'circleCheck',
            action: 'Reabrir',
            onAction: function () {
              c.status = 'aberto';
              c.slaDue = Date.now() + 3600000 * 4;
              rerenderInbox();
            },
          });
        });
      },
    });
  }

  /**
   * Transferência para FILA. O atendente não escolhe o colega: escolhe o
   * setor, e a fila distribui. O motivo vira nota interna — quem pegar do
   * outro lado não começa do zero — e o aluno pode ser avisado na hora.
   */
  function transferModal(convs) {
    convs = [].concat(convs);
    var single = convs.length === 1 ? convs[0] : null;
    var from = single ? single.queue : null;
    var options = D.QUEUES.filter(function (q) {
      return q.id !== from;
    });
    var waitingBy = {};
    D.CONVERSATIONS.forEach(function (c) {
      if (inView(c, 'fila')) waitingBy[c.queue] = (waitingBy[c.queue] || 0) + 1;
    });

    openModal({
      icon: 'arrowRightLeft',
      title: single ? 'Transferir atendimento' : 'Transferir ' + convs.length + ' atendimentos',
      sub: single ? student(single.studentId).name + ' · hoje em ' + queue(single.queue).name : 'Todas vão para a mesma fila.',
      size: 'sm',
      body:
        '<p class="label">Para qual fila?</p>' +
        '<div class="qpick" role="radiogroup">' +
        options
          .map(function (q, i) {
            return (
              '<button class="qpick__opt" role="radio" data-queue="' +
              q.id +
              '" aria-checked="' +
              (i === 0) +
              '">' +
              '<span class="qpick__icon">' +
              I(q.icon, 15) +
              '</span><span class="qpick__name">' +
              esc(q.name) +
              '</span><span class="qpick__wait">' +
              (waitingBy[q.id] ? waitingBy[q.id] + ' na fila' : 'fila livre') +
              '</span></button>'
            );
          })
          .join('') +
        '</div>' +
        '<div style="margin-top:14px"><label class="label" for="transfer-why">Contexto para quem receber <span style="color:var(--ink-4);font-weight:400">(vira nota interna)</span></label>' +
        '<textarea class="textarea" id="transfer-why" rows="3" data-autofocus placeholder="O que já foi feito e o que falta. Ex.: aluno já enviou o RG; falta validar o aceite das DPs."></textarea></div>' +
        (single
          ? '<label class="checkrow"><input type="checkbox" id="transfer-tell" checked><span>Avisar o aluno que o atendimento foi transferido</span></label>'
          : '') +
        '<p class="help">A conversa sai da sua caixa e entra na fila escolhida. O aluno continua na mesma conversa.</p>',
      footer:
        '<button class="btn btn--sm btn--ghost" data-close>Cancelar</button>' +
        '<button class="btn btn--sm btn--primary" data-confirm-transfer>' +
        I('arrowRightLeft', 14) +
        'Transferir</button>',
      onMount: function (sheet, close) {
        sheet.addEventListener('click', function (e) {
          var opt = e.target.closest('[data-queue]');
          if (opt) {
            $$('[data-queue]', sheet).forEach(function (o) {
              o.setAttribute('aria-checked', String(o === opt));
            });
            return;
          }
          if (!e.target.closest('[data-confirm-transfer]')) return;
          var picked = $('[data-queue][aria-checked="true"]', sheet);
          if (!picked) return;
          var to = picked.dataset.queue;
          var why = $('#transfer-why', sheet).value.trim();
          var tell = $('#transfer-tell', sheet);
          var now = Date.now();
          convs.forEach(function (c) {
            var prev = c.queue;
            if (tell && tell.checked) {
              c.messages.push({
                from: 'agente',
                authorId: D.ME.id,
                text: 'Vou transferir seu atendimento para a equipe de ' + queue(to).name + ', que é quem resolve esse assunto. Você continua nesta mesma conversa — não precisa explicar de novo.',
                at: now,
              });
            }
            c.messages.push({
              from: 'nota',
              authorId: D.ME.id,
              text: 'Transferido de ' + queue(prev).name + ' para ' + queue(to).name + '.' + (why ? ' ' + why : ''),
              at: now + 1,
            });
            c.events = (c.events || []).concat([{ at: now, title: 'Transferido para ' + queue(to).name, text: why || 'Sem observação.' }]);
            c.queue = to;
            c.assignee = null;
            c.pinned = false;
            c.folder = null;
            c.transferredBy = D.ME.id;
          });
          D.ME.open = Math.max(0, D.ME.open - convs.length);
          saveOrg();
          close();
          S.bulk = null;
          if (single && S.selected === single.id) S.selected = null;
          ensureSelection();
          rerenderInbox();
          toast(single ? 'Transferido para ' + queue(to).name : convs.length + ' atendimentos transferidos para ' + queue(to).name, {
            icon: 'arrowRightLeft',
            sub: why ? 'O contexto foi como nota interna.' : 'Saiu da sua caixa e entrou na fila.',
          });
        });
      },
    });
  }

  /* -- Pastas -------------------------------------------------------------- */

  function createFolder(name, thenMove) {
    var f = { id: 'f-' + Date.now().toString(36), name: name.slice(0, 40) };
    S.folders.push(f);
    if (thenMove) [].concat(thenMove).forEach(function (c) { c.folder = f.id; });
    saveOrg();
    return f;
  }

  function moveToFolder(convs, folderId) {
    convs = [].concat(convs);
    convs.forEach(function (c) {
      c.folder = folderId || null;
    });
    saveOrg();
    /* Na própria pasta, tirar uma conversa de lá a faz sumir da lista: a
       seleção acompanha. */
    if (S.view.indexOf('pasta:') === 0) ensureSelection();
    rerenderInbox();
    var f = folderId ? folder(folderId) : null;
    toast(f ? (convs.length > 1 ? convs.length + ' conversas movidas para ' : 'Movida para ') + f.name : 'Removida da pasta', {
      icon: f ? 'folderInput' : 'folder',
      sub: f ? 'Continua também em Minha caixa.' : null,
    });
  }

  function folderPicker(anchor, convs) {
    convs = [].concat(convs);
    var cur = convs.length === 1 ? convs[0].folder : null;
    var items = S.folders.map(function (f) {
      return { label: f.name, act: 'move', value: f.id, icon: 'folder', checked: cur === f.id };
    });
    if (items.length) items.push({ sep: true });
    items.push({ label: 'Nova pasta…', act: 'new', icon: 'folderPlus' });
    if (cur) items.push({ label: 'Tirar da pasta', act: 'out', icon: 'x' });
    openMenu(
      anchor,
      items,
      function (a, v) {
        if (a === 'move') moveToFolder(convs, v);
        else if (a === 'out') moveToFolder(convs, null);
        else if (a === 'new') folderNameModal(null, convs);
      },
      { width: 250, align: 'right' }
    );
  }

  /** Criar (com conversas para já mover) ou renomear uma pasta. */
  function folderNameModal(f, convs) {
    openModal({
      icon: f ? 'pencil' : 'folderPlus',
      title: f ? 'Renomear pasta' : 'Nova pasta',
      sub: convs && convs.length ? (convs.length === 1 ? 'A conversa vai direto para ela.' : convs.length + ' conversas vão direto para ela.') : 'Organize a sua caixa do seu jeito.',
      size: 'sm',
      body: '<label class="label" for="folder-name">Nome</label><input class="input" id="folder-name" maxlength="40" data-autofocus value="' + esc(f ? f.name : '') + '" placeholder="Ex.: Aguardando retorno do setor">',
      footer: '<button class="btn btn--sm btn--ghost" data-close>Cancelar</button><button class="btn btn--sm btn--primary" data-folder-ok>' + (f ? 'Salvar' : 'Criar pasta') + '</button>',
      onMount: function (sheet, close) {
        var input = $('#folder-name', sheet);
        function ok() {
          var name = input.value.trim();
          if (!name) {
            input.focus();
            return;
          }
          if (f) {
            f.name = name;
            saveOrg();
            toast('Pasta renomeada', { icon: 'folder' });
          } else {
            var nf = createFolder(name, convs);
            toast('Pasta criada', { icon: 'folderPlus', sub: nf.name });
          }
          close();
          rerenderInbox();
        }
        $('[data-folder-ok]', sheet).addEventListener('click', ok);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            ok();
          }
        });
      },
    });
  }

  function folderMenu(anchor, id) {
    var f = folder(id);
    if (!f) return;
    openMenu(
      anchor,
      [
        { label: 'Renomear', act: 'rename', icon: 'pencil' },
        { label: 'Excluir pasta', act: 'delete', icon: 'trash', danger: true, sub: 'as conversas continuam em Minha caixa' },
      ],
      function (a) {
        if (a === 'rename') folderNameModal(f);
        else if (a === 'delete') {
          var idx = S.folders.indexOf(f);
          var moved = D.CONVERSATIONS.filter(function (c) { return c.folder === id; });
          S.folders.splice(idx, 1);
          moved.forEach(function (c) { c.folder = null; });
          if (S.view === 'pasta:' + id) {
            S.view = 'minha';
            ensureSelection();
          }
          saveOrg();
          rerenderInbox();
          toast('Pasta excluída', {
            icon: 'trash',
            sub: f.name,
            action: 'Desfazer',
            onAction: function () {
              S.folders.splice(idx, 0, f);
              moved.forEach(function (c) { c.folder = id; });
              saveOrg();
              rerenderInbox();
            },
          });
        }
      },
      { width: 260 }
    );
  }

  function togglePin(c) {
    c.pinned = !c.pinned;
    saveOrg();
    rerenderInbox();
    toast(c.pinned ? 'Fixada no topo' : 'Desafixada', { icon: c.pinned ? 'pin' : 'pinOff', sub: student(c.studentId).name });
  }

  function tagPopover(anchor, c) {
    var html =
      '<div class="pop__head"><span class="pop__title">Marcadores</span></div>' +
      '<div class="pop__search"><div class="searchfield">' +
      I('search', 14) +
      '<input class="input" id="tag-search" placeholder="Buscar ou criar" data-autofocus></div></div>' +
      '<div class="pop__list scroll-slim" id="tag-list"></div>';
    var pop = openPop(anchor, html, { width: 260 });

    function paint(q) {
      var list = D.TAGS.filter(function (t) {
        return !q || key(t).indexOf(key(q)) >= 0;
      });
      var body = list
        .map(function (t) {
          return (
            '<button class="menuitem" data-tag="' +
            esc(t) +
            '"' +
            (c.tags.indexOf(t) >= 0 ? ' aria-checked="true"' : '') +
            '><span class="menuitem__label">' +
            esc(t) +
            '</span>' +
            (c.tags.indexOf(t) >= 0 ? I('check', 14) : '') +
            '</button>'
          );
        })
        .join('');
      if (q && !list.length)
        body = '<button class="menuitem" data-tag="' + esc(q) + '">' + I('plus', 14) + '<span class="menuitem__label">Criar "' + esc(q) + '"</span></button>';
      $('#tag-list', pop).innerHTML = body || '<p style="padding:10px;font-size:12px;color:var(--ink-4)">Nada encontrado.</p>';
    }
    paint('');
    $('#tag-search', pop).addEventListener('input', function (e) {
      paint(e.target.value);
    });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tag]');
      if (!b) return;
      var t = b.dataset.tag;
      var i = c.tags.indexOf(t);
      if (i >= 0) c.tags.splice(i, 1);
      else {
        c.tags.push(t);
        if (D.TAGS.indexOf(t) < 0) D.TAGS.push(t);
      }
      paint($('#tag-search', pop).value);
      renderList();
      renderContext();
    });
  }

  function macroPopover(anchor, c) {
    var html =
      '<div class="pop__head"><span class="pop__title">Templates de resposta</span></div>' +
      '<div class="pop__search"><div class="searchfield">' +
      I('search', 14) +
      '<input class="input" id="macro-search" placeholder="Buscar template ou digitar #atalho" data-autofocus></div></div>' +
      '<div class="pop__list scroll-slim" id="macro-list"></div>' +
      '<div class="pop__foot"><span style="font-size:11px;color:var(--ink-4)">Digite <b>#</b> no composer para abrir isto sem tirar a mão do teclado.</span></div>';
    var pop = openPop(anchor, html, { width: 380, align: 'right' });

    function paint(q) {
      var list = D.MACROS.filter(function (m) {
        return !q || key(m.title + ' ' + m.shortcut + ' ' + m.category + ' ' + m.body).indexOf(key(q.replace('#', ''))) >= 0;
      });
      $('#macro-list', pop).innerHTML = list.length
        ? list
            .map(function (m) {
              return (
                '<button class="menuitem" data-macro="' +
                m.id +
                '"><span class="menuitem__label">' +
                esc(m.title) +
                '<span class="menuitem__sub">' +
                esc(m.body.split('\n')[0].slice(0, 62)) +
                '…</span></span><span class="menuitem__hint">#' +
                esc(m.shortcut) +
                '</span></button>'
              );
            })
            .join('')
        : '<p style="padding:10px;font-size:12px;color:var(--ink-4)">Nenhum template para essa busca.</p>';
    }
    paint('');
    $('#macro-search', pop).addEventListener('input', function (e) {
      paint(e.target.value);
    });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('[data-macro]');
      if (!b) return;
      var m = null;
      D.MACROS.forEach(function (x) {
        if (x.id === b.dataset.macro) m = x;
      });
      closePop();
      insertInComposer(m.body, c);
      toast('Template inserido', { sub: m.title, icon: 'hash' });
    });
  }

  function insertInComposer(text, c) {
    var box = $('#composer-box');
    var name = student(c.studentId).name.split(' ')[0];
    var filled = text.replace(/\{nome\}/g, name);
    S.composer.text = S.composer.text ? S.composer.text.replace(/#\w*$/, '') + filled : filled;
    if (box) {
      box.value = S.composer.text;
      autoGrow(box);
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    } else renderThread();
  }

  function autoGrow(box) {
    box.style.height = 'auto';
    box.style.height = Math.min(190, box.scrollHeight) + 'px';
  }

  var REPLIES = [
    'Perfeito, muito obrigado(a) pela ajuda!',
    'Ah, entendi! Vou fazer isso agora então.',
    'Certo, fico no aguardo do retorno.',
    'Show, era isso que eu precisava saber. Valeu!',
    'Beleza, qualquer coisa eu volto a chamar por aqui.',
  ];

  function maybeAutoReply(c) {
    if (S.autoReplied[c.id] || c.status !== 'aberto') return;
    S.autoReplied[c.id] = true;
    var idx = c.id.charCodeAt(c.id.length - 1) % REPLIES.length;
    setTimeout(function () {
      if (S.selected === c.id && $('#msgs')) {
        var t = document.createElement('div');
        t.className = 'typing';
        t.id = 'typing';
        t.innerHTML =
          '<span class="typing__dots"><i></i><i></i><i></i></span>' + esc(student(c.studentId).name.split(' ')[0]) + ' está digitando…';
        $('#msgs').appendChild(t);
        scrollMessages(true);
      }
    }, 1100);
    setTimeout(function () {
      var t = $('#typing');
      if (t) t.remove();
      var at = Date.now();
      c.messages.push({ from: 'aluno', authorId: c.studentId, text: REPLIES[idx], at: at });
      S.flashAt = at;
      if (S.selected !== c.id) c.unread = (c.unread || 0) + 1;
      if (S.route.name === 'inbox') {
        renderList();
        if (S.selected === c.id) {
          renderThread();
          scrollMessages(true);
        }
      }
    }, 3400);
  }

  function sendMessage() {
    var c = S.selected ? conv(S.selected) : null;
    if (!c || c.assignee !== D.ME.id || c.status === 'encerrado') return;
    var box = $('#composer-box');
    var text = (box ? box.value : S.composer.text).trim();
    if (!text) return;
    var note = S.composer.mode === 'note';

    var at = Date.now();
    c.messages.push({
      from: note ? 'nota' : 'agente',
      authorId: D.ME.id,
      text: text,
      at: at,
    });
    S.flashAt = at;
    if (!note) {
      if (!c.firstResponseAt) c.firstResponseAt = Date.now();
      c.unread = 0;
      c.slaDue = Date.now() + 4 * 3600000;
      c.status = 'aberto';
    }
    S.composer.text = '';
    renderThread();
    renderList();
    renderContext();
    scrollMessages(true);
    var nb = $('#composer-box');
    if (nb) nb.focus();
    if (note) toast('Nota salva para a equipe', { icon: 'note', sub: 'O aluno não vê esta mensagem.' });
    else maybeAutoReply(c);
  }

  function runCopilot(id) {
    var c = S.selected ? conv(S.selected) : null;
    if (!c) return;
    var res = copilotRun(id, c);
    S.ctxTab = 'copilot';
    S.copilot = { running: true, title: res.title, body: '', chips: res.chips, insert: null, insertMode: res.insertMode };
    renderContext();
    /* O resultado nasce abaixo do resumo: rola até ele, senão o atendente
       clica numa ação e nada parece acontecer. */
    var el0 = $('#copilot-result');
    var box = $('.ctx');
    if (el0 && box) box.scrollTo({ top: el0.offsetTop - 12, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

    /* Escrita simulada: rápida o bastante para não atrapalhar, lenta o
       bastante para o atendente ver que a resposta está sendo montada. */
    typeInto(
      res.text,
      function (html) {
        S.copilot.body = html;
        var el = $('#copilot-body');
        if (el) el.innerHTML = html + '<span class="copilot__caret"></span>';
      },
      function (html) {
        S.copilot.running = false;
        S.copilot.body = html;
        S.copilot.insert = res.insert;
        renderContext();
      }
    );
  }

  /* -- Command palette ------------------------------------------------------ */

  function openPalette() {
    closePop();
    var prev = document.activeElement;
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    var wrap = document.createElement('div');
    wrap.className = 'palette-wrap';
    wrap.innerHTML =
      '<div class="palette" role="dialog" aria-modal="true" aria-label="Busca e comandos">' +
      '<div class="palette__input-row">' +
      I('search', 17) +
      '<input class="palette__input" id="palette-input" placeholder="Buscar aluno, RA, conversa ou comando…" autocomplete="off">' +
      '<span class="kbd">Esc</span></div>' +
      '<div class="palette__list scroll-slim" id="palette-list"></div>' +
      '<div class="palette__foot"><span>' +
      I('chevronsUpDown', 12) +
      'navegar</span><span><span class="kbd">Enter</span>abrir</span><span><span class="kbd">Ctrl K</span>fechar</span></div></div>';
    overlayRoot.appendChild(scrim);
    overlayRoot.appendChild(wrap);

    var pal = $('.palette', wrap);
    var input = $('#palette-input', wrap);
    var listEl = $('#palette-list', wrap);
    var items = [];
    var cursor = 0;

    function close() {
      pal.setAttribute('data-closing', 'true');
      scrim.setAttribute('data-closing', 'true');
      setTimeout(function () {
        wrap.remove();
        scrim.remove();
        if (prev && prev.focus) prev.focus();
      }, 160);
      document.removeEventListener('keydown', onKey, true);
    }

    function build(q) {
      var out = [];
      var nav = [
        { group: 'Ir para', label: 'Inbox', icon: 'inbox', hint: 'G I', run: function () { location.hash = '#/inbox'; } },
        { group: 'Ir para', label: 'Desempenho', icon: 'gauge', hint: 'G D', run: function () { location.hash = '#/dashboard'; } },
        { group: 'Ir para', label: 'Contatos', icon: 'users', hint: 'G C', run: function () { location.hash = '#/contatos'; } },
        { group: 'Ir para', label: 'Minha caixa', icon: 'inbox', run: function () { S.view = 'minha'; location.hash = '#/inbox'; ensureSelection(); rerenderInbox(); } },
        { group: 'Ir para', label: 'Encerrados', icon: 'circleCheck', run: function () { S.view = 'encerrados'; location.hash = '#/inbox'; ensureSelection(); rerenderInbox(); } },
      ].concat(
        S.folders.map(function (f) {
          return { group: 'Pastas', label: f.name, icon: 'folder', run: function () { S.view = 'pasta:' + f.id; location.hash = '#/inbox'; ensureSelection(); rerenderInbox(); } };
        })
      );
      var acts = [
        { group: 'Ações', label: 'Atender o próximo da fila', icon: 'hand', run: nextUp },
        { group: 'Ações', label: 'Nova pasta', icon: 'folderPlus', run: function () { folderNameModal(null); } },
        { group: 'Ações', label: 'Nova nota interna', icon: 'note', run: function () { S.composer.mode = 'note'; renderThread(); var b = $('#composer-box'); if (b) b.focus(); } },
        { group: 'Ações', label: 'Transferir esta conversa', icon: 'arrowRightLeft', hint: 'F', run: function () { var c = conv(S.selected); if (c && c.assignee === D.ME.id && isOpen(c)) transferModal(c); } },
        { group: 'Ações', label: 'Fixar ou desafixar esta conversa', icon: 'pin', hint: 'P', run: function () { var c = conv(S.selected); if (c) togglePin(c); } },
        { group: 'Ações', label: 'Encerrar esta conversa', icon: 'circleCheck', hint: 'E', run: function () { var c = conv(S.selected); if (c && c.assignee === D.ME.id && isOpen(c)) closeConv(c); } },
      ].concat(
        THEMES.map(function (t) {
          return { group: 'Aparência', label: 'Tema ' + t.name + (S.theme === t.id ? ' (atual)' : ''), icon: t.dark ? 'moon' : 'sun', run: function () { applyTheme(t.id); } };
        })
      );
      nav.concat(acts).forEach(function (it) {
        if (!q || key(it.label).indexOf(key(q)) >= 0) out.push(it);
      });
      if (q) {
        D.STUDENTS.filter(function (st) {
          return key(st.name + ' ' + st.ra + ' ' + st.course).indexOf(key(q)) >= 0;
        })
          .slice(0, 6)
          .forEach(function (st) {
            out.push({
              group: 'Alunos',
              label: st.name,
              sub: 'RA ' + st.ra + ' · ' + st.course,
              icon: 'user',
              run: function () { location.hash = '#/contatos/' + st.id; },
            });
          });
        D.CONVERSATIONS.filter(function (c) {
          return key(c.subject + ' ' + student(c.studentId).name).indexOf(key(q)) >= 0;
        })
          .slice(0, 6)
          .forEach(function (c) {
            out.push({
              group: 'Conversas',
              label: c.subject,
              sub: student(c.studentId).name + ' · ' + queue(c.queue).name,
              icon: 'messageSquare',
              run: function () { gotoConv(c.id); },
            });
          });
      }
      return out;
    }

    function paint() {
      var q = input.value.trim();
      items = build(q);
      cursor = 0;
      var lastGroup = null;
      listEl.innerHTML = items.length
        ? items
            .map(function (it, i) {
              var head = it.group !== lastGroup ? '<div class="palette__group">' + esc(it.group) + '</div>' : '';
              lastGroup = it.group;
              return (
                head +
                '<button class="menuitem" data-i="' +
                i +
                '"' +
                (i === 0 ? ' data-active="true"' : '') +
                '>' +
                I(it.icon, 15) +
                '<span class="menuitem__label">' +
                esc(it.label) +
                (it.sub ? '<span class="menuitem__sub">' + esc(it.sub) + '</span>' : '') +
                '</span>' +
                (it.hint ? '<span class="menuitem__hint">' + esc(it.hint) + '</span>' : '') +
                '</button>'
              );
            })
            .join('')
        : '<p style="padding:24px;text-align:center;font-size:12.5px;color:var(--ink-4)">Nada encontrado para "' + esc(q) + '".</p>';
    }

    function move(d) {
      if (!items.length) return;
      cursor = (cursor + d + items.length) % items.length;
      $$('.menuitem', listEl).forEach(function (b) {
        b.setAttribute('data-active', b.dataset.i === String(cursor));
      });
      var active = $('[data-i="' + cursor + '"]', listEl);
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[cursor]) { close(); items[cursor].run(); }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); close(); }
    }

    input.addEventListener('input', paint);
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('.menuitem');
      if (!b) return;
      close();
      items[parseInt(b.dataset.i, 10)].run();
    });
    scrim.addEventListener('mousedown', close);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', onKey, true);
    paint();
    setTimeout(function () { input.focus(); }, 40);
  }

  /** Atalhos de teclado — a tecla `?` é a convenção que a Intercom, o Linear
      e o Slack compartilham, e um atendente de oito horas por dia vive nela. */
  function openShortcuts() {
    var groups = [
      {
        name: 'Navegação',
        items: [
          ['Ctrl K', 'Busca e comandos'],
          ['G depois I', 'Ir para o Inbox'],
          ['G depois D', 'Ir para Desempenho'],
          ['G depois C', 'Ir para Contatos'],
          ['J / K', 'Próxima / anterior na fila'],
          ['Esc', 'Fechar o que está aberto'],
        ],
      },
      {
        name: 'Na conversa',
        items: [
          ['A', 'Assumir da fila'],
          ['F', 'Transferir para outra fila'],
          ['E', 'Encerrar atendimento'],
          ['P', 'Fixar no topo'],
          ['M', 'Mover para pasta'],
          ['T', 'Marcadores'],
          ['R', 'Responder ao aluno'],
          ['N', 'Nota interna'],
        ],
      },
      {
        name: 'No composer',
        items: [
          ['Enter', 'Enviar'],
          ['Shift Enter', 'Quebrar linha'],
          ['#', 'Inserir template'],
          ['Ctrl Shift N', 'Alternar nota interna'],
        ],
      },
    ];
    openModal({
      icon: 'command',
      title: 'Atalhos de teclado',
      sub: 'O suficiente para trabalhar a fila inteira sem tirar a mão do teclado.',
      size: 'md',
      body:
        '<div class="grid grid--2" style="gap:24px">' +
        groups
          .map(function (g) {
            return (
              '<div><div class="section-label" style="margin-bottom:10px"><h2>' +
              esc(g.name) +
              '</h2></div>' +
              g.items
                .map(function (it) {
                  return (
                    '<div class="kv"><span class="kv__k" style="font-size:12.5px;color:var(--ink-2)">' +
                    esc(it[1]) +
                    '</span><span class="kv__v">' +
                    it[0]
                      .split(' ')
                      .map(function (k) {
                        return '<span class="kbd" style="background:var(--surface-2)">' + esc(k) + '</span>';
                      })
                      .join(' ') +
                    '</span></div>'
                  );
                })
                .join('') +
              '</div>'
            );
          })
          .join('') +
        '</div>',
      footer: '<button class="btn btn--sm btn--secondary" data-close>Fechar</button>',
    });
  }

  /* ======================================================================
     Colunas redimensionáveis
     ----------------------------------------------------------------------
     Cada atendente trabalha num monitor e com um recorte diferente: quem vive
     na fila quer a lista larga, quem escreve muito quer a conversa larga. As
     três larguras são variáveis CSS, então arrastar é só escrever a variável
     — o layout inteiro (inclusive a pílula da nav e a pastilha do segmented)
     acompanha sozinho. A escolha fica salva por navegador.
     ====================================================================== */

  var PANES = {
    views: { varName: '--views-w', min: 180, max: 340, dir: 1, fallback: 236 },
    list: { varName: '--list-w', min: 280, max: 560, dir: 1, fallback: 356 },
    context: { varName: '--context-w', min: 260, max: 460, dir: -1, fallback: 332 },
  };

  function resizerHtml(pane, side, label) {
    return (
      '<div class="resizer resizer--' +
      side +
      '" data-resize="' +
      pane +
      '" role="separator" aria-orientation="vertical" tabindex="0" aria-label="' +
      esc(label) +
      '" title="Arraste para ajustar · duplo clique para restaurar"></div>'
    );
  }

  /**
   * A largura atual da coluna. Lê a variável CSS, mas cai na largura medida do
   * painel se ela ainda não resolveu — sem isso, um arrasto iniciado antes de
   * a folha de estilo aplicar começaria do zero e a coluna saltaria para o
   * mínimo no primeiro pixel de movimento.
   */
  function paneWidth(pane) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(PANES[pane].varName));
    if (v > 0) return v;
    var el = $(pane === 'views' ? '#col-views' : '#pane-' + pane);
    if (el && el.offsetWidth > 0) return el.offsetWidth;
    return PANES[pane].fallback;
  }

  function setPaneWidth(pane, px) {
    var cfg = PANES[pane];
    var w = Math.max(cfg.min, Math.min(cfg.max, Math.round(px)));
    document.documentElement.style.setProperty(cfg.varName, w + 'px');
    return w;
  }

  function saveWidths() {
    try {
      var out = {};
      Object.keys(PANES).forEach(function (k) {
        var v = document.documentElement.style.getPropertyValue(PANES[k].varName);
        if (v) out[k] = v;
      });
      localStorage.setItem('atendimento.v1.widths', JSON.stringify(out));
    } catch (e) {
      /* storage indisponível — a sessão continua, só não lembra */
    }
  }

  function loadWidths() {
    try {
      var raw = localStorage.getItem('atendimento.v1.widths');
      if (!raw) return;
      var saved = JSON.parse(raw);
      Object.keys(saved).forEach(function (k) {
        if (PANES[k]) document.documentElement.style.setProperty(PANES[k].varName, saved[k]);
      });
    } catch (e) {
      /* valor corrompido — cai nos padrões responsivos */
    }
  }

  function startResize(handle, startEvent) {
    var pane = handle.dataset.resize;
    var cfg = PANES[pane];
    if (!cfg) return;
    var startX = startEvent.clientX;
    var startW = paneWidth(pane);

    document.body.classList.add('is-resizing');
    handle.setAttribute('data-active', 'true');
    if (handle.setPointerCapture && startEvent.pointerId !== undefined) {
      handle.setPointerCapture(startEvent.pointerId);
    }

    function onMove(e) {
      setPaneWidth(pane, startW + (e.clientX - startX) * cfg.dir);
    }
    function onUp() {
      document.body.classList.remove('is-resizing');
      handle.removeAttribute('data-active');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      /* A pílula e a pastilha foram medidas na largura antiga. */
      syncPills();
      syncSegThumbs(document);
      saveWidths();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    startEvent.preventDefault();
  }

  function nextUp() {
    var pool = D.CONVERSATIONS.filter(function (c) {
      return isOpen(c) && !c.assignee;
    }).sort(function (a, b) {
      return sla(a).mins - sla(b).mins;
    });
    if (!pool.length) {
      toast('Nada na fila', { sub: 'Todas as conversas já têm dono.', icon: 'circleCheck' });
      return;
    }
    var c = pool[0];
    if (S.route.name !== 'inbox') location.hash = '#/inbox';
    S.view = 'minha';
    claim(c);
    gotoConv(c.id);
  }

  function gotoConv(id) {
    var c = conv(id);
    if (!c) return;
    /* Conversa de outra pessoa ou da fila abre ao lado da caixa atual, só
       para leitura — a lista do atendente continua sendo a dele. */
    if (!inView(c, S.view)) {
      if (c.assignee === D.ME.id) S.view = c.status === 'encerrado' ? 'encerrados' : 'minha';
    }
    location.hash = '#/inbox/' + id;
  }

  /* ======================================================================
     Aparência
     ----------------------------------------------------------------------
     Quatro temas: dois claros e dois escuros. O botão do rail abre o seletor;
     escolher um revela o tema novo num círculo que nasce do botão — o mesmo
     efeito do Sucesso ao Aluno (View Transitions API + clip-path). Sem a API,
     ou com movimento reduzido, a troca é seca.
     ====================================================================== */

  var THEMES = [
    { id: 'claro', name: 'Claro', desc: 'O padrão. Branco e cinza neutro.', dark: false, sw: ['#f3f4f6', '#ffffff', '#eef0f2', '#00509d', '#101317'] },
    { id: 'nevoa', name: 'Névoa', desc: 'Claro de baixo brilho, para turnos longos.', dark: false, sw: ['#d9e1ec', '#f2f5f9', '#e5ebf3', '#00509d', '#0e1621'] },
    { id: 'grafite', name: 'Grafite', desc: 'Escuro neutro, preto acinzentado.', dark: true, sw: ['#121315', '#1b1c1f', '#232427', '#2f74c0', '#e8e9eb'] },
    { id: 'marinho', name: 'Marinho', desc: 'Escuro com o azul da UniAnchieta.', dark: true, sw: ['#0d1522', '#132032', '#19283d', '#2c75c3', '#e5ebf2'] },
  ];

  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }
  function isDarkTheme(id) {
    return themeById(id).dark;
  }

  function setThemeAttrs(id) {
    var t = themeById(id);
    var root = document.documentElement;
    root.classList.toggle('dark', t.dark);
    root.setAttribute('data-theme', t.id);
    root.style.colorScheme = t.dark ? 'dark' : 'light';
    var meta = $('#theme-color');
    if (meta) meta.setAttribute('content', t.sw[0]);
    S.theme = t.id;
    try {
      localStorage.setItem('atendimento.v1.theme', t.id);
    } catch (e) {
      /* storage indisponível — vale só para esta sessão */
    }
  }

  function themeOrigin() {
    var btn = $('[data-act="theme"]');
    if (!btn) return { x: 48, y: window.innerHeight - 48 };
    var r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function applyTheme(id, origin) {
    if (id === S.theme) return;
    var apply = function () {
      setThemeAttrs(id);
      renderRail();
      syncPills();
      if (S.route.name === 'dashboard') renderDashboard();
    };
    var root = document.documentElement;
    var start = document.startViewTransition && document.startViewTransition.bind(document);
    if (!start || prefersReducedMotion()) {
      apply();
      return;
    }
    var o = origin || themeOrigin();
    /* Raio até o canto mais distante: o círculo tem de cobrir a tela inteira. */
    var radius = Math.hypot(Math.max(o.x, window.innerWidth - o.x), Math.max(o.y, window.innerHeight - o.y));
    var transition = start(apply);
    transition.ready.then(function () {
      root.animate(
        { clipPath: ['circle(0px at ' + o.x + 'px ' + o.y + 'px)', 'circle(' + radius + 'px at ' + o.x + 'px ' + o.y + 'px)'] },
        { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  }

  function themePicker(anchor) {
    var html =
      '<div class="pop__head"><span class="pop__title">Aparência</span></div>' +
      '<div class="theme-grid">' +
      THEMES.map(function (t) {
        return (
          '<button class="theme-card" data-theme-pick="' +
          t.id +
          '" aria-pressed="' +
          (S.theme === t.id) +
          '">' +
          /* Miniatura do app no tema: canvas, placa, lista e um botão azul. */
          '<span class="theme-card__preview" style="background:' +
          t.sw[0] +
          '"><span class="theme-card__rail"><i style="background:' +
          t.sw[3] +
          '"></i></span><span class="theme-card__slab" style="background:' +
          t.sw[1] +
          '"><span class="theme-card__line" style="background:' +
          t.sw[4] +
          ';width:58%"></span><span class="theme-card__row" style="background:' +
          t.sw[2] +
          '"></span><span class="theme-card__row" style="background:' +
          t.sw[2] +
          ';width:72%"></span><span class="theme-card__btn" style="background:' +
          t.sw[3] +
          '"></span></span></span>' +
          '<span class="theme-card__text"><span class="theme-card__name">' +
          esc(t.name) +
          (S.theme === t.id ? I('check', 12) : '') +
          '</span><span class="theme-card__desc">' +
          esc(t.desc) +
          '</span></span></button>'
        );
      }).join('') +
      '</div>';
    var pop = openPop(anchor, html, { width: 336 });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('[data-theme-pick]');
      if (!b) return;
      var o = themeOrigin();
      /* Fecha na hora: a transição fotografa a tela, e o menu não pode
         aparecer no meio da revelação. */
      closePop(true);
      applyTheme(b.dataset.themePick, o);
    });
  }

  /* ======================================================================
     11. EVENTOS
     ====================================================================== */

  function handleAct(act, el) {
    var c = S.selected ? conv(S.selected) : null;
    switch (act) {
      case 'palette':
        openPalette();
        break;
      case 'shortcuts':
        openShortcuts();
        break;
      case 'collapse-views':
      case 'expand-views':
        S.viewsCollapsed = act === 'collapse-views';
        try {
          localStorage.setItem('atendimento.v1.views', S.viewsCollapsed ? 'off' : 'on');
        } catch (err) {
          /* storage indisponível — vale só para esta sessão */
        }
        $('#app').dataset.views = S.viewsCollapsed ? 'off' : 'on';
        renderList();
        syncPills();
        break;
      case 'theme':
        themePicker(el);
        break;
      case 'team':
        openTeam(el);
        break;
      case 'me':
        openMenu(
          el,
          [
            { label: D.ME.name, sub: D.ME.role, icon: 'user' },
            { sep: true },
            { label: 'Disponível', act: 'p', value: 'online', checked: D.ME.presence === 'online' },
            { label: 'Em atendimento', act: 'p', value: 'ocupado', checked: D.ME.presence === 'ocupado' },
            { label: 'Ausente', act: 'p', value: 'ausente', checked: D.ME.presence === 'ausente' },
            { sep: true },
            { label: 'Aparência', sub: themeById(S.theme).name, act: 'theme', icon: 'palette' },
            { label: 'Sair', act: 'out', icon: 'logOut' },
          ],
          function (a, v) {
            if (a === 'p') {
              D.ME.presence = v;
              renderRail();
              renderViewsColumn();
              toast('Seu status: ' + PRESENCE[v].label, { icon: 'userCheck' });
            } else if (a === 'theme') themePicker($('[data-act="theme"]') || el);
            else if (a === 'out') toast('Sessão encerrada no protótipo', { icon: 'logOut' });
          },
          { width: 240 }
        );
        break;
      case 'notifications':
        openMenu(
          el,
          [
            { label: 'Aluna respondeu na ouvidoria', sub: 'Beatriz Lacerda · reposição das aulas · há 25 min', icon: 'megaphone', act: 'go', value: 'c22' },
            { label: 'Nota da Ouvidoria para você', sub: 'Mariana Albuquerque · estorno aprovado', icon: 'note', act: 'go', value: 'c21' },
            { label: 'Nova manifestação na fila', sub: 'Carlos Eduardo · nota do TCC · urgente', icon: 'inbox', act: 'go', value: 'c23' },
          ],
          function (a, v) {
            if (a === 'go') gotoConv(v);
          },
          { width: 320, align: 'left' }
        );
        break;
      case 'filters':
        filterPopover(el);
        break;
      case 'sort':
        openMenu(
          el,
          [
            { label: 'SLA mais crítico', act: 's', value: 'sla', checked: S.sort === 'sla' },
            { label: 'Atividade mais recente', act: 's', value: 'recentes', checked: S.sort === 'recentes' },
            { label: 'Esperando há mais tempo', act: 's', value: 'antigos', checked: S.sort === 'antigos' },
            { label: 'Prioridade', act: 's', value: 'prioridade', checked: S.sort === 'prioridade' },
          ],
          function (a, v) {
            S.sort = v;
            renderList();
          },
          { width: 240, align: 'right' }
        );
        break;
      case 'bulk':
        S.bulk = S.bulk === null ? [] : null;
        renderList();
        break;
      case 'bulk-folder':
        if (S.bulk && S.bulk.length) {
          var sel = S.bulk.map(conv).filter(function (k) {
            return k.assignee === D.ME.id;
          });
          S.bulk = null;
          folderPicker(el, sel);
        }
        break;
      case 'bulk-transfer':
        if (S.bulk && S.bulk.length)
          transferModal(
            S.bulk.map(conv).filter(function (k) {
              return k.assignee === D.ME.id && isOpen(k);
            })
          );
        break;
      case 'bulk-close':
        S.bulk.forEach(function (id) {
          var k = conv(id);
          if (k.assignee !== D.ME.id) return;
          k.status = 'encerrado';
          k.closedAt = Date.now();
        });
        toast(S.bulk.length + ' conversas encerradas', { icon: 'circleCheck' });
        S.bulk = null;
        rerenderInbox();
        break;
      case 'clear-filters':
        S.filters = {};
        S.search = '';
        /* Limpar o recorte pode devolver conversas a uma caixa que estava
           vazia — então a seleção volta junto, em vez de deixar o painel da
           conversa no estado vazio ao lado de uma lista cheia. */
        ensureSelection();
        rerenderInbox();
        break;
      case 'next-up':
        nextUp();
        break;
      case 'claim':
        if (c) claim(c);
        break;
      case 'close-conv':
        if (c) closeConv(c);
        break;
      case 'reopen':
        if (c) {
          c.status = 'aberto';
          c.closedAt = null;
          c.slaDue = Date.now() + 4 * 3600000;
          if (!c.assignee) c.assignee = D.ME.id;
          rerenderInbox();
          toast('Atendimento reaberto', { icon: 'rotateCcw' });
        }
        break;
      case 'transfer':
        if (c && c.assignee === D.ME.id && isOpen(c)) transferModal(c);
        break;
      case 'pin':
        if (c) togglePin(c);
        break;
      case 'move-folder':
        if (c) folderPicker(el, c);
        break;
      case 'new-folder':
        S.groups.pastas = true;
        S.newFolder = true;
        renderViewsColumn();
        break;
      case 'open-ouv-history':
        S.ctxTab = 'historico';
        if (!S.ctxOpen) {
          S.ctxOpen = true;
          renderMain(true);
        } else renderContext();
        break;
      case 'copilot-ouv':
        runCopilot('ouv-resumo');
        break;
      case 'dock-note-save':
        saveDockNote();
        break;
      case 'copilot-ask':
        var qa = $('#copilot-ask');
        if (qa) askCopilot(qa.value);
        break;
      case 'dash-range':
        rangePopover(el);
        break;
      case 'priority':
        if (c)
          openMenu(
            el,
            [
              { label: 'Urgente', act: 'p', value: 'urgente', checked: c.priority === 'urgente', icon: 'flag' },
              { label: 'Alta', act: 'p', value: 'alta', checked: c.priority === 'alta', icon: 'flag' },
              { label: 'Normal', act: 'p', value: 'normal', checked: c.priority === 'normal' },
              { label: 'Baixa', act: 'p', value: 'baixa', checked: c.priority === 'baixa' },
            ],
            function (a, v) {
              c.priority = v;
              rerenderInbox();
              toast('Prioridade: ' + v, { icon: 'flag' });
            },
            { width: 200, align: 'right' }
          );
        break;
      case 'tags':
        if (c) tagPopover(el, c);
        break;
      case 'more':
        if (c) {
          var mine = c.assignee === D.ME.id;
          var fd = c.folder ? folder(c.folder) : null;
          openMenu(
            el,
            [
              { label: c.pinned ? 'Desafixar' : 'Fixar no topo', act: 'pin', icon: c.pinned ? 'pinOff' : 'pin', hint: 'P' },
              mine ? { label: 'Mover para pasta', sub: fd ? fd.name : 'nenhuma', act: 'folder', icon: 'folderInput', hint: 'M' } : {},
              mine && isOpen(c) ? { label: 'Transferir para outra fila', act: 'transfer', icon: 'arrowRightLeft', hint: 'F' } : {},
              { sep: true },
              mine ? { label: 'Prioridade', sub: c.priority.charAt(0).toUpperCase() + c.priority.slice(1), act: 'prio', icon: 'flag' } : {},
              mine ? { label: 'Marcadores', sub: c.tags.length ? c.tags.join(', ') : 'nenhum', act: 'tag', icon: 'tag', hint: 'T' } : {},
              { label: 'Ver ficha 360 do aluno', act: '360', icon: 'user' },
              { label: 'Copiar link da conversa', act: 'link', icon: 'link' },
              { label: 'Exportar transcrição', act: 'export', icon: 'download' },
            ],
            function (a) {
              if (a === 'pin') togglePin(c);
              else if (a === 'folder') folderPicker(el, c);
              else if (a === 'transfer') transferModal(c);
              else if (a === 'prio') handleAct('priority', el);
              else if (a === 'tag') tagPopover(el, c);
              else if (a === '360') location.hash = '#/contatos/' + c.studentId;
              else if (a === 'link') toast('Link copiado', { sub: location.origin + '/#/inbox/' + c.id, icon: 'link' });
              else if (a === 'export') toast('Transcrição exportada', { sub: 'conversa-' + c.id + '.pdf', icon: 'download' });
            },
            { width: 270, align: 'right' }
          );
        }
        break;
      case 'more-student':
        openMenu(
          el,
          [
            { label: 'Adicionar marcador', act: 'tag', icon: 'tag' },
            { label: 'Exportar ficha em PDF', act: 'pdf', icon: 'download' },
            { label: 'Copiar RA', act: 'ra', icon: 'copy' },
            { sep: true },
            { label: 'Abrir no sistema acadêmico', act: 'ext', icon: 'externalLink' },
          ],
          function (a) {
            if (a === 'ra') toast('RA copiado', { icon: 'copy' });
            else if (a === 'pdf') toast('Ficha exportada', { sub: 'ficha-' + student(S.route.id).ra + '.pdf', icon: 'download' });
            else toast('Ação simulada no protótipo', { icon: 'info' });
          },
          { width: 250, align: 'right' }
        );
        break;
      case 'toggle-context':
        S.ctxOpen = !S.ctxOpen;
        renderMain(true);
        break;
      case 'macro':
        if (c) macroPopover(el, c);
        break;
      case 'attach':
        toast('Anexo simulado', { sub: 'declaracao-matricula.pdf · 214 KB', icon: 'paperclip' });
        break;
      case 'emoji':
        openPop(
          el,
          '<div style="padding:10px;display:grid;grid-template-columns:repeat(8,1fr);gap:2px">' +
            ['🙂', '👍', '🎓', '📄', '✅', '⏰', '💙', '🙏', '😉', '📌', '📚', '💬', '🗓️', '✨', '🤝', '👋']
              .map(function (e) {
                return '<button class="iconbtn" data-emoji="' + e + '" style="font-size:16px">' + e + '</button>';
              })
              .join('') +
            '</div>',
          { width: 272, align: 'right' }
        ).addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-emoji]');
          if (!b) return;
          closePop();
          var box = $('#composer-box');
          if (box) {
            box.value += b.dataset.emoji;
            S.composer.text = box.value;
            box.focus();
          }
        });
        break;
      case 'ai-compose':
        S.ctxTab = 'copilot';
        renderContext();
        runCopilot(S.composer.text ? 'empatia' : 'sugerir');
        break;
      case 'send':
        sendMessage();
        break;
      case 'copilot-insert':
        if (S.copilot.insert) {
          if (S.copilot.insertMode === 'note') {
            S.noteDraft = S.copilot.insert;
            S.copilot = { running: false, title: null, body: '', chips: null, insert: null };
            renderContext();
            var dn = $('#dock-note');
            if (dn) {
              dn.value = S.noteDraft;
              autoGrowNote(dn);
              dn.focus();
            }
            toast('Nota pronta no painel', { sub: 'Revise e salve com Enter.', icon: 'note' });
            break;
          }
          insertInComposer(S.copilot.insert, c);
          S.copilot = { running: false, title: null, body: '', chips: null, insert: null };
          renderContext();
          toast('Sugestão inserida no composer', { sub: 'Revise antes de enviar.', icon: 'sparkles' });
        }
        break;
      case 'copilot-dismiss':
        S.copilot = { running: false, title: null, body: '', chips: null, insert: null };
        renderContext();
        break;
      case 'open-360':
        if (c) location.hash = '#/contatos/' + c.studentId;
        break;
      case 'add-note':
        var dk = $('#dock-note');
        if (dk) dk.focus();
        break;
      case 'call':
        toast('Discando…', { sub: 'Integração de telefonia simulada.', icon: 'phone' });
        break;
      case 'mail':
        toast('Rascunho de e-mail aberto', { icon: 'mail' });
        break;
      case 'sync':
        toast('Cadastro sincronizado', { sub: 'Dados acadêmicos e financeiros atualizados agora.', icon: 'refresh' });
        break;
      case 'negotiate':
        toast('Simulação enviada ao Financeiro', { sub: 'Proposta de 3x sem juros gerada.', icon: 'banknote' });
        break;
      case 'export':
        toast('Exportação gerada', { sub: 'meu-desempenho-' + new Date().toISOString().slice(0, 10) + '.csv', icon: 'download' });
        break;
      case 'new-conversation':
        toast('Nova conversa', { sub: 'Busque o aluno pelo RA para iniciar.', icon: 'plus', action: 'Buscar', onAction: openPalette });
        break;
      case 'back-contacts':
        location.hash = '#/contatos';
        break;
      case 'save-note':
        var ta = $('#new-note');
        if (ta && ta.value.trim()) {
          student(S.route.id).notes.unshift({ author: D.ME.id, at: Date.now(), text: ta.value.trim() });
          render360();
          toast('Nota salva na ficha do aluno', { icon: 'note' });
        }
        break;
      case 'clear-contact-search':
        S.contacts.search = '';
        renderContacts();
        break;
      case 'clear-contact-filters':
        S.contacts.filters = {};
        S.contacts.search = '';
        renderContacts();
        renderViewsColumn();
        break;
      case 'quote':
        var m = el.dataset.msg;
        var found = null;
        if (c) c.messages.forEach(function (x) { if (String(x.at) === m) found = x; });
        if (found) {
          insertInComposer('> ' + found.text.split('\n')[0] + '\n\n', c);
        }
        break;
      case 'copy-msg':
        toast('Mensagem copiada', { icon: 'copy' });
        break;
    }
  }

  function filterPopover(anchor) {
    var mods = ['Presencial', 'Híbrido', 'EAD'];
    var html =
      '<div class="pop__head"><span class="pop__title">Filtrar a fila</span></div>' +
      '<div class="pop__list scroll-slim" style="padding:0 10px 10px">' +
      '<p class="label" style="margin-top:6px">Canal</p><div class="tagrow">' +
      D.CHANNELS.map(function (ch) {
        return '<button class="chip" data-filter="canal" data-value="' + ch.id + '" aria-pressed="' + (S.filters.canal === ch.id) + '">' + esc(ch.name) + '</button>';
      }).join('') +
      '</div>' +
      '<p class="label" style="margin-top:12px">Fila</p><div class="tagrow">' +
      D.QUEUES.map(function (q) {
        return '<button class="chip" data-filter="fila" data-value="' + q.id + '" aria-pressed="' + (S.filters.fila === q.id) + '">' + esc(q.name) + '</button>';
      }).join('') +
      '</div>' +
      '<p class="label" style="margin-top:12px">Prioridade</p><div class="tagrow">' +
      ['urgente', 'alta', 'normal'].map(function (p) {
        return '<button class="chip" data-filter="prioridade" data-value="' + p + '" data-tone="' + (p === 'urgente' ? 'crit' : '') + '" aria-pressed="' + (S.filters.prioridade === p) + '">' + p.charAt(0).toUpperCase() + p.slice(1) + '</button>';
      }).join('') +
      '</div>' +
      '<p class="label" style="margin-top:12px">Modalidade</p><div class="tagrow">' +
      mods.map(function (m) {
        return '<button class="chip" data-filter="modalidade" data-value="' + m + '" aria-pressed="' + (S.filters.modalidade === m) + '">' + m + '</button>';
      }).join('') +
      '</div>' +
      '</div>' +
      '<div class="pop__foot" style="display:flex;justify-content:space-between;align-items:center">' +
      '<button class="linkbtn" data-pop-clear>Limpar tudo</button>' +
      '<button class="btn btn--xs btn--secondary" data-close-pop>Pronto</button></div>';

    var pop = openPop(anchor, html, { width: 320, align: 'right' });
    pop.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (chip) {
        var k = chip.dataset.filter;
        S.filters[k] = S.filters[k] === chip.dataset.value ? null : chip.dataset.value;
        chip.setAttribute('aria-pressed', String(!!S.filters[k]));
        $$('[data-filter="' + k + '"]', pop).forEach(function (o) {
          if (o !== chip) o.setAttribute('aria-pressed', 'false');
        });
        renderList();
        return;
      }
      if (e.target.closest('[data-close-pop]')) closePop();
      if (e.target.closest('[data-pop-clear]')) {
        closePop();
        handleAct('clear-filters', anchor);
      }
    });
  }

  function contactFilterPopover(anchor, kind) {
    var opts =
      kind === 'modalidade'
        ? ['Presencial', 'Híbrido', 'EAD']
        : kind === 'unidade'
          ? ['Campus Jundiaí — Anchieta', 'Campus Jundiaí — Dr. Cavalcanti', 'Graduação EAD', 'Polo Várzea Paulista']
          : [
              { label: 'Com débito em aberto', value: 'com-debito' },
              { label: 'Sem débito', value: 'regular' },
            ];
    var items = opts.map(function (o) {
      var label = typeof o === 'string' ? o : o.label;
      var value = typeof o === 'string' ? o : o.value;
      return { label: label, act: 'set', value: value, checked: S.contacts.filters[kind] === value };
    });
    items.push({ sep: true });
    items.push({ label: 'Qualquer', act: 'clear' });
    openMenu(
      anchor,
      items,
      function (a, v) {
        if (a === 'clear') delete S.contacts.filters[kind];
        else S.contacts.filters[kind] = v;
        renderContacts();
      },
      { width: 280 }
    );
  }

  document.addEventListener('click', function (e) {
    var t = e.target;

    var viewBtn = t.closest('[data-view]');
    if (viewBtn) {
      S.view = viewBtn.dataset.view;
      S.bulk = null;
      S.enterAnim = true;
      if (S.route.name !== 'inbox') location.hash = '#/inbox';
      else {
        ensureSelection();
        rerenderInbox();
      }
      if (window.innerWidth <= 1180) {
        S.viewsOverlay = false;
        $('#app').dataset.viewsOverlay = 'false';
      }
      return;
    }
    var segBtn = t.closest('[data-segment]');
    if (segBtn) {
      S.contacts.segment = segBtn.dataset.segment;
      S.enterAnim = true;
      renderViewsColumn();
      renderContacts();
      return;
    }
    var group = t.closest('[data-group]');
    if (group) {
      var gid = group.dataset.group;
      S.groups[gid] = !S.groups[gid];
      group.setAttribute('aria-expanded', String(S.groups[gid]));
      var body = group.nextElementSibling;
      if (body) body.setAttribute('data-collapsed', String(!S.groups[gid]));
      /* A pílula acompanha a lista enquanto ela abre ou fecha. */
      var t0 = Date.now();
      (function follow() {
        syncPills();
        if (Date.now() - t0 < 300) requestAnimationFrame(follow);
      })();
      return;
    }
    var pin = t.closest('[data-pin]');
    if (pin) {
      e.stopPropagation();
      var pc = conv(pin.dataset.pin);
      if (pc) togglePin(pc);
      return;
    }
    var fm = t.closest('[data-folder-menu]');
    if (fm) {
      folderMenu(fm, fm.dataset.folderMenu);
      return;
    }
    var todo = t.closest('[data-todo]');
    if (todo) {
      S.todo = S.todo || {};
      var tk = S.selected + ':' + todo.dataset.todo;
      S.todo[tk] = !S.todo[tk];
      todo.setAttribute('aria-pressed', String(!!S.todo[tk]));
      todo.querySelector('svg').outerHTML = I(S.todo[tk] ? 'circleCheck' : 'circle', 14);
      return;
    }
    var askBtn = t.closest('[data-ask]');
    if (askBtn) {
      askCopilot(askBtn.dataset.ask);
      return;
    }
    var ho = t.closest('[data-hist-order]');
    if (ho) {
      S.histOrder = ho.dataset.histOrder;
      renderContext();
      return;
    }
    var check = t.closest('[data-check]');
    if (check) {
      e.stopPropagation();
      var id = check.dataset.check;
      var i = S.bulk.indexOf(id);
      if (i >= 0) S.bulk.splice(i, 1);
      else S.bulk.push(id);
      renderList();
      return;
    }
    var row = t.closest('[data-conv]');
    if (row) {
      if (S.bulk !== null) {
        var cid = row.dataset.conv;
        var j = S.bulk.indexOf(cid);
        if (j >= 0) S.bulk.splice(j, 1);
        else S.bulk.push(cid);
        renderList();
      } else {
        location.hash = '#/inbox/' + row.dataset.conv;
      }
      return;
    }
    var goto = t.closest('[data-goto-conv]');
    if (goto) {
      gotoConv(goto.dataset.gotoConv);
      return;
    }
    var hist = t.closest('[data-history]');
    if (hist) {
      openHistory(hist.dataset.history);
      return;
    }
    var stRow = t.closest('[data-student]');
    if (stRow && stRow.tagName === 'TR') {
      location.hash = '#/contatos/' + stRow.dataset.student;
      return;
    }
    var openView = t.closest('[data-open-view]');
    if (openView && openView.dataset.openView) {
      S.view = openView.dataset.openView;
      location.hash = '#/inbox';
      return;
    }
    var section = t.closest('[data-section]');
    if (section) {
      var sid = section.dataset.section;
      S.sections[sid] = S.sections[sid] === false ? true : false;
      section.setAttribute('aria-expanded', String(S.sections[sid]));
      var sbody = section.nextElementSibling;
      if (sbody) sbody.setAttribute('data-collapsed', String(!S.sections[sid]));
      return;
    }
    var ctxTab = t.closest('[data-ctx-tab]');
    if (ctxTab) {
      S.ctxTab = ctxTab.dataset.ctxTab;
      renderContext();
      return;
    }
    var mode = t.closest('[data-mode]');
    if (mode) {
      S.composer.mode = mode.dataset.mode;
      var box0 = $('#composer-box');
      if (box0) S.composer.text = box0.value;
      renderThread();
      var box1 = $('#composer-box');
      if (box1) box1.focus();
      return;
    }
    var cop = t.closest('[data-copilot]');
    if (cop) {
      runCopilot(cop.dataset.copilot);
      return;
    }
    var rev = t.closest('[data-reveal]');
    if (rev) {
      S.revealed[rev.dataset.reveal] = !S.revealed[rev.dataset.reveal];
      if (S.route.name === 'contatos' && S.route.id) render360();
      else renderContext();
      return;
    }
    var untag = t.closest('[data-untag]');
    if (untag) {
      var cc = conv(S.selected);
      var k2 = cc.tags.indexOf(untag.dataset.untag);
      if (k2 >= 0) cc.tags.splice(k2, 1);
      renderList();
      renderContext();
      return;
    }
    var cf = t.closest('[data-clear-filter]');
    if (cf) {
      S.filters[cf.dataset.clearFilter] = null;
      renderList();
      return;
    }
    if (t.closest('[data-clear-search]')) {
      S.search = '';
      renderList();
      return;
    }
    var tab = t.closest('[data-tab]');
    if (tab) {
      S.contactTab = tab.dataset.tab;
      render360();
      return;
    }
    var dp = t.closest('[data-dash-period]');
    if (dp) {
      S.dashPeriod = dp.dataset.dashPeriod;
      renderDashboard();
      return;
    }
    var dd = t.closest('[data-dist]');
    if (dd) {
      S.dashDist = dd.dataset.dist;
      renderDashboard();
      return;
    }
    var sc = t.closest('[data-sort-col]');
    if (sc) {
      var kk = sc.dataset.sortCol;
      if (S.contacts.sortKey === kk) S.contacts.sortDir = S.contacts.sortDir === 'asc' ? 'desc' : 'asc';
      else {
        S.contacts.sortKey = kk;
        S.contacts.sortDir = kk === 'nome' || kk === 'curso' ? 'asc' : 'desc';
      }
      renderContacts();
      return;
    }
    var cfil = t.closest('[data-contact-filter]');
    if (cfil) {
      contactFilterPopover(cfil, cfil.dataset.contactFilter);
      return;
    }
    var bar = t.closest('[data-bar]');
    if (bar) {
      toast('Recorte aplicado', { sub: bar.dataset.bar + ' — a fila abre filtrada por este assunto.', icon: 'listFilter' });
      return;
    }
    var act = t.closest('[data-act]');
    if (act) {
      handleAct(act.dataset.act, act);
      return;
    }
  });

  /* Busca da lista, busca de contatos e composer: input sem re-render. */
  document.addEventListener('input', function (e) {
    if (e.target.id === 'composer-box') {
      S.composer.text = e.target.value;
      autoGrow(e.target);
      /* "#" no início de uma palavra abre os templates, como no sistema
         antigo — é o atalho que a equipe já tem no dedo. */
      var v = e.target.value;
      if (/(^|\s)#$/.test(v)) {
        var c = conv(S.selected);
        if (c) macroPopover(e.target, c);
      }
    } else if (e.target.id === 'dock-note') {
      S.noteDraft = e.target.value;
      autoGrowNote(e.target);
    } else if (e.target.id === 'copilot-ask') {
      S.ask.q = e.target.value;
    } else if (e.target.id === 'contacts-search') {
      S.contacts.search = e.target.value;
      clearTimeout(e.target._t);
      e.target._t = setTimeout(function () {
        var pos = document.activeElement === $('#contacts-search');
        renderContacts();
        if (pos) {
          var f = $('#contacts-search');
          f.focus();
          f.setSelectionRange(f.value.length, f.value.length);
        }
      }, 220);
    }
  });

  document.addEventListener('keydown', function (e) {
    var handle = e.target.closest && e.target.closest('[data-resize]');
    if (handle && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      var cfg = PANES[handle.dataset.resize];
      var step = (e.key === 'ArrowRight' ? 16 : -16) * cfg.dir;
      setPaneWidth(handle.dataset.resize, paneWidth(handle.dataset.resize) + step);
      syncPills();
      syncSegThumbs(document);
      saveWidths();
      return;
    }
    if (e.target.id === 'new-folder-input') {
      if (e.key === 'Enter') {
        e.preventDefault();
        var nm = e.target.value.trim();
        S.newFolder = false;
        if (nm) {
          var nf = createFolder(nm);
          toast('Pasta criada', { icon: 'folderPlus', sub: nf.name + ' · arraste conversas para ela' });
        }
        renderViewsColumn();
        syncPills();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        S.newFolder = false;
        renderViewsColumn();
        syncPills();
      }
      return;
    }
    if (e.target.id === 'dock-note') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveDockNote();
      }
      return;
    }
    if (e.target.id === 'copilot-ask') {
      if (e.key === 'Enter') {
        e.preventDefault();
        askCopilot(e.target.value);
      }
      return;
    }
    if (e.target.id === 'composer-box') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        S.composer.mode = S.composer.mode === 'note' ? 'reply' : 'note';
        S.composer.text = e.target.value;
        renderThread();
        var b = $('#composer-box');
        if (b) b.focus();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (popLayer) {
        closePop();
        return;
      }
      if (modalStack.length) {
        modalStack[modalStack.length - 1].close();
        return;
      }
      if (S.bulk !== null) {
        S.bulk = null;
        renderList();
      }
      return;
    }

    var typing = /^(input|textarea|select)$/i.test(e.target.tagName);
    if (typing || modalStack.length) return;

    /* g + tecla: navegação entre as três áreas, como na Intercom. */
    if (e.key.toLowerCase() === 'g') {
      window.__g = true;
      setTimeout(function () {
        window.__g = false;
      }, 900);
      return;
    }
    if (window.__g) {
      window.__g = false;
      var k = e.key.toLowerCase();
      if (k === 'i') location.hash = '#/inbox';
      else if (k === 'd') location.hash = '#/dashboard';
      else if (k === 'c') location.hash = '#/contatos';
      return;
    }

    if (S.route.name !== 'inbox') return;
    var list = listConversations();
    var idx = list.findIndex(function (c) {
      return c.id === S.selected;
    });
    var kk = e.key.toLowerCase();

    if (kk === 'j' || e.key === 'ArrowDown') {
      if (!list.length) return;
      e.preventDefault();
      location.hash = '#/inbox/' + list[Math.min(list.length - 1, idx + 1)].id;
    } else if (kk === 'k' || e.key === 'ArrowUp') {
      if (!list.length) return;
      e.preventDefault();
      location.hash = '#/inbox/' + list[Math.max(0, idx - 1)].id;
    } else if (kk === 'a') {
      var c1 = conv(S.selected);
      if (c1 && !c1.assignee && isOpen(c1)) claim(c1);
    } else if (kk === 'f') {
      var cf1 = conv(S.selected);
      if (cf1 && cf1.assignee === D.ME.id && isOpen(cf1)) transferModal(cf1);
    } else if (kk === 'p') {
      var cp1 = conv(S.selected);
      if (cp1) togglePin(cp1);
    } else if (kk === 'm') {
      var cm1 = conv(S.selected);
      if (cm1 && cm1.assignee === D.ME.id) folderPicker($('[data-act="more"]') || document.body, cm1);
    } else if (kk === 'e') {
      var c2 = conv(S.selected);
      if (c2 && c2.assignee === D.ME.id && isOpen(c2)) closeConv(c2);
    } else if (kk === 'n') {
      S.composer.mode = 'note';
      renderThread();
      var bx = $('#composer-box');
      if (bx) bx.focus();
    } else if (kk === 'r') {
      S.composer.mode = 'reply';
      renderThread();
      var bx2 = $('#composer-box');
      if (bx2) bx2.focus();
    } else if (kk === 't') {
      var c4 = conv(S.selected);
      if (c4) tagPopover($('[data-act="tags"]') || document.body, c4);
    } else if (e.key === '/') {
      e.preventDefault();
      openPalette();
    } else if (e.key === '?') {
      e.preventDefault();
      openShortcuts();
    }
  });

  document.addEventListener(
    'blur',
    function (e) {
      if (e.target.id !== 'new-folder-input' || !S.newFolder) return;
      var nm = e.target.value.trim();
      S.newFolder = false;
      if (nm) createFolder(nm);
      setTimeout(function () {
        renderViewsColumn();
        syncPills();
      }, 0);
    },
    true
  );

  /* Arrastar uma conversa para uma pasta. "Minha caixa" também recebe: soltar
     lá tira a conversa da pasta. */
  var dragId = null;
  document.addEventListener('dragstart', function (e) {
    var row = e.target.closest && e.target.closest('.conv[draggable="true"]');
    if (!row) return;
    var dc = conv(row.dataset.conv);
    if (!dc || dc.assignee !== D.ME.id) {
      e.preventDefault();
      return;
    }
    dragId = row.dataset.conv;
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', dragId);
    } catch (err) {
      /* IE/Edge antigo — o id fica em dragId */
    }
    row.classList.add('is-dragging');
    document.body.classList.add('is-dragging-conv');
    hideTip();
  });
  /* A limpeza roda no drop E no dragend: soltar numa pasta redesenha a
     lista, a linha arrastada sai do DOM e o dragend dela nunca chega aqui. */
  function endDrag() {
    dragId = null;
    document.body.classList.remove('is-dragging-conv');
    $$('.is-dragging').forEach(function (r) {
      r.classList.remove('is-dragging');
    });
    $$('[data-drop-over]').forEach(function (r) {
      r.removeAttribute('data-drop-over');
    });
  }
  document.addEventListener('dragend', endDrag);
  document.addEventListener('dragover', function (e) {
    if (!dragId) return;
    var target = e.target.closest && e.target.closest('[data-drop-folder]');
    $$('[data-drop-over]').forEach(function (r) {
      if (r !== target) r.removeAttribute('data-drop-over');
    });
    if (!target) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    target.setAttribute('data-drop-over', 'true');
  });
  document.addEventListener('drop', function (e) {
    var target = e.target.closest && e.target.closest('[data-drop-folder]');
    if (!dragId || !target) return;
    e.preventDefault();
    var dc = conv(dragId);
    var fid = target.dataset.dropFolder || null;
    endDrag();
    if (dc && dc.folder !== fid) moveToFolder(dc, fid);
  });

  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-tip]');
    if (t) showTip(t);
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest('[data-tip]')) hideTip();
  });
  document.addEventListener('mousedown', hideTip);

  document.addEventListener('pointerdown', function (e) {
    var h = e.target.closest('[data-resize]');
    if (h) startResize(h, e);
  });

  /* Duplo clique restaura o padrão — sair de uma largura ruim não pode exigir
     mira. E as setas ajustam de 16 em 16 para quem navega por teclado. */
  document.addEventListener('dblclick', function (e) {
    var h = e.target.closest('[data-resize]');
    if (!h) return;
    document.documentElement.style.removeProperty(PANES[h.dataset.resize].varName);
    saveWidths();
    syncPills();
    syncSegThumbs(document);
    toast('Largura restaurada', { icon: 'refresh' });
  });
  window.addEventListener('resize', function () {
    syncPills();
    syncSegThumbs(document);
    syncTabInk($('[data-tabs="contact"]'));
  });

  /* ======================================================================
     12. ROTAS E BOOT
     ====================================================================== */

  var currentShell = null;

  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    var name = parts[0] || 'inbox';
    if (['inbox', 'dashboard', 'contatos'].indexOf(name) < 0) name = 'inbox';
    return { name: name, id: parts[1] || null };
  }

  function renderMain(force) {
    var shell = S.route.name === 'contatos' && S.route.id ? 'ficha' : S.route.name;
    var main = $('#main');

    if (S.route.name === 'inbox') {
      if (shell !== currentShell || force) {
        main.innerHTML =
          '<section class="pane pane--list" id="pane-list">' +
          resizerHtml('list', 'right', 'Largura da fila') +
          '</section>' +
          '<section class="pane pane--thread" id="pane-thread"></section>' +
          (S.ctxOpen
            ? '<section class="pane pane--context" id="pane-context">' +
              resizerHtml('context', 'left', 'Largura do painel do aluno') +
              '</section>'
            : '');
        currentShell = shell;
      }
      renderList();
      renderThread();
      renderContext();
    } else {
      currentShell = shell;
      if (S.route.name === 'dashboard') renderDashboard();
      else if (S.route.id) render360();
      else renderContacts();
    }
    $('#app').dataset.context = S.ctxOpen ? 'on' : 'off';
    $('#app').dataset.mobilePane = S.selected ? 'thread' : 'list';
  }

  function route() {
    var r = parseRoute();
    var shellChanged = r.name !== S.route.name || (r.name === 'contatos' && !!r.id !== !!S.route.id);
    S.route = r;

    if (r.name === 'inbox') {
      if (r.id && conv(r.id)) {
        S.selected = r.id;
        var c = conv(r.id);
        c.unread = 0;
        S.composer.text = '';
        S.composer.mode = 'reply';
        S.copilot = { running: false, title: null, body: '', chips: null, insert: null };
        S.ask = { q: '', a: '', running: false };
        if (!inView(c, S.view) && c.assignee === D.ME.id) S.view = c.status === 'encerrado' ? 'encerrados' : 'minha';
      } else {
        ensureSelection();
      }
    }
    if (r.name === 'contatos' && !r.id) S.contactTab = 'visao';

    /* AnimatePresence mode="wait": a tela atual sai inteira antes de a nova
       entrar. É essa espera — e não a animação em si — que faz a navegação
       parecer uma coisa só se movendo, em vez de duas telas piscando. */
    var outgoing = shellChanged ? $('.page__inner, .pane--list', $('#main')) : null;
    if (outgoing && !prefersReducedMotion()) {
      var main = $('#main');
      main.classList.add('route-exit');
      setTimeout(function () {
        main.classList.remove('route-exit');
        paintRoute(true);
      }, 130);
      renderRail();
      renderViewsColumn();
      return;
    }
    paintRoute(shellChanged);
  }

  function paintRoute(shellChanged) {
    renderRail();
    renderViewsColumn();
    renderMain(shellChanged);
    syncPills();
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.addEventListener('hashchange', route);

  /* O relógio da fila: o SLA anda sozinho. Redesenha só a lista, e só quando
     não há overlay aberto nem seleção em massa — nada pior que uma lista que
     se reorganiza debaixo do cursor. */
  setInterval(function () {
    if (S.route.name !== 'inbox' || popLayer || modalStack.length || S.bulk !== null) return;
    renderList();
  }, 30000);

  function boot() {
    loadWidths();
    loadOrg();
    try {
      S.viewsCollapsed = localStorage.getItem('atendimento.v1.views') === 'off';
    } catch (e) {
      /* storage indisponível — começa expandida */
    }
    $('#app').dataset.views = S.viewsCollapsed ? 'off' : 'on';
    if (!location.hash) location.hash = '#/inbox';
    route();
    setTimeout(function () {
      var waiting = countFor('fila');
      toast('Turno iniciado', {
        sub: countFor('minha') + ' conversas com você · ' + waiting + ' na fila esperando atendimento.',
        icon: 'inbox',
        action: waiting ? 'Atender próximo' : null,
        onAction: nextUp,
        timeout: 6500,
      });
    }, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.__ATD = { S: S, D: D };
})();
