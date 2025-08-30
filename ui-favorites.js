
window.UI_FAV = (function(){
  const el = {}; let page=1, pageSize=20;
  function qs(id){ return document.getElementById(id); }
  function dataAll(){ const st = DB.getState(); return st.items.slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')); }
  function renderList(){
    const tags = DB.listTags(), cols = DB.listCols();
    const arr = dataAll();
    const total = Math.max(1, Math.ceil(arr.length / pageSize));
    if(page>total) page=total;
    const start=(page-1)*pageSize; const rows=arr.slice(start,start+pageSize);
    el.list.innerHTML='';
    rows.forEach(it=> el.list.appendChild(App.makeItemRow(it, tags, cols)));
    App.renderPagination({ container: el.pages, page, total, onPage:(n)=>{ page=n; renderList(); } });
    el.prev.disabled = (page===1); el.next.disabled = (page===total);
    // update count
    const favCountEl = document.getElementById('fav-count'); if(favCountEl) favCountEl.textContent = arr.length + ' 筆';
  }
  function init(){ el.list=qs('fav-list'); el.pages=qs('fav-pages'); el.prev=qs('fav-prev'); el.next=qs('fav-next'); el.jump=qs('fav-jump'); el.jumpGo=qs('fav-jump-go'); el.size=qs('fav-size');
    el.prev.addEventListener('click', ()=>{ if(page>1){ page--; renderList(); } });
    el.next.addEventListener('click', ()=>{ page++; renderList(); });
    el.jumpGo.addEventListener('click', ()=>{ const n=parseInt(el.jump.value,10)||1; page=Math.max(1,n); renderList(); });
    el.size.addEventListener('change', ()=>{ pageSize = parseInt(el.size.value,10)||20; renderList(); });
    renderList();
  }
  function refresh(){ pageSize = parseInt(el.size.value,10) || 20; renderList(); }
  return { init, refresh };
})();