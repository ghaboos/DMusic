(() => {
  const AUDIO = new Set(['mp3','m4a','flac','wav','ogg','oga','aac','opus','webm']);
  const IMAGE = new Set(['jpg','jpeg','png','webp']);
  let busy = false;
  const FALLBACK = 'assets/covers/fallback.svg';
  const status = (text, error = false) => { const el = document.querySelector('#scanStatus'); if (el) { el.textContent = text; el.classList.toggle('error', error); } };
  const ext = name => String(name || '').split('.').pop().toLowerCase();
  const isAudio = f => !!f && (AUDIO.has(ext(f.name)) || String(f.type || '').toLowerCase().startsWith('audio/'));
  const isImage = f => !!f && (IMAGE.has(ext(f.name)) || String(f.type || '').toLowerCase().startsWith('image/'));
  const pathOf = f => String(f?.webkitRelativePath || f?.name || '').replaceAll('\\', '/').split('/').filter(Boolean);
  const clean = name => String(name || '').replace(/\.[^.]+$/, '').replace(/^\s*\[?\d{1,3}\]?\s*[-._)]\s*/, '').replace(/^\s*\d{1,3}\s+/, '').replace(/\s+/g, ' ').trim();
  const parse = (name, album) => { const base = clean(name), p = base.split(/\s+-\s+|\s+–\s+|\s+—\s+/).map(x => x.trim()).filter(Boolean); let artist = 'Unknown artist', title = base; if (p.length >= 3) { artist = p[0]; album = p[1] || album; title = p.slice(2).join(' - '); } else if (p.length === 2) { artist = p[0]; title = p[1]; } title = title.replace(/\s*\[[^\]]+\]\s*$/, '').trim(); return { artist, title: title || base, album: album || 'Unknown album' }; };
  const slug = v => String(v || 'music').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '') || 'music';
  const hash = v => { let h = 0; for (let i = 0; i < v.length; i++) h = ((h << 5) - h) + v.charCodeAt(i) | 0; return Math.abs(h).toString(36); };
  const year = v => { const m = String(v).match(/(?:19|20)\d{2}/); return m ? Number(m[0]) : ''; };
  const rememberUrl = url => { if (!window.DMusicScannerUrls) window.DMusicScannerUrls = []; window.DMusicScannerUrls.push(url); };

  function normalizeRestoredLibrary() {
    const data = window.DMusicData;
    if (!data) return;
    const source = Array.isArray(data.folders) ? data.folders : [];
    const result = [];
    const byId = new Map();
    const ensure = (id, name, description, type) => {
      let f = byId.get(id);
      if (!f) { f = { id, name, description, cover: FALLBACK, tracks: [], folderType: type }; byId.set(id, f); result.push(f); }
      return f;
    };
    for (const f of source) {
      // Old versions could create scan-singles. Merge that data into the real Singles folder.
      const isSingles = f.id === 'singles' || f.id === 'scan-singles' || String(f.name || '').trim().toLowerCase() === 'singles';
      const target = isSingles ? ensure('singles', 'Singles', 'Individual tracks', 'singles') : f;
      if (isSingles && target !== f) {
        const known = new Set(target.tracks.map(t => t.id));
        for (const t of (f.tracks || [])) if (!known.has(t.id)) { target.tracks.push(t); known.add(t.id); }
        if ((!target.cover || target.cover === FALLBACK) && f.cover) target.cover = f.cover;
        continue;
      }
      if (!byId.has(f.id)) { byId.set(f.id, f); result.push(f); }
      else {
        const targetExisting = byId.get(f.id), known = new Set(targetExisting.tracks || [] .map(t => t.id));
        for (const t of (f.tracks || [])) if (!known.has(t.id)) targetExisting.tracks.push(t);
      }
    }
    if (!byId.has('singles')) ensure('singles', 'Singles', 'Individual tracks', 'singles');
    data.folders = result;
  }

  async function scanFixed(fileList, mode = 'folder') {
    if (busy) return; busy = true;
    try {
      const files = Array.from(fileList || []).filter(Boolean); if (!files.length) throw new Error('No files were selected.');
      status(`Adding ${files.length.toLocaleString()} files…`);
      const audios = files.filter(isAudio), images = files.filter(isImage);
      if (!audios.length) throw new Error(`No supported music files found. ${files.length.toLocaleString()} files were selected.`);
      const imageByDir = new Map(), imageByStem = new Map();
      for (const file of images) {
        const p = pathOf(file), name = p.at(-1) || file.name, dir = p.slice(0,-1).join('/');
        const old = imageByDir.get(dir);
        const rank = n => { const x = String(n).replace(/\.[^.]+$/,'').toLowerCase(); const a = ['cover','folder','album','artwork','front','front cover']; const i = a.indexOf(x); return i < 0 ? 50 : i; };
        if (!old || rank(name) < rank(old.name)) imageByDir.set(dir,file);
        imageByStem.set(`${dir}/${String(name).replace(/\.[^.]+$/,'').toLowerCase()}`,file);
      }
      const incoming = new Map(), saved = [];
      for (const file of audios) {
        const parts = pathOf(file), name = parts.at(-1) || file.name, dirs = parts.slice(0,-1);
        const root = mode === 'files' ? 'Singles' : (parts[0] || 'Music');
        const folderId = mode === 'files' ? 'singles' : `scan-${slug(root)}`;
        const relativePath = mode === 'files' ? `Singles/${name}` : parts.join('/');
        const album = mode === 'files' ? 'Singles' : (dirs.at(-1) || root);
        const dir = mode === 'files' ? '' : dirs.join('/');
        const parent = mode === 'files' ? '' : dirs.slice(0,-1).join('/');
        const stem = String(name).replace(/\.[^.]+$/,'').toLowerCase();
        const coverFile = imageByStem.get(`${dir}/${stem}`) || imageByDir.get(dir) || imageByDir.get(parent);
        const id = `local-${hash(`${relativePath}|${file.size || 0}|${file.lastModified || 0}`)}`;
        const meta = parse(name, album);
        const track = { id, title: meta.title, artist: meta.artist, album: meta.album, year: year(name), cover: FALLBACK, src: URL.createObjectURL(file), local: true, fileName: name, path: relativePath, folderType: mode === 'files' ? 'singles' : 'folder' };
        rememberUrl(track.src);
        if (coverFile) { track.cover = URL.createObjectURL(coverFile); rememberUrl(track.cover); }
        if (!incoming.has(folderId)) incoming.set(folderId, { id: folderId, name: root, description: mode === 'files' ? 'Individual tracks' : 'Scanned from your music folder', cover: FALLBACK, tracks: [], folderType: mode === 'files' ? 'singles' : 'folder' });
        const folder = incoming.get(folderId);
        if (folder.cover === FALLBACK && coverFile) folder.cover = track.cover;
        folder.tracks.push(track);
        saved.push({ id: `audio-${id}`, file, path: relativePath, type: 'audio', folderId });
      }
      const existing = Array.isArray(window.DMusicData?.folders) ? window.DMusicData.folders : [];
      const merged = existing.map(f => ({ ...f, tracks: [...(f.tracks || [])] }));
      const byId = new Map(merged.map(f => [f.id, f]));
      let added = 0;
      for (const inc of incoming.values()) {
        let target = byId.get(inc.id);
        if (!target) { target = { ...inc, tracks: [] }; merged.push(target); byId.set(target.id,target); }
        const known = new Set((target.tracks || []).map(t => t.id));
        for (const t of inc.tracks) {
          if (!known.has(t.id)) { target.tracks.push(t); known.add(t.id); added++; }
          else { try { URL.revokeObjectURL(t.src); } catch {} if (t.cover && t.cover !== FALLBACK) try { URL.revokeObjectURL(t.cover); } catch {} }
        }
        if ((!target.cover || target.cover === FALLBACK) && inc.cover) target.cover = inc.cover;
        target.folderType = inc.folderType || target.folderType || 'folder';
      }
      window.DMusicData.folders = merged;
      normalizeRestoredLibrary();
      window.DMusicData.scanned = true;
      window.DMusicData.lastScan = Date.now();
      if (typeof setNav === 'function') setNav('library');
      if (typeof render === 'function') render();
      status(`${added.toLocaleString()} ${mode === 'files' ? 'tracks' : 'tracks from folder'} added • ${window.DMusicData.folders.length} folders in library`);
    } catch (e) { console.error('DMusic scanner:', e); status(`Add failed: ${e?.message || 'Unknown error'}`, true); } finally { busy = false; }
  }

  window.DMusicFixedScan = scanFixed;
  window.DMusicNormalizeLibrary = normalizeRestoredLibrary;

  window.addEventListener('load', () => {
    const oldFolder = document.querySelector('#musicFolderInput'), folderBtn = document.querySelector('#scanBtn'), oldFiles = document.querySelector('#musicFilesInput'), filesBtn = document.querySelector('#addFilesBtn');
    if (!oldFolder || !folderBtn || !oldFiles || !filesBtn) return;
    const folderInput = oldFolder.cloneNode(true); oldFolder.replaceWith(folderInput);
    const filesInput = oldFiles.cloneNode(true); oldFiles.replaceWith(filesInput);
    folderBtn.onclick = () => { status('Choose a music folder to add…'); folderInput.click(); };
    folderInput.onchange = e => { const files = Array.from(e.target.files || []); if (files.length) scanFixed(files, 'folder'); e.target.value = ''; };
    filesBtn.onclick = () => { status('Choose one or more music files to add…'); filesInput.click(); };
    filesInput.onchange = e => { const files = Array.from(e.target.files || []); if (files.length) scanFixed(files, 'files'); e.target.value = ''; };
    setTimeout(() => { normalizeRestoredLibrary(); if (typeof render === 'function') render(); }, 250);
  });
})();