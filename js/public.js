let currentSlot = null;
let pendingInsert = null;
let pendingDelete = null;
let turnistiList = [];

function showToast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return new Date(y, m - 1, day).toLocaleDateString('it-IT', {
    weekday: 'short', day: '2-digit', month: 'short'
  });
}

function dateRange(start, end) {
  const dates = [];
  const [sy, sm, sd] = start.split('-');
  const [ey, em, ed] = end.split('-');
  const cur = new Date(sy, sm - 1, sd);
  const fin = new Date(ey, em - 1, ed);
  while (cur <= fin) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function loadTurnisti() {
  const { data } = await _supabase
    .from('turnisti')
    .select('nome')
    .eq('attivo', true)
    .order('nome');
  turnistiList = (data || []).map(t => t.nome);
}

function setupAutocomplete(inputId, suggestionsId, otherInputId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggestionsId);

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    box.innerHTML = '';
    if (!val) { box.style.display = 'none'; validateModal(); return; }

    const otherVal = otherInputId
      ? document.getElementById(otherInputId).value.trim()
      : '';

    const filtered = turnistiList.filter(n =>
      n.toLowerCase().includes(val) && n !== otherVal
    );

    if (!filtered.length) { box.style.display = 'none'; validateModal(); return; }

    filtered.forEach(nome => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = nome;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = nome;
        box.style.display = 'none';
        validateModal();
      });
      box.appendChild(item);
    });
    box.style.display = '';
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { box.style.display = 'none'; }, 150);
    validateModal();
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) input.dispatchEvent(new Event('input'));
  });
}

function validateModal() {
  const nomeA = document.getElementById('modal-nome-a').value.trim();
  const nomeB = document.getElementById('modal-nome-b').value.trim();
  const nomeAValido = turnistiList.includes(nomeA);
  const nomeBValido = nomeB === '' || turnistiList.includes(nomeB);
  const ok = nomeAValido && nomeBValido && (nomeA !== nomeB || nomeB === '');
  document.getElementById('modal-ok').disabled = !ok;
  document.getElementById('modal-ok').style.opacity = ok ? '1' : '.4';
}

function renderBadge(pref) {
  const isCoppia = !!pref.nome_b;
  const label = isCoppia ? `${pref.nome_a} + ${pref.nome_b}` : pref.nome_a;
  const div = document.createElement('span');
  div.className = 'badge' + (isCoppia ? ' coppia' : '');
  div.dataset.id = pref.id;
  div.innerHTML = `${label}<button class="badge-x" title="Rimuovi">✕</button>`;
  div.querySelector('.badge-x').addEventListener('click', () => openConfirmDelete(pref));
  return div;
}

function openConfirmDelete(pref) {
  const label = pref.nome_b ? `${pref.nome_a} + ${pref.nome_b}` : pref.nome_a;
  pendingDelete = { id: pref.id, label };
  document.getElementById('confirm-text').textContent =
    `Vuoi rimuovere "${label}" da questa riga?`;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

async function loadActiveSlot() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await _supabase
    .from('slots')
    .select('*')
    .eq('pubblicato', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    document.getElementById('no-slot').style.display = '';
    document.getElementById('slot-container').style.display = 'none';
    return;
  }

  currentSlot = data;
  document.getElementById('no-slot').style.display = 'none';
  document.getElementById('slot-container').style.display = '';
  document.getElementById('slot-nome').textContent = data.nome;
  document.getElementById('slot-periodo').textContent =
    `${fmtDate(data.data_inizio)} → ${fmtDate(data.data_fine)}`;
  document.getElementById('slot-chiusura').textContent =
    data.data_chiusura_richieste ? fmtDate(data.data_chiusura_richieste) : '—';

  const chiuso = data.data_chiusura_richieste && today > data.data_chiusura_richieste;
  const statoEl = document.getElementById('slot-stato');
  statoEl.textContent = chiuso ? '🔒 Chiuso' : '✅ Aperto';
  statoEl.className = chiuso ? 'stato-chiuso' : 'stato-aperto';

  await buildTable();
  subscribeRealtime();
}

