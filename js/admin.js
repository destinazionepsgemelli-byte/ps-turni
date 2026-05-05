// ---- LOGIN ----
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-pw').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function doLogin() {
  const pw = document.getElementById('login-pw').value;
  if (pw === ADMIN_PASSWORD) {
    localStorage.setItem('ps_admin_auth', '1');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = '';
    initAdmin();
  } else {
    document.getElementById('login-error').style.display = '';
  }
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ps_admin_auth');
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('login-screen').style.display = '';
  document.getElementById('login-pw').value = '';
});

// ---- TABS ----
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['impostazioni','workspace','turnisti'].forEach(t => {
      document.getElementById(`tab-${t}`).style.display =
        btn.dataset.tab === t ? '' : 'none';
    });
  });
});

// ---- UTILITIES ----
function showToast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return new Date(y, m - 1, day).toLocaleDateString('it-IT', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
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

let adminConfirmCallback = null;
let adminCancelCallback = null;
let _dropHandled = false;

function adminConfirm(title, text, onYes, onNo) {
  document.getElementById('admin-confirm-title').textContent = title;
  document.getElementById('admin-confirm-text').textContent = text;
  adminConfirmCallback = onYes;
  adminCancelCallback = onNo || null;
  document.getElementById('admin-confirm-overlay').classList.remove('hidden');
}
document.getElementById('admin-confirm-no').addEventListener('click', () => {
  document.getElementById('admin-confirm-overlay').classList.add('hidden');
  if (adminCancelCallback) { adminCancelCallback(); adminCancelCallback = null; }
});
document.getElementById('admin-confirm-yes').addEventListener('click', () => {
  document.getElementById('admin-confirm-overlay').classList.add('hidden');
  if (adminConfirmCallback) adminConfirmCallback();
});

function highlightIndisp(nomi) {
  document.querySelectorAll('#ws-cal-body td[data-giorno]').forEach(td => {
    const giorno = td.dataset.giorno;
    const haIndisp = nomi.some(nome =>
      wsPreferenze.some(p =>
        p.tipo === 'indisponibilita' && p.giorno === giorno &&
        (p.nome_a === nome || p.nome_b === nome)
      )
    );
    if (haIndisp) td.classList.add('indisp-highlight');
  });
}

function clearHighlightIndisp() {
  document.querySelectorAll('.indisp-highlight').forEach(el => el.classList.remove('indisp-highlight'));
}

// ---- MODIFICA SLOT ----
function openEditSlot(s) {
  document.getElementById('edit-slot-id').value = s.id;
  document.getElementById('edit-s-nome').value = s.nome;
  document.getElementById('edit-s-inizio').value = s.data_inizio;
  document.getElementById('edit-s-fine').value = s.data_fine;
  document.getElementById('edit-s-chiusura').value = s.data_chiusura_richieste || '';
  document.getElementById('edit-slot-overlay').classList.remove('hidden');
}

document.getElementById('edit-slot-cancel').addEventListener('click', () =>
  document.getElementById('edit-slot-overlay').classList.add('hidden'));

document.getElementById('edit-slot-ok').addEventListener('click', async () => {
  const id = document.getElementById('edit-slot-id').value;
  const nome = document.getElementById('edit-s-nome').value.trim();
  const inizio = document.getElementById('edit-s-inizio').value;
  const fine = document.getElementById('edit-s-fine').value;
  const chiusura = document.getElementById('edit-s-chiusura').value || null;
  if (!nome || !inizio || !fine) { showToast('Compila tutti i campi obbligatori', 'error'); return; }
  if (fine < inizio) { showToast('La data fine deve essere dopo la data inizio', 'error'); return; }
  const { error } = await _supabase.from('slots').update({
    nome, data_inizio: inizio, data_fine: fine, data_chiusura_richieste: chiusura
  }).eq('id', id);
  document.getElementById('edit-slot-overlay').classList.add('hidden');
  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast('Slot aggiornato!', 'success');
  loadSlots();
});

document.getElementById('edit-slot-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('edit-slot-overlay'))
    document.getElementById('edit-slot-overlay').classList.add('hidden');
});

// ---- VARIABILI WORKSPACE ----
let wsSlot = null;
let wsPreferenze = [];
let wsAssegnazioni = [];
let wsTurnisti = [];

