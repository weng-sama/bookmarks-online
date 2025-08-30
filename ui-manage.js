
window.UI_MANAGE = (function(){
  const el = {}; function qs(id){ return document.getElementById(id); }
  function render(){
    el.tagList.innerHTML=''; el.colList.innerHTML='';
    const st = DB.getState(); const tagSort = document.getElementById('manage-sort')?document.getElementById('manage-sort').value:'name'; let tagArr = DB.listTags().slice(); const tagUsage = {}; st.items.forEach(it=> (it.tags||[]).forEach(id=> tagUsage[id] = (tagUsage[id]||0)+1));
    if(tagSort==='name') tagArr.sort((a,b)=> a.name.localeCompare(b.name,'zh-Hant')); else if(tagSort==='created_desc') tagArr.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')); else if(tagSort==='created_asc') tagArr.sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||'')); else if(tagSort==='usage_desc') tagArr.sort((a,b)=> (tagUsage[b.id]||0)-(tagUsage[a.id]||0));
    tagArr.filter(t=>t.name.toLowerCase().includes(el.tagSearch.value.toLowerCase())).forEach(t=>{
      const row=document.createElement('div'); row.className='row'; row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
      const label=document.createElement('div'); label.textContent = t.name; label.style.flex='1'; label.style.minWidth='0';
      const countSpan = document.createElement('span'); countSpan.className='meta-text small'; countSpan.textContent = (tagUsage[t.id]||0) + ' 次'; label.prepend(countSpan); label.style.cursor='pointer';
      const btnWrap=document.createElement('div'); btnWrap.style.display='flex'; btnWrap.style.gap='8px';
      const btnEdit=document.createElement('button'); btnEdit.className='btn small'; btnEdit.textContent='編輯'; const btnDel=document.createElement('button'); btnDel.className='btn small danger'; btnDel.textContent='刪除';
      btnEdit.addEventListener('click', ()=> openTagModal(t.id)); btnDel.addEventListener('click', ()=>{ if(silentConfirm('刪除此標籤？將從收藏移除該標籤')){ DB.deleteTag(t.id); render(); UI_FAV.refresh(); UI_SEARCH.refresh(); } });
      btnWrap.appendChild(btnEdit); btnWrap.appendChild(btnDel); row.appendChild(label); row.appendChild(btnWrap); el.tagList.appendChild(row);
    });
    let colArr = DB.listCols().slice(); const colUsage = {}; st.items.forEach(it=> (it.cols||[]).forEach(id=> colUsage[id] = (colUsage[id]||0)+1));
    if(tagSort==='name') colArr.sort((a,b)=> a.name.localeCompare(b.name,'zh-Hant')); else if(tagSort==='created_desc') colArr.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')); else if(tagSort==='created_asc') colArr.sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||'')); else if(tagSort==='usage_desc') colArr.sort((a,b)=> (colUsage[b.id]||0)-(colUsage[a.id]||0));
    colArr.filter(c=>c.name.toLowerCase().includes(el.colSearch.value.toLowerCase())).forEach(c=>{
      const row=document.createElement('div'); row.className='row'; row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
      const label=document.createElement('div'); label.textContent = c.name; label.style.flex='1'; label.style.minWidth='0';
      const countSpan = document.createElement('span'); countSpan.className='meta-text small'; countSpan.textContent = (colUsage[c.id]||0) + ' 次'; label.prepend(countSpan); label.style.cursor='pointer';
      const btnWrap=document.createElement('div'); btnWrap.style.display='flex'; btnWrap.style.gap='8px';
      const btnEdit=document.createElement('button'); btnEdit.className='btn small'; btnEdit.textContent='編輯'; const btnDel=document.createElement('button'); btnDel.className='btn small danger'; btnDel.textContent='刪除';
      btnEdit.addEventListener('click', ()=> openColModal(c.id)); btnDel.addEventListener('click', ()=>{ if(silentConfirm('刪除此合輯？將從收藏移除該合輯')){ DB.deleteCol(c.id); render(); UI_FAV.refresh(); UI_SEARCH.refresh(); } });
      btnWrap.appendChild(btnEdit); btnWrap.appendChild(btnDel); row.appendChild(label); row.appendChild(btnWrap); el.colList.appendChild(row);
    });
  }
  function openTagModal(id){ const tag = DB.listTags().find(t=>t.id===id); const box=document.createElement('div'); box.innerHTML = '<div class="form-row"><label>標籤名稱</label><input id="m-name" value="'+(tag.name||'').replace(/"/g,'&quot;')+'" /></div><div class="actions"><button id="m-save" class="btn primary">儲存</button></div>'; box.querySelector('#m-save').addEventListener('click', ()=>{ DB.renameTag(id, box.querySelector('#m-name').value); App.hideModal(); render(); UI_FAV.refresh(); UI_SEARCH.refresh(); }); App.showModal('編輯標籤', box); }
  
  function openColModal(id){ const col = DB.listCols().find(t=>t.id===id); const box=document.createElement('div');
    box.innerHTML = '<div class="form-row"><label>名稱</label><input id="e-col-name" class="input-compact" value="'+(col?col.name:'')+'" /></div>\
<div class="actions"><button id="e-save-col" class="btn">儲存</button></div>';
    box.querySelector('#e-save-col').addEventListener('click', ()=>{ const name = box.querySelector('#e-col-name').value||''; if(!name.trim()) return alert('名稱不能空'); DB.updateCol(id, { name: name.trim() }); render(); UI_FAV.refresh(); UI_SEARCH.refresh(); UI_MANAGE.render(); App.showModal('已儲存', document.createElement('div')); App.hideModal(); });
    App.showModal('編輯合輯', box);
  }
function init(){ el.tagSearch=qs('m-tag-search'); el.colSearch=qs('m-col-search'); el.tagList=qs('m-tag-list'); el.colList=qs('m-col-list'); el.tagNew=qs('m-tag-new'); el.colNew=qs('m-col-new'); el.tagAdd=qs('m-tag-add'); el.colAdd=qs('m-col-add'); el.tagAdd.addEventListener('click', ()=>{ if(DB.addTag(el.tagNew.value)){ el.tagNew.value=''; render(); } }); el.colAdd.addEventListener('click', ()=>{ if(DB.addCol(el.colNew.value)){ el.colNew.value=''; render(); } }); el.tagSearch.addEventListener('input', render); el.colSearch.addEventListener('input', render); const sort = document.getElementById('manage-sort'); if(sort) sort.addEventListener('change', render); render(); }
  return { init, render };
})();