async function buildTable() {
  const dates = dateRange(currentSlot.data_inizio, currentSlot.data_fine);
  const { data: prefs } = await _supabase
    .from('preferenze')
    .select('*')
    .eq('slot_id', currentSlot.id);

  const byKey = {};
  (prefs || []).forEach(p => {
    const k = `${p.giorno}|${p.tipo}`;
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(p);
  });

  const tbody = document.getElementById('cal-body');
  tbody.innerHTML = '';

  for (const d of dates) {
    const tr = document.createElement('tr');

    const tdData = document.createElement('td');
    tdData.className = 'col-data';
    tdData.textContent = fmtDate(d);
    tr.appendChild(tdData);

    for (const tipo of ['desiderata', 'indisponibilita']) {
      const td = document.createElement('td');
      td.className = tipo === 'desiderata' ? 'col-desiderata' : 'col-indisponibilita';
      td.dataset.giorno = d;
      td.dataset.tipo = tipo;

      const inner = document.createElement('div');
      inner.className = 'cell-inner';
      inner.id = `cell-${d}-${tipo}`;

      (byKey[`${d}|${tipo}`] || []).forEach(p => inner.appendChild(renderBadge(p)));

      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.title = 'Aggiungi';
      addBtn.textContent = '+';
      addBtn.addEventListener('click', () => openInsertModal(d, tipo));
      inner.appendChild(addBtn);

      td.appendChild(inner);
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}

function openInsertModal(giorno, tipo) {
  const today = new Date().toISOString().slice(0, 10);
  if (currentSlot.data_chiusura_richieste && today > currentSlot.data_chiusura_richieste) {
    showToast('Le richieste sono chiuse', 'error');
    return;
  }
  pendingInsert = { giorno, tipo };
  document.getElementById('modal-nome-a').value = '';
  document.getElementById('modal-nome-b').value = '';
  document.getElementById('modal-ok').disabled = true;
  document.getElementById('modal-ok').style.opacity = '.4';
  document.getElementById('modal-title').textContent =
    tipo === 'desiderata'
      ? `🟢 Desiderata – ${fmtDate(giorno)}`
      : `🔴 Indisponibilità – ${fmtDate(giorno)}`;
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-nome-a').focus(), 50);
}

async function doInsert() {
  const nomeA = document.getElementById('modal-nome-a').value.trim();
  const nomeB = document.getElementById('modal-nome-b').value.trim() || null;
  if (!turnistiList.includes(nomeA)) return;
  if (nomeB && !turnistiList.includes(nomeB)) return;

  const { error } = await _supabase.from('preferenze').insert({
    slot_id: currentSlot.id,
    giorno: pendingInsert.giorno,
    tipo: pendingInsert.tipo,
    nome_a: nomeA,
    nome_b: nomeB
  });

  document.getElementById('modal-overlay').classList.add('hidden');
  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast('Inserito!', 'success');
}

async function doDelete() {
  const id = pendingDelete.id;
  document.getElementById('confirm-overlay').classList.add('hidden');

  // Rimuovi subito dalla UI
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();

  const { error } = await _supabase
    .from('preferenze')
    .delete()
    .eq('id', id);

  if (error) {
    showToast('Errore: ' + error.message, 'error');
    // Ricarica la tabella se fallisce
    await buildTable();
    return;
  }
  showToast('Rimosso', 'success');
}

function subscribeRealtime() {
  _supabase
    .channel('preferenze-public')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'preferenze',
      filter: `slot_id=eq.${currentSlot.id}`
    }, payload => handleRealtimeChange(payload))
    .subscribe();
}

function handleRealtimeChange(payload) {
  if (payload.eventType === 'INSERT') {
    const p = payload.new;
    const inner = document.getElementById(`cell-${p.giorno}-${p.tipo}`);
    if (!inner) return;
    const addBtn = inner.querySelector('.add-btn');
    inner.insertBefore(renderBadge(p), addBtn);
  } else if (payload.eventType === 'DELETE') {
    const el = document.querySelector(`[data-id="${payload.old.id}"]`);
    if (el) el.remove();
  }
}

document.getElementById('modal-cancel').addEventListener('click', () =>
  document.getElementById('modal-overlay').classList.add('hidden'));
document.getElementById('modal-ok').addEventListener('click', doInsert);
document.getElementById('modal-nome-b').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('modal-ok').disabled) doInsert();
});
document.getElementById('confirm-cancel').addEventListener('click', () =>
  document.getElementById('confirm-overlay').classList.add('hidden'));
document.getElementById('confirm-ok').addEventListener('click', doDelete);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay'))
    document.getElementById('modal-overlay').classList.add('hidden');
});

// Avvio
Promise.all([loadTurnisti(), loadActiveSlot()]).then(() => {
  setupAutocomplete('modal-nome-a', 'suggestions-a', 'modal-nome-b');
  setupAutocomplete('modal-nome-b', 'suggestions-b', 'modal-nome-a');
});