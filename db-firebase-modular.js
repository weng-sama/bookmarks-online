
/*
  js/db-firebase-modular.js
  ES module adapter using Firebase modular SDK (CDN).
  This module uses top-level await to initialize Firebase and sign in anonymously,
  then it constructs window.DB with the familiar API used by the app.
  Place <script type="module" src="js/db-firebase-modular.js"></script> in index.html
  AFTER setting window.__FIREBASE_CONFIG.
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, addDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = window.__FIREBASE_CONFIG || null;

function lsGet(key='bookmark_data_v25'){ try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch(e){ return {}; } }
function lsSet(v, key='bookmark_data_v25'){ try { localStorage.setItem(key, JSON.stringify(v)); } catch(e){} }

if(!firebaseConfig){
  console.warn('No window.__FIREBASE_CONFIG found — falling back to localStorage adapter.');
  const state = lsGet().items ? lsGet() : { items: [], tags: [], cols: [], history: [], colAssignments: [] };
  window.DB = (function(){
    function getState(){ return state; }
    function saveState(){ lsSet(state); return Promise.resolve(); }
    function listTags(){ return Promise.resolve(state.tags || []); }
    function listCols(){ return Promise.resolve(state.cols || []); }
    function listItems(){ return Promise.resolve(state.items || []); }
    function addItem(it){ it.id = it.id || ('ls_'+Math.random().toString(36).slice(2)+Date.now().toString(36)); it.createdAt = it.createdAt || new Date().toISOString(); state.items = state.items || []; state.items.push(it); saveState(); return Promise.resolve(it); }
    function updateItem(id, patch){ const idx = (state.items||[]).findIndex(x=>x.id===id); if(idx!==-1){ Object.assign(state.items[idx], patch); saveState(); return Promise.resolve(state.items[idx]); } return Promise.reject('not found'); }
    function deleteItem(id){ state.items = (state.items||[]).filter(x=>x.id!==id); saveState(); return Promise.resolve(); }
    function listHistory(){ return Promise.resolve(state.history || []); }
    function pushHistory(h){ state.history = state.history || []; state.history.unshift(h); if(state.history.length>200) state.history.pop(); saveState(); return Promise.resolve(); }
    return { init: async ()=>state, getState, saveState, listItems, listTags, listCols, addItem, updateItem, deleteItem, listHistory, pushHistory };
  })();
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let user = auth.currentUser;
  try {
    if(!user){
      await signInAnonymously(auth);
      user = await new Promise((resolve) => {
        const off = onAuthStateChanged(auth, (u) => {
          off();
          resolve(u);
        });
      });
    }
  } catch(e){
    console.warn('Anonymous sign-in failed or blocked:', e);
  }
  const uid = user ? user.uid : null;

  function colRef(colName){
    if(!uid) throw new Error('No uid');
    return collection(db, `users/${uid}/${colName}`);
  }

  async function buildStateFromFirestore(){
    const st = { items: [], tags: [], cols: [], history: [], colAssignments: [] };
    try {
      const [itemsSnap, tagsSnap, colsSnap, histSnap, assignSnap] = await Promise.all([
        getDocs(colRef('items')),
        getDocs(colRef('tags')),
        getDocs(colRef('cols')),
        getDocs(query(colRef('history'), orderBy('ts', 'desc'), limit(500))),
        getDocs(colRef('assignments'))
      ]);
      itemsSnap.forEach(d => st.items.push(Object.assign({id: d.id}, d.data())));
      tagsSnap.forEach(d => st.tags.push(Object.assign({id: d.id}, d.data())));
      colsSnap.forEach(d => st.cols.push(Object.assign({id: d.id}, d.data())));
      histSnap.forEach(d => st.history.push(d.data()));
      assignSnap.forEach(d => st.colAssignments.push(d.data()));
    } catch(e){
      console.warn('Error reading initial Firestore state', e);
    }
    return st;
  }

  let stateCache = null;

  window.DB = (function(){
    async function init(){
      if(stateCache) return stateCache;
      stateCache = await buildStateFromFirestore();
      return stateCache;
    }
    function getState(){ return stateCache || lsGet(); }

    async function saveState(){
      if(!uid) return Promise.reject('no uid');
      const items = getState().items || [];
      for(const it of items){
        await setDoc(doc(db, `users/${uid}/items/${it.id}`), Object.assign({}, it));
      }
      const tags = getState().tags || [];
      for(const t of tags){
        const id = t.id || t.name;
        await setDoc(doc(db, `users/${uid}/tags/${id}`), Object.assign({}, t));
      }
      const cols = getState().cols || [];
      for(const c of cols){
        const id = c.id || c.name;
        await setDoc(doc(db, `users/${uid}/cols/${id}`), Object.assign({}, c));
      }
      return Promise.resolve();
    }

    async function listItems(){
      if(!stateCache) await init();
      return getState().items || [];
    }
    async function listTags(){
      if(!stateCache) await init();
      return getState().tags || [];
    }
    async function listCols(){
      if(!stateCache) await init();
      return getState().cols || [];
    }
    async function addItem(it){
      if(!stateCache) await init();
      it.id = it.id || ('fb_'+Math.random().toString(36).slice(2)+Date.now().toString(36));
      it.createdAt = it.createdAt || new Date().toISOString();
      stateCache.items = stateCache.items || [];
      stateCache.items.push(it);
      try{
        await setDoc(doc(db, `users/${uid}/items/${it.id}`), it);
      } catch(e){ console.warn('addItem firestore write failed', e); }
      return it;
    }
    async function updateItem(id, patch){
      if(!stateCache) await init();
      const idx = (stateCache.items||[]).findIndex(x=>x.id===id);
      if(idx===-1) throw 'not found';
      Object.assign(stateCache.items[idx], patch);
      try{
        await setDoc(doc(db, `users/${uid}/items/${id}`), stateCache.items[idx], {merge: true});
      } catch(e){ console.warn('updateItem firestore write failed', e); }
      return stateCache.items[idx];
    }
    async function deleteItem(id){
      if(!stateCache) await init();
      stateCache.items = (stateCache.items||[]).filter(x=>x.id!==id);
      try{
        await deleteDoc(doc(db, `users/${uid}/items/${id}`));
      } catch(e){ console.warn('deleteItem firestore delete failed', e); }
      return;
    }
    async function listHistory(){ if(!stateCache) await init(); return stateCache.history || []; }
    async function pushHistory(h){
      if(!stateCache) await init();
      stateCache.history = stateCache.history || [];
      stateCache.history.unshift(h);
      try{
        await addDoc(colRef('history'), Object.assign({ts: new Date().toISOString()}, h));
      } catch(e){ console.warn('pushHistory write failed', e); }
      return;
    }

    return { init, getState, saveState, listItems, listTags, listCols, addItem, updateItem, deleteItem, listHistory, pushHistory };
  })();

  try {
    await window.DB.init();
    console.log('DB (modular) initialized');
  } catch(e){
    console.warn('DB.init() failed during module load', e);
  }
}
