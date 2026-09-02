(() => {
  'use strict';

  const COVER_KEY = 'dmusic-covers-v1';
  const FALLBACK = 'assets/covers/fallback.svg';
  let coverTarget = null;
  let expanded = false;
  let touchStartX = 0;
  let touchStartY = 0;

  const $ = (s, root = document) => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function readCovers() {
    try { return JSON.parse(localStorage.getItem(COVER_KEY)) || { folders: {}, tracks: {} }; }
    catch { return { folders: {}, tracks: {} }; }
  }
  function writeCovers(data) {
    try { localStorage.setItem(COVER_KEY, JSON.stringify(data)); return true; }
    catch (e) { console.warn('Could not save cover:', e); return false; }
  }
  function getCover(type, id) {
    const data = readCovers();
    return data[type === 'folder' ? 'folders' : 'tracks']?.[id] || '';
  }
  function setCover(type, id, value) {
    const data = readCovers();
    const key = type === 'folder' ? 'folders' : 'tracks';
    if (value) data[key][id] = value; else delete data[key][id];
    return writeCovers(data);
  }

  function folderCover(folder) { return getCover('folder', folder.id) || folder.cover || FALLBACK; }
  function trackCover(track) { return getCover('track', track.id) || track.cover || track.folderCover || getCover('folder', track.folderId) || FALLBACK; }

  function applyCovers() {
    const folders = window.DMusicData?.folders || [];
    document.querySelectorAll('.folder-card').forEach(card => {
      const name = card.querySelector('span')?.textContent?.trim();
      const f = folders.find(x => x.name === name);
      if (f) { const img = card.querySelector('img'); if (img) img.src = folderCover(f); addCoverButton(card, 'folder', f.id, f.name); }
    });

    document.querySelectorAll('.track-row-wrap').forEach(row => {
      const id = row.querySelector('.track-row')?.dataset.trackId;
      if (!id) return;
      const t = (window.DMusicData?.folders || []).flatMap(f => (f.tracks || []).map(x => ({ ...x, folderId: f.id, folderCover: f.cover }))).find(x => x.id === id);
      if (!t) return;
      const img = row.querySelector('.track-row img'); if (img) img.src = trackCover(t);
      addCoverButton(row, 'track', t.id, t.title);
    });

    if (window.currentTrack) {
      const img = $('#nowCover');
      if (img) img.src = trackCover(window.currentTrack);
    }
  }

  function addCoverButton(host, type, id, label) {
    if (!host || host.querySelector('.cover-edit-btn')) return;
    const b = document.createElement('button');
    b.className = 'cover-edit-btn';
    b.type = 'button';
    b.title = `Change cover: ${label}`;
    b.setAttribute('aria-label', `Change cover for ${label}`);
    b.innerHTML = '<span>✦</span>';
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); openCoverModal(type, id, label); };
    host.appendChild(b);
  }

  function buildModal() {
    if ($('#coverModal')) return;
    const m = document.createElement('div');
    m.id = 'coverModal';
    m.className = 'cover-modal';
    m.hidden = true;
    m.innerHTML = `
      <div class="cover-modal-backdrop"></div>
      <div class="cover-modal-card" role="dialog" aria-modal="true" aria-labelledby="coverModalTitle">
        <button class="cover-modal-close" type="button" aria-label="Close">×</button>
        <div class="cover-modal-art"><img id="coverPreview" src="${FALLBACK}" alt=""></div>
        <div class="cover-modal-copy"><span class="section-kicker">COVER ART</span><h2 id="coverModalTitle">Change cover</h2><p id="coverModalLabel">Choose artwork for this item.</p></div>
        <div class="cover-modal-actions">
          <button id="chooseCoverBtn" class="cover-action primary" type="button">UPLOAD COVER</button>
          <button id="resetCoverBtn" class="cover-action" type="button">USE FALLBACK</button>
          <input id="coverFileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
        </div>
      </div>`;
    document.body.appendChild(m);
    $('.cover-modal-backdrop', m).onclick = closeCoverModal;
    $('.cover-modal-close', m).onclick = closeCoverModal;
    $('#chooseCoverBtn', m).onclick = () => $('#coverFileInput', m).click();
    $('#resetCoverBtn', m).onclick = () => { if (coverTarget) { setCover(coverTarget.type, coverTarget.id, ''); syncCoverTarget(); closeCoverModal(); } };
    $('#coverFileInput', m).onchange = async e => {
      const file = e.target.files?.[0]; e.target.value = '';
      if (!file || !coverTarget) return;
      try {
        const data = await optimizeImage(file);
        if (!setCover(coverTarget.type, coverTarget.id, data)) throw new Error('Storage is full.');
        syncCoverTarget(); closeCoverModal();
      } catch (err) { alert(`Could not save cover: ${err.message || 'Unknown error'}`); }
    };
  }

  function optimizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image.'));
        img.onload = () => {
          const max = 1000, scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
          const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', .84));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openCoverModal(type, id, label) {
    buildModal();
    coverTarget = { type, id, label };
    const src = getCover(type, id) || FALLBACK;
    $('#coverPreview').src = src;
    $('#coverModalTitle').textContent = type === 'folder' ? 'Folder cover' : 'Track cover';
    $('#coverModalLabel').textContent = label || 'Choose artwork for this item.';
    $('#coverModal').hidden = false;
    requestAnimationFrame(() => $('#coverModal').classList.add('open'));
  }
  function closeCoverModal() {
    const m = $('#coverModal'); if (!m) return;
    m.classList.remove('open');
    setTimeout(() => { m.hidden = true; }, 180);
    coverTarget = null;
  }
  function syncCoverTarget() {
    applyCovers();
    const img = $('#nowCover');
    if (window.currentTrack && img) img.src = trackCover(window.currentTrack);
  }

  function addMobileNav() {
    if ($('#mobileNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'mobileNav'; nav.className = 'mobile-nav'; nav.innerHTML = `
      <button data-view="library" class="mobile-nav-btn active"><span>⌂</span><small>Library</small></button>
      <button data-view="favorites" class="mobile-nav-btn"><span>♡</span><small>Favorites</small></button>
      <button data-view="recent" class="mobile-nav-btn"><span>◷</span><small>Recent</small></button>
      <button data-view="playlists" class="mobile-nav-btn"><span>≡</span><small>Playlists</small></button>`;
    document.body.appendChild(nav);
    nav.querySelectorAll('button').forEach(b => b.onclick = () => {
      const old = document.querySelector(`.nav-btn[data-view="${b.dataset.view}"]`);
      if (old) old.click();
      nav.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function addPlayerExtras() {
    const player = $('.player'); if (!player || $('#playerExpandBtn')) return;
    const expand = document.createElement('button'); expand.id = 'playerExpandBtn'; expand.className = 'player-expand-btn'; expand.type = 'button'; expand.innerHTML = '⌃'; expand.title = 'Expand player';
    expand.onclick = () => toggleExpanded();
    const art = $('.now-art-wrap', player);
    if (art) art.onclick = () => toggleExpanded();
    player.appendChild(expand);
  }
  function toggleExpanded(force) {
    expanded = typeof force === 'boolean' ? force : !expanded;
    $('.player')?.classList.toggle('expanded', expanded);
    const b = $('#playerExpandBtn'); if (b) b.textContent = expanded ? '⌄' : '⌃';
  }

  function syncPlayer() {
    const player = $('.player'); if (!player) return;
    const title = $('#nowTitle')?.textContent || 'Nothing playing';
    const artist = $('#nowArtist')?.textContent || 'Choose a track';
    const img = $('#nowCover');
    if (window.currentTrack && img) img.src = trackCover(window.currentTrack);
    player.classList.toggle('has-track', !!window.currentTrack);
    document.body.classList.toggle('dmusic-playing', !!window.currentTrack && !window.audio?.paused);
    const titleNode = $('.now b', player); if (titleNode) titleNode.textContent = title;
    const artistNode = $('.now small', player); if (artistNode) artistNode.textContent = artist;
  }

  function installSwipe() {
    const target = $('.player'); if (!target || target.dataset.swipeReady) return;
    target.dataset.swipeReady = '1';
    target.addEventListener('touchstart', e => { const t = e.changedTouches[0]; touchStartX = t.clientX; touchStartY = t.clientY; }, { passive: true });
    target.addEventListener('touchend', e => {
      const t = e.changedTouches[0], dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      if (dx < 0) $('#nextBtn')?.click(); else $('#prevBtn')?.click();
    }, { passive: true });
  }

  function patchRenderers() {
    if (window.__DMusicProRenderPatched) return;
    window.__DMusicProRenderPatched = true;
    const oldRender = window.render;
    if (typeof oldRender === 'function') window.render = function(...args) { const r = oldRender.apply(this,args); requestAnimationFrame(() => { applyCovers(); syncPlayer(); }); return r; };
    const oldPlay = window.playTrack;
    if (typeof oldPlay === 'function') window.playTrack = function(...args) { const r = oldPlay.apply(this,args); requestAnimationFrame(syncPlayer); return r; };
  }

  function observeUI() {
    const observer = new MutationObserver(() => { applyCovers(); syncPlayer(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.DMusicPro = { openCoverModal, closeCoverModal, getCover, setCover, applyCovers };

  window.addEventListener('load', () => {
    buildModal(); addMobileNav(); addPlayerExtras(); patchRenderers(); installSwipe();
    setTimeout(() => { applyCovers(); syncPlayer(); }, 300);
    setTimeout(observeUI, 500);
  });
})();
