(function () {
  const timeAttackLimits = { 2: 10, 4: 30, 6: 60, 8: 120 };
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  let state = {
    size: 4,
    mode: 'classic',
    moves: 0,
    matched: 0,
    totalPairs: 0,
    first: null,
    second: null,
    lock: false,
    startTime: null,
    elapsed: 0,
    remain: null,
    timerId: null,
    countdownId: null
  };

  function qs(sel, el = document) { return el.querySelector(sel); }
  function qsa(sel, el = document) { return Array.from(el.querySelectorAll(sel)); }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function getParams() {
    const url = new URL(window.location.href);
    const size = parseInt(url.searchParams.get('size') || '4', 10);
    const mode = url.searchParams.get('mode') || 'classic';
    return {
      size: [2, 4, 6, 8].includes(size) ? size : 4,
      mode: ['classic', 'time-attack'].includes(mode) ? mode : 'classic'
    };
  }

  function generateLabels(n) {
    const labels = [];
    let idx = 0;
    while (labels.length < n) {
      labels.push(idx < 26 ? letters[idx] : "A" + letters[idx - 26]);
      idx++;
    }
    return labels;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function initState() {
    const p = getParams();
    state.size = p.size;
    state.mode = p.mode;
    state.moves = 0;
    state.matched = 0;
    state.lock = false;
    state.first = null;
    state.second = null;
    state.elapsed = 0;
    state.remain = state.mode === 'time-attack' ? timeAttackLimits[state.size] : null;
    state.totalPairs = (state.size * state.size) / 2;
  }

  function updateUI() {
    qs('#confValue').textContent = `${state.size}x${state.size}`;
    qs('#modeValue').textContent = state.mode === 'classic' ? 'Clássica' : 'Contra o Tempo';
    qs('#timeValue').textContent = '00:00';
    qs('#movesValue').textContent = '0';
    qs('#remainValue').textContent = state.mode === 'time-attack' ? fmtTime(state.remain) : '--:--';
  }

  function buildBoard() {
    const board = qs('#board');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    const labels = generateLabels(state.totalPairs);
    const deck = shuffle([...labels, ...labels]).map((sym, idx) => ({ id: idx, sym, matched: false }));
    board._deck = deck;
    deck.forEach(createCardElement);
  }

  function createCardElement(card) {
    const div = document.createElement('div');
    div.className = 'card hidden';
    div.tabIndex = 0;
    div.setAttribute('data-id', String(card.id));
    div.setAttribute('role', 'gridcell');
    div.setAttribute('aria-label', 'Carta de memória');
    div.addEventListener('click', onFlip);
    div.addEventListener('keydown', onKeyFlip);
    qs('#board').appendChild(div);
  }

  function onKeyFlip(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFlip(e);
    }
  }

  function onFlip(e) {
    if (state.lock) return;
    const board = qs('#board');
    const deck = board._deck;
    const el = e.currentTarget;
    const id = parseInt(el.getAttribute('data-id'), 10);
    const card = deck[id];
    if (!card || card.matched || (state.first && state.first.id === id)) return;

    revealCard(el, card);
    if (state.startTime === null) startGameTimers();

    if (!state.first) state.first = { el, ...card };
    else handleSecondFlip(card, el);
  }

  function handleSecondFlip(card, el) {
    state.second = { el, ...card };
    state.moves++;
    qs('#movesValue').textContent = String(state.moves);
    checkMatch();
  }

  function revealCard(el, card) {
    el.classList.remove('hidden');
    el.classList.add('revealed');
    el.textContent = card.sym;
  }

  function hideCard(el) {
    el.classList.add('hidden');
    el.classList.remove('revealed');
    el.textContent = '';
  }

  function checkMatch() {
    if (state.first.sym === state.second.sym) {
      markMatched(state.first.id);
      markMatched(state.second.id);
      state.matched++;
      resetSelection();
      if (state.matched === state.totalPairs) endGame(true);
    } else {
      state.lock = true;
      setTimeout(unflipMismatched, 800);
    }
  }

  function markMatched(id) {
    const board = qs('#board');
    const deck = board._deck;
    deck[id].matched = true;
    const el = board.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('matched');
  }

  function unflipMismatched() {
    hideCard(state.first.el);
    hideCard(state.second.el);
    resetSelection();
    state.lock = false;
  }

  function resetSelection() {
    state.first = null;
    state.second = null;
  }

  function startGameTimers() {
    state.startTime = Date.now();
    startElapsed();
    if (state.mode === 'time-attack') startCountdown();
  }

  function startElapsed() {
    clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      qs('#timeValue').textContent = fmtTime(state.elapsed);
    }, 250);
  }

  function startCountdown() {
    clearInterval(state.countdownId);
    state.countdownId = setInterval(() => {
      state.remain--;
      qs('#remainValue').textContent = fmtTime(state.remain);
      if (state.remain <= 0) endGame(false);
    }, 1000);
  }

  function stopTimers() {
    clearInterval(state.timerId);
    clearInterval(state.countdownId);
    state.timerId = null;
    state.countdownId = null;
  }

  function endGame(victory) {
    stopTimers();
    revealAll();
    const msg = victory
      ? `Parabéns! Você venceu em ${state.moves} jogadas e ${fmtTime(state.elapsed)}.`
      : `Fim de jogo! Você perdeu. Jogadas: ${state.moves}. Tempo: ${fmtTime(state.elapsed)}.`;
    addHistoryRow(victory);
    setTimeout(() => alert(msg), 50);
  }

  function revealAll() {
    const board = qs('#board');
    qsa('.card').forEach(el => {
      const id = parseInt(el.getAttribute('data-id'), 10);
      const card = board._deck[id];
      revealCard(el, card);
      if (card.matched) el.classList.add('matched');
    });
  }

  function addHistoryRow(victory) {
    const tbody = qs('#sessionHistory tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${state.size}x${state.size}</td><td>${state.mode === 'classic' ? 'Clássica' : 'Contra o Tempo'}</td><td>${state.moves}</td><td>${fmtTime(state.elapsed)}</td><td class="${victory ? 'win' : 'loss'}">${victory ? 'Vitória' : 'Derrota'}</td>`;
    tbody.prepend(tr);
  }

  function setupCheatButtons() {
    qs('#btnGiveUp').addEventListener('click', () => {
      if (confirm('Deseja desistir desta partida?')) endGame(false);
    });

    qs('#btnCheatOn').addEventListener('click', () => {
      const board = qs('#board');
      const deck = board._deck;
      state.lock = true; // trava jogadas enquanto trapaca está ativa
      qsa('.card', board).forEach(el => {
        const id = parseInt(el.getAttribute('data-id'), 10);
        revealCard(el, deck[id]);
      });
    });

    qs('#btnCheatOff').addEventListener('click', () => {
      const board = qs('#board');
      const deck = board._deck;
      state.lock = false; // libera jogadas
      qsa('.card', board).forEach(el => {
        const id = parseInt(el.getAttribute('data-id'), 10);
        const card = deck[id];
        if (!card.matched && !isSelected(id)) hideCard(el);
      });
    });
  }


  function isSelected(id) {
    return (state.first && state.first.id === id) || (state.second && state.second.id === id);
  }

  function init() {
    initState();
    updateUI();
    buildBoard();
    setupCheatButtons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
