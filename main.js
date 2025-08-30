// v27f: silence popup replacements
window.silentConfirm = function(msg){ console.log('silentConfirm:', msg); return true; };
window.silentPrompt = function(msg, def){ console.log('silentPrompt:', msg); return null; };


window.App = (function(){
  const pages = ['favorites','add','search','manage','history'];
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = pages.map(p=>document.getElementById('page-'+p));

  let _currentPage = null;
  function goto(page){
    // if we are leaving the search page, clear search presets
    if(_currentPage === 'search' && page !== 'search'){
      try{ localStorage.removeItem('v26c_search_tags'); localStorage.removeItem('v26c_search_cols'); }catch(e){}
      if(window.UI_SEARCH && UI_SEARCH.applyPresets) UI_SEARCH.applyPresets();
    }

    pages.forEach((p,i)=>{ const active = (p===page); sections[i].classList.toggle('active', active); navBtns[i].classList.toggle('active', active); });
    location.hash = page;
    // refresh page content when navigating to it (keeps UI in sync when data changed elsewhere)
    try{
      // Mapping of page -> refresh function (if available)
      const __pageRefreshMap = {
        'favorites': ()=>{ if(window.UI_FAV && UI_FAV.refresh) UI_FAV.refresh(); },
        'add': ()=>{ if(window.UI_ADD && UI_ADD.refresh) UI_ADD.refresh(); },
        'search': ()=>{ if(window.UI_SEARCH && UI_SEARCH.refresh) UI_SEARCH.refresh(); },
        'manage': ()=>{ if(window.UI_MANAGE && UI_MANAGE.refresh) UI_MANAGE.refresh(); },
        'history': ()=>{ if(window.UI_HISTORY && UI_HISTORY.refresh) UI_HISTORY.refresh(); }
      };
      if(__pageRefreshMap[page]) __pageRefreshMap[page]();
    }catch(e){ console.warn('page refresh error', e); }

    _currentPage = page;
    try{ if(page==='favorites' && window.UI_FAV) UI_FAV.refresh(); }catch(e){}
    try{ if(page==='search' && window.UI_SEARCH) UI_SEARCH.refresh(); }catch(e){}
    try{ if(page==='manage' && window.UI_MANAGE) UI_MANAGE.render(); }catch(e){}
    try{ if(page==='history' && window.UI_HISTORY) UI_HISTORY.refresh(); }catch(e){}
  }

  function initNav(){
    navBtns.forEach(btn=>btn.addEventListener('click', ()=>goto(btn.dataset.page)));
    const initial = location.hash?.slice(1) || 'favorites';
    goto(pages.includes(initial)?initial:'favorites');
    window.addEventListener('hashchange', ()=>{ const p = location.hash.slice(1); if(pages.includes(p)) goto(p); });
  }

  function copyToClipboard(text){ try{ if(navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); console.warn('連結已複製'); return; } }catch(e){} try{ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); console.warn('連結已複製'); }catch(e){ console.warn('複製失敗，請手動複製'); } }

  function makeChip(id,label,selected,onToggle){
    const el = document.createElement('button');
    el.className='chip'+(selected?' selected':'');
    el.textContent=label;
    el.dataset.id=id;

    // helper to get uniform active color from CSS var or fallback
    function _activeColor(){
      try{
        const val = getComputedStyle(document.documentElement).getPropertyValue('--chip-active-bg') || '';
        const v = val.trim();
        if(v) return v;
      }catch(e){}
      return '#dbeafe'; // light blue fallback
    }

    // apply initial visual selected state and inline color fallback (uniform)
    if(selected){
      el.classList.add('chip-active');
      el.dataset._origBg = el.style.backgroundColor||'';
      el.style.backgroundColor = _activeColor();
    }

    el.addEventListener('click', ()=>{ selected = !selected; el.classList.toggle('selected', selected); el.classList.toggle('chip-active', selected);
      if(selected){
        if(el.dataset._origBg===undefined) el.dataset._origBg = el.style.backgroundColor||'';
        el.style.backgroundColor = _activeColor();
      } else {
        if(el.dataset._origBg) el.style.backgroundColor = el.dataset._origBg;
        else el.style.backgroundColor = '';
      }
      onToggle?.(id, selected);
    }, { passive:true });
    return el;
  }

  function renderPagination({container, page, total, onPage, span=5}){
    container.innerHTML='';
    function pageBtn(n, active=false){ const b=document.createElement('button'); b.className='pagi-page'+(active?' active':''); b.textContent=n; b.addEventListener('click', ()=>onPage(n)); return b; }
    const start = Math.max(1, page - Math.floor(span/2));
    const end = Math.min(total, Math.max(start+span-1, span));
    for(let i=start;i<=end;i++) container.appendChild(pageBtn(i, i===page));
  }

  function makeItemRow(item, tags, cols){
    const row=document.createElement('div'); row.className='item';
    const head=document.createElement('div'); head.className='item-head';
    const left=document.createElement('div'); left.className='item-left';
    const nm=document.createElement('div'); nm.className='item-name'; nm.textContent=item.name||'(未命名)'; nm.title = item.name || '';
    const url=document.createElement('a'); url.className='item-url'; url.href=item.url; url.target='_blank'; url.rel='noopener'; url.textContent = item.url; url.title = item.url || '';
    url.addEventListener('click', ()=>{ try{ DB.clickItem(item.id); }catch(e){} });
    left.appendChild(nm); left.appendChild(url);

    const right=document.createElement('div'); right.className='item-right';
    const btnEdit=document.createElement('button'); btnEdit.className='btn small'; btnEdit.textContent='編輯';
    const btnDel=document.createElement('button'); btnDel.className='btn small danger'; btnDel.textContent='刪除';
    // copy button (only visible on 已收藏頁)
    
    const btnCopy=document.createElement('button'); btnCopy.className='btn small btn-copy-link'; btnCopy.textContent='複製連結';
    btnCopy.addEventListener('click', async (e)=>{ 
      e.stopPropagation(); 
      const btn = e.currentTarget; const urlToCopy = item.url||'';
      const oldText = btn.textContent;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(urlToCopy);
        } else {
          copyToClipboard(urlToCopy);
        }
        // show feedback
        try{ btn.textContent = '已複製'; setTimeout(()=> btn.textContent = oldText, 1000); }catch(e){}
        // record history (best-effort)
        try{ if(typeof DB !== 'undefined' && DB.addHistory) { DB.addHistory({type:'copy', itemId: item && item.id ? item.id : null, url: urlToCopy, name: item && item.name ? item.name : ''}); } if(window.UI_HISTORY && UI_HISTORY.refresh) UI_HISTORY.refresh(); }catch(e){ console.warn('history log fail', e); }
      }catch(err){
        // fallback error feedback
        try{ btn.textContent = '失敗'; setTimeout(()=> btn.textContent = oldText, 1000); }catch(e){}
      }
    }, { passive:true });
    right.appendChild(btnCopy);
 right.appendChild(btnEdit); right.appendChild(btnDel);

    head.appendChild(left); head.appendChild(right); row.appendChild(head);

    const tagWrap=document.createElement('div'); tagWrap.className='tags';

    // tags: clicking adds/removes only this chip visually, updates localStorage presets and navigates to search
    (item.tags||[]).forEach(tid=>{
      const t = tags.find(x=>x.id===tid);
      if(!t) return;
      const chip=document.createElement('button'); chip.className='chip'; chip.textContent=t.name;
      chip.addEventListener('click',(e)=>{
        e.stopPropagation();
        try{
          // v27a: clear previous filters and use ONLY this tag
          localStorage.setItem('v26c_search_cols', JSON.stringify([]));
          localStorage.setItem('v26c_search_tags', JSON.stringify([tid]));
        }catch(err){}
        // navigate to search; presets will highlight immediately
        if(window.UI_SEARCH&&UI_SEARCH.applyPresets){ UI_SEARCH.applyPresets(); UI_SEARCH.refresh&&UI_SEARCH.refresh(); }
        location.hash='search';
      }, { passive:true });
      tagWrap.appendChild(chip);
    });

    (item.cols||[]).forEach(cid=>{
      const c = cols.find(x=>x.id===cid);
      if(!c) return;
      // get or create assignment for this item-col pairing so the seq is stable
      let assign = null;
      try{ assign = (DB && DB.getAssignment) ? DB.getAssignment(item.id, c.id) : null; }catch(e){ assign = null; }
      if(!assign){
        try{ if(DB && DB.assignItemToCol) assign = DB.assignItemToCol(item.id, c.id); }catch(e){ assign = null; }
      }
      const chip=document.createElement('button'); chip.className='chip';
      const seq = (assign && assign.seq) ? assign.seq : 1;
      chip.textContent = c.name + '[' + seq + ']';
      chip.addEventListener('click',(e)=>{
        e.stopPropagation();
        try{
          // v27a: clear previous filters and use ONLY this collection
          localStorage.setItem('v26c_search_tags', JSON.stringify([])); localStorage.setItem('v26c_search_cols', JSON.stringify([cid]));
        }catch(err){} 
        page=1; if(window.UI_SEARCH && UI_SEARCH.applyPresets){ UI_SEARCH.applyPresets(); UI_SEARCH.refresh&&UI_SEARCH.refresh(); }
        location.hash='search';
      });
      tagWrap.appendChild(chip);
    });

    row.appendChild(tagWrap);

    btnEdit.addEventListener('click', ()=> App.openEditItem(item.id) );
    btnDel.addEventListener('click', ()=>{ if(silentConfirm('確定刪除此收藏？')){ DB.removeItem(item.id); UI_FAV.refresh(); UI_SEARCH.refresh(); UI_HISTORY.refresh(); } });

    return row;
  }

  // modal handling (edit modal)
  const modal = document.getElementById('modal'); const modalClose = document.getElementById('modal-close'); const modalContent = document.getElementById('modal-content'); const modalTitle = document.getElementById('modal-title');
  if(modalClose) modalClose.addEventListener('click', ()=> hideModal()); if(modal) modal.addEventListener('click', (e)=>{ if(e.target.classList.contains('modal-backdrop')) hideModal(); });
  function showModal(title, contentEl){ modalTitle.textContent=title; modalContent.innerHTML=''; modalContent.appendChild(contentEl); modal.classList.remove('hidden'); document.querySelector('main').classList.add('modal-open-blur'); }
  function hideModal(){ modal.classList.add('hidden'); document.querySelector('main').classList.remove('modal-open-blur'); }

  function openEditItem(id){
    const state = DB.getState(); const it = state.items.find(x=>x.id===id); const allTags = DB.listTags(); const allCols = DB.listCols();
    if(!it) return;
    const box=document.createElement('div');
    box.innerHTML = `<div class="form-row"><label>名稱</label><input id="e-name" value="${(it.name||'').replace(/"/g,'&quot;')}"></div>
    <div class="form-row"><label>網址</label><input id="e-url" value="${(it.url||'').replace(/"/g,'&quot;')}"></div>
    <div class="picker-grid"><div class="picker card-sub"><div class="picker-head"><div class="picker-title">標籤</div><input id="e-tag-search" class="input-compact" placeholder="搜尋標籤"/></div><div id="e-tag-list" class="chip-list"></div></div>
    <div class="picker card-sub"><div class="picker-head"><div class="picker-title">合輯</div><input id="e-col-search" class="input-compact" placeholder="搜尋合輯"/></div><div id="e-col-list" class="chip-list"></div></div></div><div class="actions"><button id="e-save" class="btn primary">儲存</button></div>`;
    const selTags = new Set(it.tags||[]); const selCols = new Set(it.cols||[]);
    function renderEdit(){ const tl = box.querySelector('#e-tag-list'); tl.innerHTML=''; allTags.filter(x=>x.name.toLowerCase().includes(box.querySelector('#e-tag-search').value.toLowerCase())).forEach(t=> tl.appendChild(App.makeChip(t.id,t.name, selTags.has(t.id), (id,on)=>{ if(on) selTags.add(id); else selTags.delete(id);}))); const cl = box.querySelector('#e-col-list'); cl.innerHTML=''; allCols.filter(x=>x.name.toLowerCase().includes(box.querySelector('#e-col-search').value.toLowerCase())).forEach(c=> cl.appendChild(App.makeChip(c.id,c.name, selCols.has(c.id), (id,on)=>{ if(on) selCols.add(id); else selCols.delete(id);}))); }
    box.addEventListener('input',(e)=>{ if(e.target.id==='e-tag-search' || e.target.id==='e-col-search') renderEdit(); });
    renderEdit();
    box.querySelector('#e-save').addEventListener('click', ()=>{ DB.updateItem(it.id, { name: box.querySelector('#e-name').value, url: box.querySelector('#e-url').value, tags:Array.from(selTags), cols:Array.from(selCols) });
        // handle updated seq inputs for columns (edit modal)
        try{
          const seqInputs = box.querySelectorAll('.e-col-seq');
          seqInputs.forEach(inp=>{
            const btn = inp.previousElementSibling;
            if(!btn) return;
            const cid = btn.dataset && btn.dataset.id ? btn.dataset.id : null;
            const val = inp.value;
            if(cid && val!==undefined && val!==''){
              try{ if(DB && DB.updateAssignment) DB.updateAssignment(it.id, cid, Number(val)); }catch(e){}
            }
          });
        }catch(e){}
 hideModal(); UI_FAV.refresh(); UI_SEARCH.refresh(); UI_HISTORY.refresh(); });
    showModal('編輯收藏', box);
      try{
        const colList = box.querySelector('#e-col-list');
        if(colList){
          DB.listCols().forEach(c=>{
            try{
              const chip = colList.querySelector('[data-id=\"'+c.id+'\"]');
              if(chip){
                if(chip.nextElementSibling && chip.nextElementSibling.classList && chip.nextElementSibling.classList.contains('e-col-seq')) return;
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.className = 'e-col-seq input-compact';
                inp.style.width = '64px';
                inp.placeholder = '編號';
                try{ const a = (DB && DB.getAssignment) ? DB.getAssignment(it.id, c.id) : null; if(a && a.seq) inp.value = a.seq; }catch(e){}
                chip.parentNode.insertBefore(inp, chip.nextSibling);
              }
            }catch(e){}
          });
        }
      }catch(e){}
  }

  

  // simple undo/toast UI: message with undo button, visible for duration ms
  function showUndoToast(message, onUndo, duration=5000){
    try{
      // remove existing toast if any
      const existing = document.getElementById('app-undo-toast');
      if(existing) existing.remove();
      const t = document.createElement('div');
      t.id = 'app-undo-toast';
      t.style.position = 'fixed';
      t.style.right = '20px';
      t.style.bottom = '20px';
      t.style.zIndex = 9999;
      t.style.background = 'rgba(0,0,0,0.85)';
      t.style.color = '#fff';
      t.style.padding = '10px 12px';
      t.style.borderRadius = '8px';
      t.style.display = 'flex';
      t.style.alignItems = 'center';
      t.style.gap = '10px';
      t.textContent = message;
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = '復原';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', ()=>{
        try{ if(typeof onUndo==='function') onUndo(); }catch(e){ console.warn(e); }
        t.remove();
      }, { passive:true });
      t.appendChild(btn);
      document.body.appendChild(t);
      // auto remove after duration
      setTimeout(()=>{ if(t && t.parentNode) t.remove(); }, duration);
    }catch(e){ console.warn('showUndoToast error', e); }
  }

  // Exposed helper to show undo for last DB action
  function showUndoForLastAction(defaultMsg, duration=5000){
    try{
      const last = (DB && DB.getLastAction) ? DB.getLastAction() : null;
      const msg = defaultMsg || (last ? (last.type==='removeItem' ? '已刪除項目' : last.type) : '已變更');
      showUndoToast(msg, ()=>{ try{ if(DB && DB.undoLastAction) { const ok = DB.undoLastAction(); if(ok){ if(window.UI_FAV) UI_FAV.refresh(); if(window.UI_ADD) UI_ADD.refresh(); if(window.UI_SEARCH) UI_SEARCH.refresh(); if(window.UI_MANAGE) UI_MANAGE.refresh(); if(window.UI_HISTORY) UI_HISTORY.refresh(); } } }catch(e){ console.warn('undo callback error', e); } }, duration);
    }catch(e){ console.warn('showUndoForLastAction error', e); }
  }

return { initNav, goto, makeChip, renderPagination, makeItemRow, openEditItem, showModal, hideModal, showUndoForLastAction };
})();

document.addEventListener('DOMContentLoaded', async ()=>{ await DB.init(); App.initNav(); UI_ADD.init(); UI_FAV.init(); UI_SEARCH.init(); UI_MANAGE.init(); UI_HISTORY.init(); });
