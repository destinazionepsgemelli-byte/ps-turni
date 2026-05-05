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
function adminConfirm(title, text, onYes) {
  document.getElementById('admin-confirm-title').textContent = title;
  document.getElementById('admin-confirm-text').textContent = text;
  adminConfirmCallback = onYes;
  document.getElementById('admin-confirm-overlay').classList.remove('hidden');
}
document.getElementById('admin-confirm-no').addEventListener('click', () =>
  document.getElementById('admin-confirm-overlay').classList.add('hidden'));
document.getElementById('admin-confirm-yes').addEventListener('click', () => {
  document.getElementById('admin-confirm-overlay').classList.add('hidden');
  if (adminConfirmCallback) adminConfirmCallback();
});

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
    row.innerHTML = `
      <span style="font-weight:600;flex:1;color:var(--text)">${s.nome}</span>
      <span style="font-size:.82rem;color:var(--text-muted)">${fmtDate(s.data_inizio)} → ${fmtDate(s.data_fine)}</span>
      <span style="font-size:.8rem">${s.pubblicato
        ? '<span style="color:#2e7d32">✅ Pubblicato</span>'
        : '<span style="color:#aaa">⏸ Bozza</span>'}</span>
      ${!s.pubblicato ? `<button class="btn btn-success btn-sm" onclick="publishSlot('${s.id}')">Pubblica</button>` : ''}
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
  showToast('Slot pubblicato!', 'success');
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
      handleDrop(e.dataTransfer.getData('text/plain'), d, e.dataTransfer.getData('from-giorno'));
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
    e.dataTransfer.setData('text/plain', a.nome_a);
    e.dataTransfer.setData('nome-b', a.nome_b || '');
    e.dataTransfer.setData('from-giorno', a.giorno);
    e.dataTransfer.setData('ass-id', a.id);
  });
  span.querySelector('.badge-x').addEventListener('click', () => removeAssign(a));
  return span;
}

async function handleDrop(nomeA, giornoTarget, fromGiorno) {
  if (fromGiorno === giornoTarget) return;
  const existing = wsAssegnazioni.find(a => a.giorno === fromGiorno && a.nome_a === nomeA);
  if (existing) {
    const { error } = await _supabase.from('assegnazioni').update({ giorno: giornoTarget }).eq('id', existing.id);
    if (!error) {
      existing.giorno = giornoTarget;
      renderWsCalendar();
      renderUnassigned();
      renderCounters();
      showToast(`${nomeA} spostato`, 'success');
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

async function removeAssign(a) {
  adminConfirm('Rimuovi assegnazione',
    `Rimuovere ${a.nome_b ? a.nome_a + ' + ' + a.nome_b : a.nome_a} dal ${fmtDate(a.giorno)}?`,
    async () => {
      await _supabase.from('assegnazioni').delete().eq('id', a.id);
      wsAssegnazioni = wsAssegnazioni.filter(x => x.id !== a.id);
      renderWsCalendar();
      renderUnassigned();
      renderCounters();
    });
}

function openManualAssign(giorno) {
  const nome = prompt(`Assegna a ${fmtDate(giorno)}\nNome turnista:`);
  if (!nome) return;
  const nomeB = prompt('In coppia con (lascia vuoto per singolo):') || null;
  insertAssign(giorno, nome.trim(), nomeB ? nomeB.trim() : null);
}

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
      e.dataTransfer.setData('text/plain', t.nome);
      e.dataTransfer.setData('from-giorno', '__unassigned__');
    });
    div.appendChild(span);
  });
}

async function renderCounters() {
  const div = document.getElementById('turni-counters');
  const { data: counters } = await _supabase.from('turni_contatore')
    .select('*').eq('slot_id', wsSlot.id);
  const map = {};
  (counters || []).forEach(c => map[c.nome] = c.turni_fatti);
  let html = '<table style="width:100%;font-size:.85rem;border-collapse:collapse">';
  html += `<tr>
    <th style="text-align:left;padding:.3rem .5rem;border-bottom:2px solid var(--border);color:var(--text)">Turnista</th>
    <th style="padding:.3rem;border-bottom:2px solid var(--border);color:var(--text)">Dovuti</th>
    <th style="padding:.3rem;border-bottom:2px solid var(--border);color:var(--text)">Fatti</th>
    <th style="padding:.3rem;border-bottom:2px solid var(--border);color:var(--text)">Delta</th>
  </tr>`;
  wsTurnisti.forEach(t => {
    const fatti = map[t.nome] || 0;
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
    'Genera automaticamente il calendario? Le assegnazioni esistenti vengono mantenute.',
    async () => {
      const dates = dateRange(wsSlot.data_inizio, wsSlot.data_fine);
      const assignedDays = new Set(wsAssegnazioni.map(a => a.giorno));
      const counter = {};
      wsTurnisti.forEach(t => { counter[t.nome] = 0; });
      wsAssegnazioni.forEach(a => {
        const v = a.nome_b ? 0.5 : 1;
        counter[a.nome_a] = (counter[a.nome_a] || 0) + v;
        if (a.nome_b) counter[a.nome_b] = (counter[a.nome_b] || 0) + v;
      });

      for (const d of dates) {
        if (assignedDays.has(d)) continue;
        const indisponibili = new Set(
          wsPreferenze.filter(p => p.giorno === d && p.tipo === 'indisponibilita')
            .flatMap(p => [p.nome_a, p.nome_b].filter(Boolean))
        );
        const candidati = wsTurnisti
          .filter(t => !indisponibili.has(t.nome))
          .sort((a, b) => {
            const dA = wsPreferenze.some(p => p.giorno === d && p.tipo === 'desiderata' && p.nome_a === a.nome) ? -1 : 0;
            const dB = wsPreferenze.some(p => p.giorno === d && p.tipo === 'desiderata' && p.nome_a === b.nome) ? -1 : 0;
            if (dA !== dB) return dA - dB;
            return (counter[a.nome] || 0) - (counter[b.nome] || 0);
          });
        if (!candidati.length) continue;

        const coppia = wsPreferenze.find(p =>
          p.giorno === d && p.tipo === 'desiderata' && p.nome_b &&
          !indisponibili.has(p.nome_a) && !indisponibili.has(p.nome_b)
        );

        if (coppia) {
          await insertAssign(d, coppia.nome_a, coppia.nome_b);
          counter[coppia.nome_a] = (counter[coppia.nome_a] || 0) + 0.5;
          counter[coppia.nome_b] = (counter[coppia.nome_b] || 0) + 0.5;
        } else {
          await insertAssign(d, candidati[0].nome, null);
          counter[candidati[0].nome] = (counter[candidati[0].nome] || 0) + 1;
        }
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
}

if (localStorage.getItem('ps_admin_auth') === '1') {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = '';
  initAdmin();
}