// =============================================
//  TAB IMPOSTAZIONI SLOT
// =============================================
async function loadSlots() {
  const { data } = await _supabase.from('slots').select('*').order('created_at', { ascending: false });
  const div = document.getElementById('slots-list');
  if (!data || !data.length) {
    div.innerHTML = '<em style="color:#aaa">Nessuno slot creato</em>';
    return;
  }
  div.innerHTML = '';
  data.forEach(s => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.8rem;padding:.6rem 0;border-bottom:1px solid var(--border);flex-wrap:wrap';
    const statoLabel = s.calendario_pubblicato
      ? '<span style="color:#1565c0">📋 Calendario pubblicato</span>'
      : s.pubblicato
        ? '<span style="color:#2e7d32">✅ Aperto per desiderata</span>'
        : '<span style="color:#aaa">⏸ Bozza</span>';
    row.innerHTML = `
      <span style="font-weight:600;flex:1;color:var(--text)">${s.nome}</span>
      <span style="font-size:.82rem;color:var(--text-muted)">${fmtDate(s.data_inizio)} → ${fmtDate(s.data_fine)}</span>
      <span style="font-size:.8rem">${statoLabel}</span>
      ${s.calendario_pubblicato ? `<button class="btn btn-secondary btn-sm" onclick="openRiapriSlot('${s.id}','${s.data_chiusura_richieste||''}')">🔓 Riapri</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick='openEditSlot(${JSON.stringify(s)})'>✏️ Modifica</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSlot('${s.id}','${s.nome.replace(/'/g,"\\'")}')">Elimina</button>
    `;
    div.appendChild(row);
  });

  const sel = document.getElementById('ws-slot-select');
  sel.innerHTML = '<option value="">— Seleziona —</option>';
  data.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.nome;
    sel.appendChild(o);
  });
}

document.getElementById('pubblica-slot-btn').addEventListener('click', async () => {
  const nome = document.getElementById('s-nome').value.trim();
  const inizio = document.getElementById('s-inizio').value;
  const fine = document.getElementById('s-fine').value;
  const chiusura = document.getElementById('s-chiusura').value || null;
  if (!nome || !inizio || !fine) { showToast('Compila tutti i campi obbligatori', 'error'); return; }
  if (fine < inizio) { showToast('La data fine deve essere dopo la data inizio', 'error'); return; }
  const { error } = await _supabase.from('slots').insert({
    nome, data_inizio: inizio, data_fine: fine,
    data_chiusura_richieste: chiusura, pubblicato: true
  });
  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast('Slot creato e aperto per le desiderata!', 'success');
  document.getElementById('s-nome').value = '';
  document.getElementById('s-inizio').value = '';
  document.getElementById('s-fine').value = '';
  document.getElementById('s-chiusura').value = '';
  loadSlots();
});

async function publishSlot(id) {
  await _supabase.from('slots').update({ pubblicato: true }).eq('id', id);
  showToast('Slot pubblicato!', 'success');
  loadSlots();
}

function deleteSlot(id, nome) {
  adminConfirm('Elimina slot', `Eliminare "${nome}" e tutte le preferenze associate?`, async () => {
    await _supabase.from('slots').delete().eq('id', id);
    showToast('Slot eliminato');
    loadSlots();
  });
}

// =============================================
//  TAB WORKSPACE
// =============================================
document.getElementById('ws-load-btn').addEventListener('click', loadWorkspace);

async function loadWorkspace() {
  const id = document.getElementById('ws-slot-select').value;
  if (!id) { showToast('Seleziona uno slot', 'error'); return; }

  const [{ data: slot }, { data: prefs }, { data: assegn }, { data: turnisti }] = await Promise.all([
    _supabase.from('slots').select('*').eq('id', id).single(),
    _supabase.from('preferenze').select('*').eq('slot_id', id),
    _supabase.from('assegnazioni').select('*').eq('slot_id', id),
    _supabase.from('turnisti').select('*').eq('attivo', true)
  ]);

  wsSlot = slot;
  wsPreferenze = prefs || [];
  wsAssegnazioni = assegn || [];
  wsTurnisti = turnisti || [];

  document.getElementById('ws-content').style.display = '';
  renderWsPreferenze();
  renderWsCalendar();
  renderUnassigned();
  renderCounters();
}

function renderWsPreferenze() {
  const div = document.getElementById('ws-preferenze');
  const dates = dateRange(wsSlot.data_inizio, wsSlot.data_fine);
  let html = '<table class="cal-table" style="font-size:.8rem"><thead><tr><th>Giorno</th><th class="col-header-green">🟢 Desiderata</th><th class="col-header-red">🔴 Indisponibilità</th></tr></thead><tbody>';
  dates.forEach(d => {
    const des = wsPreferenze.filter(p => p.giorno === d && p.tipo === 'desiderata');
    const ind = wsPreferenze.filter(p => p.giorno === d && p.tipo === 'indisponibilita');
    html += `<tr>
      <td class="col-data" style="font-size:.78rem">${fmtDate(d)}</td>
      <td class="col-desiderata">${des.map(p =>
        `<span class="badge${p.nome_b ? ' coppia' : ''}">${p.nome_b ? p.nome_a + ' + ' + p.nome_b : p.nome_a}</span>`
      ).join('')}</td>
      <td class="col-indisponibilita">${ind.map(p =>
        `<span class="badge${p.nome_b ? ' coppia' : ''}" style="background:#fce4ec;color:#b71c1c;border-color:#ef9a9a">${p.nome_b ? p.nome_a + ' + ' + p.nome_b : p.nome_a}</span>`
      ).join('')}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  div.innerHTML = html;
}

