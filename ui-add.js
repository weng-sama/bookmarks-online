
/*
  ui-add.js - reconstructed and optimized
  Responsibilities:
  - render tag/col chip lists with search & selection
  - allow creating new tags/cols
  - handle Save (add bookmark) and Reset
  - provide simple UX feedback (button text & disabled states)
*/
window.UI_ADD = (function(){
  const el = {};
  const selected = { tags: new Set(), cols: new Set() };

  function qs(id){ return document.getElementById(id); }

  function renderTagList(){
    const tags = DB.listTags();
    const q = (el.tagSearch.value||'').toLowerCase();
    el.tagList.innerHTML = '';
    tags.forEach(t=>{
      if(q && !t.name.toLowerCase().includes(q)) return;
      const chip = App.makeChip(t.id, t.name, selected.tags.has(t.id), (id,on)=>{
        if(on) selected.tags.add(id); else selected.tags.delete(id);
      });
      el.tagList.appendChild(chip);
    });
  }

  function renderColList(){
    const cols = DB.listCols();
    const q = (el.colSearch.value||'').toLowerCase();
    el.colList.innerHTML = '';
    cols.forEach(c=>{
      if(q && !c.name.toLowerCase().includes(q)) return;
      let nextSeq = 1;
      try{
        // compute next seq as max existing seq for this col + 1
        if(DB && DB.listAssignments){
          const assigns = DB.listAssignments().filter(a=> a.colId===c.id);
          const nextSeq = (assigns.length ? assigns.length : 0) + 1;
        }
      }catch(e){ nextSeq = 1; }
      const label = c.name + '[' + nextSeq + ']';
      const chip = App.makeChip(c.id, label, selected.cols.has(c.id), (id,on)=>{
        if(on) selected.cols.add(id); else selected.cols.delete(id);
      });
      el.colList.appendChild(chip);
    });
  }

  function resetForm(){
    el.name.value = '';
    el.url.value = '';
    selected.tags.clear();
    selected.cols.clear();
    renderTagList(); renderColList();
  }

  // ensure URL has protocol
  function normalizeUrl(u){
    if(!u) return '';
    u = u.trim();
    if(/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(u)) return u;
    return 'https://' + u;
  }

  async function onSave(){
    const name = (el.name.value||'').trim();
    const rawUrl = (el.url.value||'').trim();
    if(!rawUrl){
      alert('請輸入網址');
      el.url.focus();
      return;
    }
    const url = normalizeUrl(rawUrl);
    // basic url validation
    try{
      new URL(url);
    }catch(e){
      alert('網址格式錯誤: ' + url);
      el.url.focus();
      return;
    }
    // ensure tags/cols arrays are real arrays
    const tags = Array.from(selected.tags);
    const cols = Array.from(selected.cols);

    // disable save while processing
    const oldText = el.save.textContent;
    el.save.disabled = true;
    el.save.textContent = '儲存中...';
    try{
      // add item via DB
      const newItem = DB.addItem({ name, url, tags, cols });
      // ensure assignments (stable seq numbers) are created for each selected col
      try{
        if(newItem && Array.isArray(cols) && DB && DB.assignItemToCol){
          cols.forEach(cid=>{ try{ DB.assignItemToCol(newItem.id, cid); }catch(e){} });
        }
      }catch(e){}
      // refresh col list to show updated next-seq numbers
      try{ renderColList(); }catch(e){};
      el.save.textContent = '已加入收藏';
      setTimeout(()=> el.save.textContent = oldText, 1200);
      resetForm();
      // notify other UI parts
      try{ UI_FAV.refresh(); UI_SEARCH.refresh(); UI_MANAGE.render(); UI_HISTORY.refresh(); }catch(e){}
    }catch(e){
      console.error('save failed', e);
      alert('儲存失敗，請查看控制台');
      el.save.textContent = oldText;
    }finally{
      el.save.disabled = false;
    }
  }

  function ensureElements(){
    el.name = qs('add-name');
    el.url = qs('add-url');
    el.tagList = qs('add-tag-list');
    el.tagSearch = qs('add-tag-search');
    el.tagNew = qs('add-tag-new');
    el.btnAddTag = qs('btn-add-tag');

    el.colList = qs('add-col-list');
    el.colSearch = qs('add-col-search');
    el.colNew = qs('add-col-new');
    el.btnAddCol = qs('btn-add-col');

    el.save = qs('btn-save');
    el.reset = qs('btn-reset');
  }

  function wire(){
    el.tagSearch.addEventListener('input', ()=>renderTagList(), {passive:true});
    el.colSearch.addEventListener('input', ()=>renderColList(), {passive:true});

    el.btnAddTag.addEventListener('click', ()=>{
      const name = (el.tagNew.value||'').trim();
      if(!name) return;
      const t = DB.addTag(name);
      // select it
      selected.tags.add(t.id);
      el.tagNew.value = '';
      renderTagList();
      try{ UI_MANAGE.render(); }catch(e){}
    });
    el.btnAddCol.addEventListener('click', ()=>{
      const name = (el.colNew.value||'').trim();
      if(!name) return;
      const c = DB.addCol(name);
      selected.cols.add(c.id);
      el.colNew.value = '';
      renderColList();
      try{ UI_MANAGE.render(); }catch(e){}
    });

    el.save.addEventListener('click', onSave);
    el.reset.addEventListener('click', resetForm);

    // enter key on new tag/col inputs also add
    el.tagNew.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); el.btnAddTag.click(); }});
    el.colNew.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); el.btnAddCol.click(); }});

    // helpful shortcut: pressing Enter on url field saves
    el.url.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); el.save.click(); }});
  }

  function init(){
    ensureElements();
    renderTagList();
    renderColList();
    wire();
  }

  function refresh(){
    renderTagList(); renderColList();
  }

  return { init, refresh, reset: resetForm };
})();
