
window.DB = (function(){
  const LS_KEY = 'bookmark_data_v25';
  const blank = { items: [], tags: [], cols: [], history: [], colAssignments: [] };
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function now(){ return new Date().toISOString(); }

  // --- per-item-per-col assignment sequences ---
  // state.colAssignments: [{ colId, itemId, seq }]
  function _ensureAssignments(){ state.colAssignments = state.colAssignments || []; }
  function getAssignment(itemId, colId){
    _ensureAssignments();
    return state.colAssignments.find(x=> x.itemId===itemId && x.colId===colId) || null;
  }
  function assignItemToCol(itemId, colId){
    try{
      _ensureAssignments();
      if(!itemId || !colId) return null;
      const existing = state.colAssignments.find(x=> x.itemId===itemId && x.colId===colId);
      if(existing) return existing;
      const seqs = state.colAssignments.filter(x=> x.colId===colId).map(x=> x.seq||0);
      const maxSeq = seqs.length ? Math.max(...seqs) : 0;
      const nextSeq = maxSeq + 1;
      const rec = { colId: colId, itemId: itemId, seq: nextSeq };
      state.colAssignments.push(rec);
      persist();
      return rec;
    }catch(e){ console.warn('assignItemToCol error', e); return null; }
  }
  function removeAssignmentsForItem(itemId){
    _ensureAssignments();
    state.colAssignments = state.colAssignments.filter(x=> x.itemId!==itemId);
    persist();
  }
  function removeAssignmentsForCol(colId){
    _ensureAssignments();
    state.colAssignments = state.colAssignments.filter(x=> x.colId!==colId);
    persist();
  }
  function listAssignments(){ _ensureAssignments(); return state.colAssignments.slice(); }

  // normalize existing relations: ensure assignments exist for any item that references a col
  function normalizeAssignments(){
    _ensureAssignments();
    const present = new Set(state.colAssignments.map(x=> x.colId+'|'+x.itemId));
    (state.items||[]).forEach(it=>{
      (it.cols||[]).forEach(cid=>{
        const key = cid+'|'+it.id;
        if(!present.has(key)){
          const seqs = state.colAssignments.filter(x=> x.colId===cid).map(x=> x.seq||0);
          const nextSeq = (seqs.length ? Math.max(...seqs) : 0) + 1;
          state.colAssignments.push({ colId: cid, itemId: it.id, seq: nextSeq });
          present.add(key);
        }
      });
    });
    persist();
  }


  function normalize(d){ d = d||{}; d.items = d.items||[]; d.tags = d.tags||[]; d.cols = d.cols||[]; d.items.forEach(it=>{ it.tags = it.tags||[]; it.cols = it.cols||[]; }); return d; }
  async function loadServer(){ try{ const r = await fetch('/api/data',{cache:'no-store'}); if(!r.ok) return null; const j = await r.json(); return normalize(j); }catch(e){ return null; } }
  function loadLocal(){ try{ const raw = localStorage.getItem(LS_KEY); if(!raw) return null; return normalize(JSON.parse(raw)); }catch(e){ return null; } }
  async function saveServer(data){ try{ await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); return true; }catch(e){ return false; } }
  function saveLocal(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }
  let state = JSON.parse(JSON.stringify(blank));

  // transient last action for undo support
  let _lastAction = null;
  function recordLastAction(act){ try{ _lastAction = act || null; }catch(e){} }
  function getLastAction(){ return _lastAction; }
  function clearLastAction(){ _lastAction = null; }

  // undo last action (supports removeItem, updateItem, deleteTag, deleteCol)
  function undoLastAction(){
    if(!_lastAction) return false;
    try{
      const a = _lastAction;
      if(a.type === 'removeItem' && a.item){
        state.items.push(a.item);
      } else if(a.type === 'updateItem' && a.id && a.prev){
        const it = state.items.find(x=>x.id===a.id);
        if(it) Object.assign(it, a.prev);
      } else if(a.type === 'deleteTag' && a.tag){
        // restore tag
        state.tags.push(a.tag);
        // restore tag associations
        if(Array.isArray(a.affected)){
          a.affected.forEach(af=>{
            const it = state.items.find(x=>x.id===af.id);
            if(it) it.tags = af.prevTags || it.tags || [];
          });
        }
      } else if(a.type === 'deleteCol' && a.col){
        state.cols.push(a.col);
        if(Array.isArray(a.affected)){
          a.affected.forEach(af=>{
            const it = state.items.find(x=>x.id===af.id);
            if(it) it.cols = af.prevCols || it.cols || [];
          });
        }
      } else {
        // unsupported
        return false;
      }
      // after undo, clear lastAction and persist
      clearLastAction();
      persist();
      return true;
    }catch(e){ console.warn('undoLastAction error', e); return false; }
  }


  async function init(){
    try{
      const local = loadLocal();
      if(local){
        state = normalize(local);
        try{ normalizeAssignments(); }catch(e){}
        return;
      }
    }catch(e){ /* ignore */ }

    try{
      const s = await loadServer();
      if(s){
        state = normalize(s);
        try{ normalizeAssignments(); }catch(e){}
        saveLocal(state);
        return;
      }
    }catch(e){ /* ignore server errors */ }

    // no stored data — initialize blank
    state = JSON.parse(JSON.stringify(blank));
    saveLocal(state);
  }
  function getState(){ return state; }
  function listTags(){ return state.tags.slice(); }
  function listCols(){ return state.cols.slice(); }
  async function persist(){ saveLocal(state); await saveServer(state); }
  function addTag(name){ name=(name||'').trim(); if(!name) return null; if(state.tags.find(t=>t.name===name)) return null; const t={id:uid(),name,createdAt:now(),updatedAt:now()}; state.tags.push(t); persist(); return t; }
  function addCol(name){ name=(name||'').trim(); if(!name) return null; if(state.cols.find(c=>c.name===name)) return null; const c={id:uid(),name,createdAt:now(),updatedAt:now()}; state.cols.push(c); persist(); return c; }
  function renameTag(id,name){ const t = state.tags.find(x=>x.id===id); if(!t) return; t.name=name.trim(); t.updatedAt=now(); persist(); }
  function renameCol(id,name){ const c = state.cols.find(x=>x.id===id); if(!c) return; c.name=name.trim(); c.updatedAt=now(); persist(); }
  function deleteTag(id){ state.tags = state.tags.filter(t=>t.id!==id); state.items.forEach(it=> it.tags = it.tags.filter(x=>x!==id)); persist(); }
  

  function updateCol(id, patch){
    const c = state.cols.find(x=>x.id===id);
    if(!c) return;
    const prev = { name: c.name, idx: c.idx };
    if(patch.name!==undefined) c.name = patch.name;
    if(patch.idx!==undefined) c.idx = Number(patch.idx) || c.idx;
    c.updatedAt = now();
    persist();
    return c;
  }

function deleteCol(id){ state.cols = state.cols.filter(c=>c.id!==id); state.items.forEach(it=> it.cols = it.cols.filter(x=>x!==id)); persist(); }
  function addItem({name,url,tags,cols}){ const it = { id: uid(), name: name||'', url: url||'', tags: tags||[], cols: cols||[], createdAt: now(), updatedAt: now(), clickCount:0, lastClickedAt:null}; state.items.push(it); persist(); return it; }
  function updateItem(id, patch){ const it = state.items.find(x=>x.id===id); if(!it) return; const prev = JSON.parse(JSON.stringify(it)); Object.assign(it, patch); it.updatedAt = now(); recordLastAction({type:'updateItem', id:id, prev: prev}); persist(); try{ if(window.App && App.showUndoForLastAction) App.showUndoForLastAction('已編輯',5000); }catch(e){} }
  function removeItem(id){ const _it = state.items.find(x=>x.id===id); if(_it){ recordLastAction({type:'removeItem', item: JSON.parse(JSON.stringify(_it))}); } state.items = state.items.filter(x=>x.id!==id); persist(); try{ if(window.App && App.showUndoForLastAction) App.showUndoForLastAction('已刪除',5000); }catch(e){} }
  function clickItem(id){ const it = state.items.find(x=>x.id===id); if(!it) return; it.clickCount = (it.clickCount||0)+1; it.lastClickedAt = now(); try{ if(typeof addHistory === 'function') addHistory({type:'open', itemId: it.id, url: it.url, name: it.name}); }catch(e){} persist(); }
  

  // history recording API
  function addHistory(entry){
    try{
      entry = entry || {};
      const h = { id: uid(), type: entry.type || 'copy', itemId: entry.itemId || null, url: entry.url || '', name: entry.name || '', at: now() };
      state.history = state.history || [];
      state.history.push(h);
      persist();
      return h;
    }catch(e){ console.warn('addHistory error', e); return null; }
  }
  function listHistory(){
    state.history = state.history || [];
    // return descending by time
    return state.history.slice().sort((a,b)=> (b.at||'').localeCompare(a.at||''));
  }
  function clearHistory(){
    state.history = [];
    persist();
  }



  function updateAssignment(itemId, colId, seq){
    try{
      _ensureAssignments();
      const a = state.colAssignments.find(x=> x.itemId===itemId && x.colId===colId);
      if(!a) return null;
      a.seq = Number(seq) || a.seq;
      persist();
      return a;
    }catch(e){ console.warn(e); return null; }
  }
return { updateAssignment, init, getState, listTags, listCols, addTag, addCol, renameTag, renameCol, deleteTag, deleteCol, addItem, updateItem, removeItem, clickItem, persist, addHistory, listHistory, clearHistory, getLastAction, undoLastAction, clearLastAction, updateCol, addHistory, listHistory, clearHistory, addHistory, listHistory, clearHistory, getLastAction, undoLastAction, clearLastAction, assignItemToCol, getAssignment, removeAssignmentsForItem, removeAssignmentsForCol, listAssignments, normalizeAssignments};
})();
