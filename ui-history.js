
window.UI_HISTORY = (function(){
  let listEl;
  function qs(id){ return document.getElementById(id); }

  function fmtTime(iso){
    try{ const d = new Date(iso); return d.toLocaleString(); }catch(e){ return iso||''; }
  }

  function render(){
    listEl = listEl || qs('history-list');
    listEl.innerHTML = '';
    const st = DB.getState();
    const itemsMap = (st.items || []).reduce((m,it)=>{ m[it.id]=it; return m; }, {});
    const history = (DB.listHistory && DB.listHistory()) || (st.history||[]);
    if(!history || history.length===0){
      const p = document.createElement('div'); p.className='muted'; p.textContent='沒有記錄。';
      listEl.appendChild(p); return;
    }
    history.forEach(h=>{
      // Determine the item to render: prefer the real item if itemId exists, otherwise create a minimal item object
      let item = null;
      if(h.itemId && itemsMap[h.itemId]) item = itemsMap[h.itemId];
      else item = { id: 'hist-'+h.id, name: h.name || '(未命名)', url: h.url || '', tags: [], cols: [] };

      // Use existing App.makeItemRow to keep UI identical to favorites
      try{
        const row = App.makeItemRow(item, DB.listTags(), DB.listCols());
        // attach a small timestamp badge to the row (styled minimally)
        const meta = document.createElement('div');
        meta.className = 'history-ts';
        meta.textContent = fmtTime(h.at);
        // ensure meta has a small style if CSS not present
        meta.style.fontSize = '0.8em';
        meta.style.opacity = '0.75';
        meta.style.marginLeft = '8px';
        // append meta into the row-right area if exists, otherwise append to row
        const rr = row.querySelector('.item-right');
        if(rr){
          rr.appendChild(meta);
        } else {
          row.appendChild(meta);
        }
        
        // disable edit/delete buttons for history entries that do not map to real items
        try{
          const hasRealItem = (h.itemId && itemsMap[h.itemId]);
          if(!hasRealItem){
            const btns = Array.from(row.querySelectorAll('button'));
            btns.forEach(b=>{
              const txt = (b.textContent||'').trim();
              if(txt==='編輯' || txt==='刪除'){
                b.disabled = true;
                b.classList.add('disabled');
                b.title = '原始項目已不存在，無法編輯/刪除';
              }
            });
          }
        }catch(e){}
    listEl.appendChild(row);
      }catch(e){
        // fallback: simple row
        const div = document.createElement('div'); div.className='item';
        div.textContent = (h.name? (h.name + ' — ') : '') + (h.url||'');
        const t = document.createElement('div'); t.className='history-ts'; t.textContent = fmtTime(h.at);
        div.appendChild(t);
        listEl.appendChild(div);
      }
    });
  }

  function init(){
    listEl = qs('history-list');
    const clearBtn = qs('history-clear');
    if(clearBtn) clearBtn.addEventListener('click', ()=>{
      if(confirm('確定要清空記錄？')){ if(DB.clearHistory) DB.clearHistory(); render(); }
    });
    render();
  }

  return { init, render, refresh: render };
})();
