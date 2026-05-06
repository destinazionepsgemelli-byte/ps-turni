let turnistiList = [];
let pendingInsert = null;
let pendingDelete = null;
let currentInsertSlot = null;

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

function isSlotClosed(slot) {
  const today = new Date().toISOString().slice(0, 10);
  return slot?.data_chiusura_richieste && today > slot.data_chiusura_richieste;
}

async function loadTurnisti() {
  const { data } = await _supabase
    .from('turnisti').select('nome').eq('attivo', true).order('nome');
  turnistiList = (data || []).map(t => t.nome);
}

// ---- AUTOCOMPLETE ----
function validateModal() {
  const nomeA = document.getElementById('modal-nome-a').value.trim();
  const nomeB = document.getElementById('modal-nome-b').value.trim();
  const nomeAValido = turnistiList.includes(nomeA);
  const nomeBValido = nomeB === '' || turnistiList.includes(nomeB);
  const ok = nomeAValido && nomeBValido && (nomeA !== nomeB || nomeB === '');
  document.getElementById('modal-ok').disabled = !ok;
  document.getElementById('modal-ok').style.opacity = ok ? '1' : '.4';
}

function setupAutocomplete(inputId, suggestionsId, otherInputId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggestionsId);
  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    box.innerHTML = '';
    if (!val) { box.style.display = 'none'; validateModal(); return; }
    const otherVal = otherInputId ? document.getElementById(otherInputId).value.trim() : '';
    const filtered = turnistiList.filter(n => n.toLowerCase().includes(val) && n !== otherVal);
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
    box.style.display = 'block';
  });
  input.addEventListener('blur', () => { setTimeout(() => { box.style.display = 'none'; }, 150); validateModal(); });
  input.addEventListener('focus', () => { if (input.value.trim()) input.dispatchEvent(new Event('input')); });
}

// ---- BADGE ----
function renderBadge(pref, slot) {
  const isCoppia = !!pref.nome_b;
  const label = isCoppia ? `${pref.nome_a} + ${pref.nome_b}` : pref.nome_a;
  const span = document.createElement('span');
  span.className = 'badge' + (isCoppia ? ' coppia' : '');
  span.dataset.id = pref.id;
  span.innerHTML = `${label}<button class="badge-x" title="Rimuovi">✕</button>`;
  span.querySelector('.badge-x').addEventListener('click', () => openConfirmDelete(pref, slot));
  return span;
}