function renderWsCalendar() {
  const tbody = document.getElementById('ws-cal-body');
  tbody.innerHTML = '';
  const dates = dateRange(wsSlot.data_inizio, wsSlot.data_fine);
  dates.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="col-data" style="font-size:.8rem">${fmtDate(d)}</td>`;
    const td = document.createElement('td');
    td.dataset.giorno = d;
    td.addEventListener('dragover', e => { e.preventDefault(); td.classList.add('drag-over'); });
    td.addEventListener('dragleave', () => td.classList.remove('drag-over'));
    td.addEventListener('drop', e => {
      e.preventDefault();
      td.classList.remove('drag-over');
      handleDrop(
        e.dataTransfer.getData('text/plain'),
        e.dataTransfer.getData('nome-b') || null,
        d,
        e.dataTransfer.getData('from-giorno'),
        e.dataTransfer.getData('ass-id')
      );
    });
    wsAssegnazioni.filter(a => a.giorno === d).forEach(a => td.appendChild(makeAssignBadge(a)));
    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => openManualAssign(d));
    td.appendChild(addBtn);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function makeAssignBadge(a) {
  const label = a.nome_b ? `${a.nome_a} + ${a.nome_b}` : a.nome_a;
  const span = document.createElement('span');
  span.className = 'badge drag-item' + (a.nome_b ? ' coppia' : '');
  span.draggable = true;
  span.dataset.assId = a.id;
  span.innerHTML = `${label}<button class="badge-x" title="Rimuovi">✕</button>`;
  span.addEventListener('dragstart', e => {
    _dropHandled = false;
    e.dataTransfer.setData('text/plain', a.nome_a);
    e.dataTransfer.setData('nome-b', a.nome_b || '');
    e.dataTransfer.setData('from-giorno', a.giorno);
    e.dataTransfer.setData('ass-id', a.id);
    setTimeout(() => highlightIndisp([a.nome_a, a.nome_b].filter(Boolean)), 0);
  });
  span.addEventListener('dragend', () => {
    clearHighlightIndisp();
    if (!_dropHandled) removeAssign(a);
  });
  span.querySelector('.badge-x').addEventListener('click', () => removeAssign(a));
  return span;
}

async function handleDrop(nomeA, nomeB, giornoTarget, fromGiorno, assId) {
  _dropHandled = true;
  if (fromGiorno === giornoTarget) return;

  // Controlla indisponibilità per il giorno target
  const nomi = [nomeA, nomeB].filter(Boolean);
  const haIndisp = nomi.some(nome =>
    wsPreferenze.some(p =>
      p.tipo === 'indisponibilita' && p.giorno === giornoTarget &&
      (p.nome_a === nome || p.nome_b === nome)
    )
  );

  if (haIndisp) {
    const label = nomeB ? `${nomeA} + ${nomeB}` : nomeA;
    const proceed = await new Promise(resolve => {
      adminConfirm(
        '⚠️ Indisponibilità dichiarata',
        `${label} ha dichiarato indisponibilità per questo giorno. Vuoi assegnarlo comunque?`,
        () => resolve(true),
        () => resolve(false)
      );
    });
    if (!proceed) return;
  }

  if (fromGiorno !== '__unassigned__') {
    const existing = wsAssegnazioni.find(a => a.id === assId || (a.giorno === fromGiorno && a.nome_a === nomeA));
    if (existing) {
      const { error } = await _supabase.from('assegnazioni').update({ giorno: giornoTarget }).eq('id', existing.id);
      if (!error) {
        existing.giorno = giornoTarget;
        renderWsCalendar();
        renderUnassigned();
        renderCounters();
        showToast(`${nomeA} spostato`, 'success');
      }
    }
  } else {
    await insertAssign(giornoTarget, nomeA, null);
  }
}

async function insertAssign(giorno, nomeA, nomeB) {
  const { data, error } = await _supabase.from('assegnazioni').insert({
    slot_id: wsSlot.id, giorno, nome_a: nomeA, nome_b: nomeB || null
  }).select().single();
  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  wsAssegnazioni.push(data);
  await aggiornaContatore(nomeA, nomeB);
  renderWsCalendar();
  renderUnassigned();
  renderCounters();
}

async function decrementaContatore(nomeA, nomeB) {
  const valore = nomeB ? 0.5 : 1;
  for (const nome of [nomeA, nomeB].filter(Boolean)) {
    const { data: existing } = await _supabase.from('turni_contatore')
      .select('*').eq('slot_id', wsSlot.id).eq('nome', nome).single();
    if (existing) {
      await _supabase.from('turni_contatore')
        .update({ turni_fatti: Math.max(0, existing.turni_fatti - valore) }).eq('id', existing.id);
    }
  }
}

async function removeAssign(a) {
  const label = a.nome_b ? `${a.nome_a} + ${a.nome_b}` : a.nome_a;
  await _supabase.from('assegnazioni').delete().eq('id', a.id);
  wsAssegnazioni = wsAssegnazioni.filter(x => x.id !== a.id);
  await decrementaContatore(a.nome_a, a.nome_b);
  renderWsCalendar();
  renderUnassigned();
  renderCounters();
  showToast(`${label} rimosso dal ${fmtDate(a.giorno)}`);
}

// ---- RIAPRI SLOT ----
function openRiapriSlot(id, chiusuraAttuale) {
  document.getElementById('riapri-slot-id').value = id;
  document.getElementById('riapri-chiusura').value = chiusuraAttuale || '';
  document.getElementById('riapri-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('riapri-chiusura').focus(), 50);
}

document.getElementById('riapri-cancel').addEventListener('click', () =>
  document.getElementById('riapri-overlay').classList.add('hidden'));

document.getElementById('riapri-ok').addEventListener('click', async () => {
  const id = document.getElementById('riapri-slot-id').value;
  const chiusura = document.getElementById('riapri-chiusura').value || null;
  if (!chiusura) { showToast('Inserisci la nuova data di chiusura', 'error'); return; }
  const { error } = await _supabase.from('slots').update({
    calendario_pubblicato: false,
    data_chiusura_richieste: chiusura
  }).eq('id', id);
  document.getElementById('riapri-overlay').classList.add('hidden');
  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast('Slot riaperto per le desiderata!', 'success');
  loadSlots();
});

// ---- MODAL ASSEGNAZIONE MANUALE ----
let assignGiorno = null;

function openManualAssign(giorno) {
  assignGiorno = giorno;
  document.getElementById('assign-title').textContent = `Assegna turno – ${fmtDate(giorno)}`;
  document.getElementById('assign-nome-a').value = '';
  document.getElementById('assign-nome-b').value = '';
  document.getElementById('assign-sug-a').style.display = 'none';
  document.getElementById('assign-sug-b').style.display = 'none';
  validateAssignModal();
  document.getElementById('assign-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('assign-nome-a').focus(), 50);
}

function validateAssignModal() {
  const nomi = wsTurnisti.map(t => t.nome);
  const a = document.getElementById('assign-nome-a').value.trim();
  const b = document.getElementById('assign-nome-b').value.trim();
  const ok = nomi.includes(a) && (b === '' || (nomi.includes(b) && b !== a));
  document.getElementById('assign-ok').disabled = !ok;
  document.getElementById('assign-ok').style.opacity = ok ? '1' : '.4';
}

function setupAssignAutocomplete(inputId, sugId, otherInputId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(sugId);
  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    box.innerHTML = '';
    if (!val) { box.style.display = 'none'; validateAssignModal(); return; }
    const otherVal = document.getElementById(otherInputId).value.trim();
    const filtered = wsTurnisti.map(t => t.nome)
      .filter(n => n.toLowerCase().includes(val) && n !== otherVal);
    if (!filtered.length) { box.style.display = 'none'; validateAssignModal(); return; }
    filtered.forEach(nome => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = nome;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = nome;
        box.style.display = 'none';
        validateAssignModal();
      });
      box.appendChild(item);
    });
    box.style.display = 'block';
  });
  input.addEventListener('blur', () => { setTimeout(() => { box.style.display = 'none'; }, 150); validateAssignModal(); });
  input.addEventListener('focus', () => { if (input.value.trim()) input.dispatchEvent(new Event('input')); });
}

document.getElementById('assign-cancel').addEventListener('click', () =>
  document.getElementById('assign-overlay').classList.add('hidden'));
document.getElementById('assign-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('assign-overlay'))
    document.getElementById('assign-overlay').classList.add('hidden');
});
document.getElementById('assign-ok').addEventListener('click', async () => {
  const nomeA = document.getElementById('assign-nome-a').value.trim();
  const nomeB = document.getElementById('assign-nome-b').value.trim() || null;
  document.getElementById('assign-overlay').classList.add('hidden');
  await insertAssign(assignGiorno, nomeA, nomeB);
});
document.getElementById('assign-nome-b').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('assign-ok').disabled)
    document.getElementById('assign-ok').click();
});

function renderUnassigned() {
  const div = document.getElementById('unassigned-list');
  const assigned = new Set(wsAssegnazioni.map(a => a.nome_a));
  const unassigned = wsTurnisti.filter(t => !assigned.has(t.nome));
  if (!unassigned.length) {
    div.innerHTML = '<em style="color:#2e7d32">✅ Tutti assegnati!</em>';
    return;
  }
  div.innerHTML = '';
  unassigned.forEach(t => {
    const span = document.createElement('span');
    span.className = 'badge drag-item';
    span.draggable = true;
    span.textContent = t.nome;
    span.addEventListener('dragstart', e => {
      _dropHandled = false;
      e.dataTransfer.setData('text/plain', t.nome);
      e.dataTransfer.setData('from-giorno', '__unassigned__');
      setTimeout(() => highlightIndisp([t.nome]), 0);
    });
    span.addEventListener('dragend', () => clearHighlightIndisp());
    div.appendChild(span);
  });
}

function renderCounters() {
  const div = document.getElementById('turni-counters');
  // Calcola direttamente da wsAssegnazioni per avere sempre valori in sync
  const fattiMap = {};
  wsAssegnazioni.forEach(a => {
    const v = a.nome_b ? 0.5 : 1;
    fattiMap[a.nome_a] = (fattiMap[a.nome_a] || 0) + v;
    if (a.nome_b) fattiMap[a.nome_b] = (fattiMap[a.nome_b] || 0) + v;
  });
  let html = '<table style="width:100%;font-size:.85rem;border-collapse:collapse">';
  html += `<tr>
    <th style="text-align:left;padding:.3rem .5rem;border-bottom:2px solid var(--border);color:var(--text)">Turnista</th>
    <th style="padding:.3rem;border-bottom:2px solid var(--border);color:var(--text)">Dovuti</th>
    <th style="padding:.3rem;border-bottom:2px solid var(--border);color:var(--text)">Fatti</th>
    <th style="padding:.3rem;border-bottom:2px solid var(--border);color:var(--text)">Delta</th>
  </tr>`;
  wsTurnisti.forEach(t => {
    const fatti = fattiMap[t.nome] || 0;
    const delta = fatti - t.turni_dovuti_per_slot;
    const color = delta >= 0 ? '#2e7d32' : '#c62828';
    html += `<tr>
      <td style="padding:.3rem .5rem;border-bottom:1px solid var(--border);color:var(--text)">${t.nome}</td>
      <td style="padding:.3rem;text-align:center;border-bottom:1px solid var(--border);color:var(--text)">${t.turni_dovuti_per_slot}</td>
      <td style="padding:.3rem;text-align:center;border-bottom:1px solid var(--border);color:var(--text)">${fatti}</td>
      <td style="padding:.3rem;text-align:center;color:${color};font-weight:700;border-bottom:1px solid var(--border)">${delta >= 0 ? '+' : ''}${delta}</td>
    </tr>`;
  });
  html += '</table>';
  div.innerHTML = html;
}

async function aggiornaContatore(nomeA, nomeB) {
  const valore = nomeB ? 0.5 : 1;
  for (const nome of [nomeA, nomeB].filter(Boolean)) {
    const { data: existing } = await _supabase.from('turni_contatore')
      .select('*').eq('slot_id', wsSlot.id).eq('nome', nome).single();
    if (existing) {
      await _supabase.from('turni_contatore')
        .update({ turni_fatti: existing.turni_fatti + valore }).eq('id', existing.id);
    } else {
      await _supabase.from('turni_contatore').insert({
        slot_id: wsSlot.id, nome, turni_fatti: valore
      });
    }
  }
}

// ---- AUTO-ASSEGNA ----
document.getElementById('auto-assign-btn').addEventListener('click', autoAssign);

async function autoAssign() {
  adminConfirm('Auto-assegnazione',
    'Assegna i turnisti con desiderata rispettando il budget (turni dovuti ±0.5). Giorni senza candidati validi rimangono vuoti.',
    async () => {

      // --- Turni già fatti (da assegnazioni preesistenti) ---
      const fatti = {};
      wsTurnisti.forEach(t => { fatti[t.nome] = 0; });
      wsAssegnazioni.forEach(a => {
        const v = a.nome_b ? 0.5 : 1;
        if (fatti[a.nome_a] !== undefined) fatti[a.nome_a] += v;
        if (a.nome_b && fatti[a.nome_b] !== undefined) fatti[a.nome_b] += v;
      });

      // --- Budget massimo per turnista: turni_dovuti + 0.5 ---
      const budgetMax = {};
      wsTurnisti.forEach(t => { budgetMax[t.nome] = t.turni_dovuti_per_slot + 0.5; });

      // --- Desiderata per giorno ---
      const desByDay = {};
      wsPreferenze.filter(p => p.tipo === 'desiderata').forEach(p => {
        if (!desByDay[p.giorno]) desByDay[p.giorno] = [];
        desByDay[p.giorno].push(p);
      });

      // --- Giorni con desiderata per ogni turnista (deduplicati) ---
      const giorniPerNome = {};
      wsTurnisti.forEach(t => { giorniPerNome[t.nome] = new Set(); });
      wsPreferenze.filter(p => p.tipo === 'desiderata').forEach(p => {
        if (giorniPerNome[p.nome_a]) giorniPerNome[p.nome_a].add(p.giorno);
      });

      // --- Giorni già assegnati ---
      const assignedDays = new Set(wsAssegnazioni.map(a => a.giorno));

      // Ha ancora budget per un'assegnazione singola o in coppia?
      const hasBudget = (nome, isCoppia) =>
        (fatti[nome] || 0) + (isCoppia ? 0.5 : 1) <= (budgetMax[nome] || 0);

      // Quanti giorni liberi con desiderata ha questo turnista (escluso il giorno che stiamo valutando)?
      // Usato per capire chi è più "scarso" e quindi ha priorità
      const giorniLiberi = (nome, escludi) => {
        let n = 0;
        (giorniPerNome[nome] || new Set()).forEach(d => {
          if (d !== escludi && !assignedDays.has(d)) n++;
        });
        return n;
      };

      // --- Scorre i giorni in ordine ---
      const dates = dateRange(wsSlot.data_inizio, wsSlot.data_fine);

      for (const d of dates) {
        if (assignedDays.has(d)) continue;

        const candidati = desByDay[d];
        if (!candidati || candidati.length === 0) continue;

        // 1. COPPIE: entrambi i membri hanno ancora budget
        const coppieValide = candidati.filter(p =>
          p.nome_b && hasBudget(p.nome_a, true) && hasBudget(p.nome_b, true)
        );

        if (coppieValide.length > 0) {
          // Priorità alla coppia con meno altri giorni disponibili (più difficile da collocare altrove)
          coppieValide.sort((a, b) =>
            (giorniLiberi(a.nome_a, d) + giorniLiberi(a.nome_b, d)) -
            (giorniLiberi(b.nome_a, d) + giorniLiberi(b.nome_b, d))
          );
          const scelta = coppieValide[0];
          await insertAssign(d, scelta.nome_a, scelta.nome_b);
          fatti[scelta.nome_a] = (fatti[scelta.nome_a] || 0) + 0.5;
          fatti[scelta.nome_b] = (fatti[scelta.nome_b] || 0) + 0.5;
          assignedDays.add(d);
          continue;
        }

        // 2. SINGOLI: turnista con budget residuo
        const singoli = [...new Set(candidati.map(p => p.nome_a))]
          .filter(n => hasBudget(n, false));

        if (singoli.length === 0) continue;

        // Priorità a chi ha meno altri giorni disponibili
        singoli.sort((a, b) => giorniLiberi(a, d) - giorniLiberi(b, d));
        const scelto = singoli[0];
        await insertAssign(d, scelto, null);
        fatti[scelto] = (fatti[scelto] || 0) + 1;
        assignedDays.add(d);
      }

      showToast('Auto-assegnazione completata!', 'success');
      await loadWorkspace();
    });
}

document.getElementById('pubblica-cal-btn').addEventListener('click', () => {
  adminConfirm('Pubblica calendario',
    'Il calendario sarà visibile al pubblico. Continuare?',
    async () => {
      await _supabase.from('slots').update({ calendario_pubblicato: true }).eq('id', wsSlot.id);
      showToast('Calendario pubblicato!', 'success');
    });
});

// =============================================
//  TAB TURNISTI
// =============================================
async function loadTurnisti() {
  const { data } = await _supabase.from('turnisti').select('*').eq('attivo', true).order('nome');
  const div = document.getElementById('turnisti-list');
  if (!data || !data.length) { div.innerHTML = '<em style="color:#aaa">Nessun turnista</em>'; return; }
  wsTurnisti = data;
  div.innerHTML = '';
  data.forEach(t => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.8rem;padding:.5rem 0;border-bottom:1px solid var(--border)';
    row.innerHTML = `
      <span style="flex:1;font-weight:600;color:var(--text)">${t.nome}</span>
      <span style="font-size:.82rem;color:var(--text-muted)">Turni/slot:</span>
      <input type="number" value="${t.turni_dovuti_per_slot}" min="1"
        style="width:60px;padding:.3rem .5rem;border:1px solid var(--border);border-radius:6px;font-size:.85rem;background:var(--bg-card);color:var(--text)"
        onchange="updateTurniDovuti('${t.id}', this.value)">
      <button class="btn btn-danger btn-sm" onclick="deleteTurnista('${t.id}','${t.nome.replace(/'/g,"\\'")}')">Rimuovi</button>
    `;
    div.appendChild(row);
  });
}

document.getElementById('add-turnista-btn').addEventListener('click', async () => {
  const nome = document.getElementById('t-nome').value.trim();
  const turni = parseInt(document.getElementById('t-turni').value) || 1;
  if (!nome) { showToast('Inserisci il nome', 'error'); return; }
  const { error } = await _supabase.from('turnisti').insert({ nome, turni_dovuti_per_slot: turni });
  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  document.getElementById('t-nome').value = '';
  showToast('Turnista aggiunto!', 'success');
  loadTurnisti();
});

async function updateTurniDovuti(id, val) {
  await _supabase.from('turnisti').update({ turni_dovuti_per_slot: parseInt(val) }).eq('id', id);
  showToast('Aggiornato');
}

function deleteTurnista(id, nome) {
  adminConfirm('Rimuovi turnista', `Rimuovere ${nome} dall'elenco?`, async () => {
    await _supabase.from('turnisti').update({ attivo: false }).eq('id', id);
    showToast('Turnista rimosso');
    loadTurnisti();
  });
}

// ---- INIT ----
function initAdmin() {
  loadSlots();
  loadTurnisti();
  setupAssignAutocomplete('assign-nome-a', 'assign-sug-a', 'assign-nome-b');
  setupAssignAutocomplete('assign-nome-b', 'assign-sug-b', 'assign-nome-a');
}

if (localStorage.getItem('ps_admin_auth') === '1') {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = '';
  initAdmin();
}