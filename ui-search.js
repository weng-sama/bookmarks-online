
window.UI_SEARCH = (function(){
  const el = {}; let page=1, pageSize=20; const selected={tags:new Set(), cols:new Set()};
  function qs(id){ return document.getElementById(id); }
  function levenshtein(a,b){ if(!a||!b) return Math.max(a? a.length:0, b? b.length:0); a=a.toLowerCase(); b=b.toLowerCase(); const m=a.length, n=b.length; const dp = Array.from({length:m+1}, ()=> new Array(n+1)); for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j; for(let i=1;i<=m;i++){ for(let j=1;j<=n;j++){ const cost = a[i-1]===b[j-1]?0:1; dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost); }} return dp[m][n]; }
  function matchFuzzy(field, q){ if(!field) return false; field = field.toLowerCase(); q = q.toLowerCase(); if(field.indexOf(q)!==-1) return true; const dist = levenshtein(field, q); if(dist <= Math.max(1, Math.floor(q.length*0.35))) return true; const parts = field.split(/\W+/); for(const p of parts){ if(p && (p.indexOf(q)!==-1 || levenshtein(p,q) <= Math.max(1, Math.floor(q.length*0.35)))) return true; } return false; }
  function applyPresets(){ try{ const presetTags = JSON.parse(localStorage.getItem('v26c_search_tags')||'[]'); const presetCols = JSON.parse(localStorage.getItem('v26c_search_cols')||'[]'); selected.tags.clear(); selected.cols.clear(); if(presetTags && presetTags.length) presetTags.forEach(id=> selected.tags.add(id)); if(presetCols && presetCols.length) presetCols.forEach(id=> selected.cols.add(id)); }catch(e){} renderFilters(); renderList(); }
  
  function renderFilters(){
    // compute usage counts from items
    const st = DB.getState();
    const tagUsage = {}; st.items.forEach(it=> (it.tags||[]).forEach(id=> tagUsage[id] = (tagUsage[id]||0)+1));
    const colUsage = {}; st.items.forEach(it=> (it.cols||[]).forEach(id=> colUsage[id] = (colUsage[id]||0)+1));
    const s=(el.tagSearch.value||'').toLowerCase(); el.tagList.innerHTML='';
    // sort tags by usage desc, then name
    DB.listTags().slice().sort((a,b)=> (tagUsage[b.id]||0)-(tagUsage[a.id]||0) || a.name.localeCompare(b.name,'zh-Hant')).forEach(t=>{
      if(!t.name.toLowerCase().includes(s)) return;
      const chip = App.makeChip(t.id, t.name, selected.tags.has(t.id), (id,on)=>{ if(on) selected.tags.add(id); else selected.tags.delete(id); page=1; renderList(); });
      el.tagList.appendChild(chip);
    });
    const sc=(el.colSearch.value||'').toLowerCase(); el.colList.innerHTML='';
    DB.listCols().slice().sort((a,b)=> ( (a.idx||0)-(b.idx||0) )).forEach(c=>{ if(!c.name.toLowerCase().includes(sc)) return; const label = c.name; const chip = App.makeChip(c.id, label, selected.cols.has(c.id), (id,on)=>{ if(on) selected.cols.add(id); else selected.cols.delete(id); page=1; renderList(); });
      el.colList.appendChild(chip);
    });
  }

  function dataFiltered(){
    const st=DB.getState(); let arr=st.items.slice();
    const q=(el.q.value||'').toLowerCase();
    if(q){ arr = arr.filter(it=> matchFuzzy((it.name||''), q) || matchFuzzy((it.url||''), q)); }
    if(selected.tags.size>0) arr = arr.filter(it=> Array.from(selected.tags).every(id=> it.tags.includes(id)));
    if(selected.cols.size>0) arr = arr.filter(it=> Array.from(selected.cols).every(id=> it.cols.includes(id)));
    return arr;
  }
  function renderList(){
    const tags = DB.listTags(), cols = DB.listCols();
    const arr = dataFiltered();
    const total = Math.max(1, Math.ceil(arr.length/pageSize)); if(page>total) page=total;
    const start=(page-1)*pageSize; const rows=arr.slice(start,start+pageSize);
    el.list.innerHTML=''; rows.forEach(it=> el.list.appendChild(App.makeItemRow(it,tags,cols)));
    // update search count display
    try{ const scEl = document.getElementById('search-count'); if(scEl) scEl.textContent = arr.length + ' 筆'; }catch(e){}
    App.renderPagination({ container: el.pages, page, total, onPage:(n)=>{ page=n; renderList(); } });
    el.prev.disabled=(page===1); el.next.disabled=(page===total);
  }
  function init(){
    el.list=qs('search-list'); el.pages=qs('search-pages'); el.prev=qs('search-prev'); el.next=qs('search-next'); el.jump=qs('search-jump'); el.jumpGo=qs('search-jump-go'); el.size=qs('search-size');
    el.q=qs('search-q'); el.tagSearch=qs('search-tag-search'); el.colSearch=qs('search-col-search'); el.tagList=qs('search-tag-list'); el.colList=qs('search-col-list');
    el.prev.addEventListener('click', ()=>{ if(page>1){ page--; renderList(); } }); el.next.addEventListener('click', ()=>{ page++; renderList(); });
    el.jumpGo.addEventListener('click', ()=>{ const n=parseInt(el.jump.value,10)||1; page=Math.max(1,n); renderList(); });
    el.size.addEventListener('change', ()=>{ pageSize = parseInt(el.size.value,10)||20; renderList(); });
    el.q.addEventListener('input', ()=>{ page=1; renderList(); });
    el.tagSearch.addEventListener('input', renderFilters); el.colSearch.addEventListener('input', renderFilters);
    applyPresets(); renderFilters(); renderList();
  }
  return { init, refresh: function(){ pageSize = parseInt(el.size.value,10)||20; renderFilters(); renderList(); }, applyPresets };
})();