function openConfirmDelete(pref, slot) {
  if (isSlotClosed(slot)) { showToast('Le richieste sono chiuse', 'error'); return; }
  const label = pref.nome_b ? `${pref.nome_a} + ${pref.nome_b}` : pref.nome_a;
  pendingDelete = { id: pref.id, label };
  document.getElementById('confirm-text').textContent = `Vuoi rimuovere "${label}" da questa riga?`;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

// ---- MODAL INSERIMENTO ----
function openInsertModal(giorno, tipo, slot) {
  if (isSlotClosed(slot)) { showToast('Le richieste sono chiuse', 'error'); return; }
  currentInsertSlot = slot;
  pendingInsert = { giorno, tipo };
  document.getElementById('modal-nome-a').value = '';
  document.getElementById('modal-nome-b').value = '';
  document.getElementById('modal-ok').disabled = true;
  document.getElementById('modal-ok').style.opacity = '.4';
  document.getElementById('modal-title').textContent =
    tipo === 'desiderata' ? `🟢 Desiderata – ${fmtDate(giorno)}` : `🔴 Indisponibilità – ${fmtDate(giorno)}`;
  // Campo coppia: visibile solo per le desiderata
  const campoCoppia = document.getElementById('modal-nome-b').closest('.form-group');
  campoCoppia.style.display = tipo === 'desiderata' ? '' : 'none';
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-nome-a').focus(), 50);
}

async function doInsert() {
  const nomeA = document.getElementById('modal-nome-a').value.trim();
  const nomeB = document.getElementById('modal-nome-b').value.trim() || null;
  if (!turnistiList.includes(nomeA)) return;
  if (nomeB && !turnistiList.includes(nomeB)) return;
  const { error } = await _supabase.from('preferenze').insert({
    slot_id: currentInsertSlot.id,
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
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
  const { error } = await _supabase.from('preferenze').delete().eq('id', id);
  if (error) { showToast('Errore: ' + error.message, 'error'); }
  else showToast('Rimosso', 'success');
}

// ---- SEZIONE DESIDERATA ----
async function buildDesiderataSection(slot) {
  const dates = dateRange(slot.data_inizio, slot.data_fine);
  const { data: prefs } = await _supabase.from('preferenze').select('*').eq('slot_id', slot.id);
  const byKey = {};
  (prefs || []).forEach(p => {
    const k = `${p.giorno}|${p.tipo}`;
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(p);
  });

  const section = document.createElement('div');
  section.id = `slot-des-${slot.id}`;
  section.style.marginBottom = '2rem';

  const chiuso = isSlotClosed(slot);

  // Info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'slot-info-bar';
  infoBar.innerHTML = `
    <div class="info-item">
      <label style="opacity:.7;font-size:.75rem">SLOT</label>
      <strong>${slot.nome}</strong>
    </div>
    <div class="info-item">
      <label style="opacity:.7;font-size:.75rem">PERIODO</label>
      <strong>${fmtDate(slot.data_inizio)} → ${fmtDate(slot.data_fine)}</strong>
    </div>
    <div class="info-item">
      <label style="opacity:.7;font-size:.75rem">CHIUSURA RICHIESTE</label>
      <strong>${slot.data_chiusura_richieste ? fmtDate(slot.data_chiusura_richieste) : '—'}</strong>
    </div>
    <div class="info-item">
      <label style="opacity:.7;font-size:.75rem">STATO</label>
      <strong class="${chiuso ? 'stato-chiuso' : 'stato-aperto'}" id="stato-${slot.id}">${chiuso ? '🔒 Chiuso' : '✅ Aperto'}</strong>
    </div>
  `;
  // Pulsante collapse
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'slot-collapse-btn';
  collapseBtn.textContent = '▼';
  collapseBtn.title = 'Comprimi/Espandi';
  infoBar.appendChild(collapseBtn);
  section.appendChild(infoBar);

  // Tabella
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:0;overflow:hidden';
  collapseBtn.addEventListener('click', () => {
    const collapsed = card.style.display === 'none';
    card.style.display = collapsed ? '' : 'none';
    collapseBtn.textContent = collapsed ? '▼' : '▶';
  });
  const wrap = document.createElement('div');
  wrap.style.overflowX = 'auto';
  const table = document.createElement('table');
  table.className = 'cal-table';
  table.innerHTML = `<thead><tr>
    <th class="col-data">Giorno</th>
    <th class="col-header-green" style="width:45%">🟢 Desiderata <span style="font-weight:400;font-size:.75rem;opacity:.8">– giorni in cui vuoi lavorare</span></th>
    <th class="col-header-red" style="width:45%">🔴 Indisponibilità <span style="font-weight:400;font-size:.75rem;opacity:.8">– giorni in cui NON puoi lavorare</span></th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');
  tbody.id = `cal-body-${slot.id}`;

  for (const d of dates) {
    const tr = document.createElement('tr');
    const tdData = document.createElement('td');
    tdData.className = 'col-data';
    tdData.textContent = fmtDate(d);
    tr.appendChild(tdData);

    for (const tipo of ['desiderata', 'indisponibilita']) {
      const td = document.createElement('td');
      td.className = tipo === 'desiderata' ? 'col-desiderata' : 'col-indisponibilita';
      const inner = document.createElement('div');
      inner.className = 'cell-inner';
      inner.id = `cell-${slot.id}-${d}-${tipo}`;
      (byKey[`${d}|${tipo}`] || []).forEach(p => inner.appendChild(renderBadge(p, slot)));
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.textContent = '+';
      addBtn.addEventListener('click', () => openInsertModal(d, tipo, slot));
      inner.appendChild(addBtn);
      td.appendChild(inner);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  section.appendChild(card);

  // Polling stato badge
  setInterval(() => {
    const el = document.getElementById(`stato-${slot.id}`);
    if (!el) return;
    const c = isSlotClosed(slot);
    el.textContent = c ? '🔒 Chiuso' : '✅ Aperto';
    el.className = c ? 'stato-chiuso' : 'stato-aperto';
  }, 60000);

  return section;
}

// ---- SEZIONE CALENDARIO PUBBLICATO ----
async function buildCalendarioSection(slot) {
  const dates = dateRange(slot.data_inizio, slot.data_fine);
  const { data: assegnazioni } = await _supabase
    .from('assegnazioni').select('*').eq('slot_id', slot.id);
  const byGiorno = {};
  (assegnazioni || []).forEach(a => {
    if (!byGiorno[a.giorno]) byGiorno[a.giorno] = [];
    byGiorno[a.giorno].push(a);
  });

  const section = document.createElement('div');
  section.id = `slot-cal-${slot.id}`;
  section.style.marginBottom = '2rem';

  // Info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'slot-info-bar';
  infoBar.innerHTML = `
    <div class="info-item">
      <label style="opacity:.7;font-size:.75rem">SLOT</label>
      <strong>${slot.nome}</strong>
    </div>
    <div class="info-item">
      <label style="opacity:.7;font-size:.75rem">PERIODO</label>
      <strong>${fmtDate(slot.data_inizio)} → ${fmtDate(slot.data_fine)}</strong>
    </div>
    <div class="info-item">
      <label style="opacity:.7;font-size:.75rem">STATO</label>
      <strong class="stato-aperto">📋 Calendario pubblicato</strong>
    </div>
  `;
  // Pulsante collapse
  const collapseBtn2 = document.createElement('button');
  collapseBtn2.className = 'slot-collapse-btn';
  collapseBtn2.textContent = '▼';
  collapseBtn2.title = 'Comprimi/Espandi';
  infoBar.appendChild(collapseBtn2);
  section.appendChild(infoBar);

  // Tabella assegnazioni (read-only)
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:0;overflow:hidden';
  collapseBtn2.addEventListener('click', () => {
    const collapsed = card.style.display === 'none';
    card.style.display = collapsed ? '' : 'none';
    collapseBtn2.textContent = collapsed ? '▼' : '▶';
  });
  const wrap = document.createElement('div');
  wrap.style.overflowX = 'auto';
  const table = document.createElement('table');
  table.className = 'cal-table';
  table.innerHTML = `<thead><tr>
    <th class="col-data">Giorno</th>
    <th>Turno assegnato</th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');

  for (const d of dates) {
    const tr = document.createElement('tr');
    const tdData = document.createElement('td');
    tdData.className = 'col-data';
    tdData.textContent = fmtDate(d);
    tr.appendChild(tdData);
    const tdAssegn = document.createElement('td');
    const assegn = byGiorno[d] || [];
    if (assegn.length > 0) {
      assegn.forEach(a => {
        const label = a.nome_b ? `${a.nome_a} + ${a.nome_b}` : a.nome_a;
        const badge = document.createElement('span');
        badge.className = 'badge' + (a.nome_b ? ' coppia' : '');
        badge.style.pointerEvents = 'none';
        badge.textContent = label;
        tdAssegn.appendChild(badge);
      });
    } else {
      tdAssegn.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem">—</span>';
    }
    tr.appendChild(tdAssegn);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  section.appendChild(card);
  return section;
}

// ---- REALTIME ----
function subscribeRealtime(slot) {
  _supabase
    .channel(`preferenze-${slot.id}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'preferenze',
      filter: `slot_id=eq.${slot.id}`
    }, payload => {
      if (payload.eventType === 'INSERT') {
        const p = payload.new;
        const inner = document.getElementById(`cell-${slot.id}-${p.giorno}-${p.tipo}`);
        if (!inner) return;
        const addBtn = inner.querySelector('.add-btn');
        inner.insertBefore(renderBadge(p, slot), addBtn);
      } else if (payload.eventType === 'DELETE') {
        const el = document.querySelector(`[data-id="${payload.old.id}"]`);
        if (el) el.remove();
      }
    })
    .subscribe();
}

// ---- NAV ----
function setupPubNav(hasRichieste, hasCalendari) {
  const nav = document.getElementById('pub-nav');
  const secR = document.getElementById('section-richieste');
  const secC = document.getElementById('section-calendari');

  if (!hasRichieste && !hasCalendari) { nav.style.display = 'none'; return; }

  // Mostra nav solo se ci sono entrambe le sezioni
  nav.style.display = hasRichieste && hasCalendari ? 'flex' : 'none';

  // Default: richieste se ci sono, altrimenti calendari
  const defaultTarget = hasRichieste ? 'richieste' : 'calendari';
  secR.style.display = hasRichieste ? '' : 'none';
  secC.style.display = hasCalendari && !hasRichieste ? '' : 'none';

  nav.querySelectorAll('.pub-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === defaultTarget);
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.pub-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      secR.style.display = btn.dataset.target === 'richieste' ? '' : 'none';
      secC.style.display = btn.dataset.target === 'calendari' ? '' : 'none';
    });
  });
}

// ---- INIT ----
async function loadAllSlots() {
  const { data: slots } = await _supabase
    .from('slots').select('*').eq('pubblicato', true)
    .order('data_inizio', { ascending: false });

  const secR = document.getElementById('section-richieste');
  const secC = document.getElementById('section-calendari');
  secR.innerHTML = '';
  secC.innerHTML = '';

  if (!slots || slots.length === 0) {
    document.getElementById('no-slot').style.display = '';
    setupPubNav(false, false);
    return;
  }
  document.getElementById('no-slot').style.display = 'none';

  const desiderataSlots = slots.filter(s => !s.calendario_pubblicato);
  const publishedSlots  = slots.filter(s =>  s.calendario_pubblicato);

  // Slot aperti per desiderata
  for (const slot of desiderataSlots) {
    const section = await buildDesiderataSection(slot);
    secR.appendChild(section);
    subscribeRealtime(slot);
  }

  // Calendari pubblicati
  if (publishedSlots.length > 0) {
    const heading = document.createElement('h2');
    heading.style.cssText = 'color:var(--text);font-size:1.05rem;font-weight:700;margin-bottom:1.2rem';
    heading.textContent = '📋 Calendari definitivi';
    secC.appendChild(heading);
    for (const slot of publishedSlots) {
      const section = await buildCalendarioSection(slot);
      secC.appendChild(section);
    }
  }

  setupPubNav(desiderataSlots.length > 0, publishedSlots.length > 0);
}

// ---- EVENT LISTENERS MODAL ----
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

Promise.all([loadTurnisti(), loadAllSlots()]).then(() => {
  setupAutocomplete('modal-nome-a', 'suggestions-a', 'modal-nome-b');
  setupAutocomplete('modal-nome-b', 'suggestions-b', 'modal-nome-a');
});
