(() => {
  const AUDIO = new Set(['mp3','m4a','flac','wav','ogg','oga','aac','opus','webm']);
  const IMAGE = new Set(['jpg','jpeg','png','webp']);
  let busy = false;

  const status = (text, error = false) => {
    const el = document.querySelector('#scanStatus');
    if (el) {
      el.textContent = text;
      el.classList.toggle('error', error);
    }
  };

  const ext = name => String(name || '').split('.').pop().toLowerCase();
  const isAudio = f => !!f && (AUDIO.has(ext(f.name)) || String(f.type || '').toLowerCase().startsWith('audio/'));
  const isImage = f => !!f && (IMAGE.has(ext(f.name)) || String(f.type || '').toLowerCase().startsWith('image/'));
  const pathOf = f => String(f?.webkitRelativePath || f?.name || '').replaceAll('\\', '/').split('/').filter(Boolean);
  const clean = name => String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/^\s*\[?\d{1,3}\]?\s*[-._)]\s*/, '')
    .replace(/^\s*\d{1,3}\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parse = (name, album) => {
    const base = clean(name);
    const p = base.split(/\s+-\s+|\s+–\s+|\s+—\s+/).map(x => x.trim()).filter(Boolean);
    let artist = 'Unknown artist', title = base;
    if (p.length >= 3) {
      artist = p[0];
      title = p.slice(2).join(' - ');
      album = p[1] || album;
    } else if (p.length === 2) {
      artist = p[0];
      title = p[1];
    }
    title = title.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    return { artist, title: title || base, album: album || 'Unknown album' };
  };
  const slug = v => String(v || 'music').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '') || 'music';
  const hash = v => {
    let h = 0;
    for (let i = 0; i < v.length; i++) h = ((h << 5) - h) + v.charCodeAt(i) | 0;
    return Math.abs(h).toString(36);
  };
  const year = v => {
    const m = String(v).match(/(?:19|20)\d{2}/);
    return m ? Number(m[0]) : '';
  };

  function makeRecord(file, relativePath, rootOverride) {
    const parts = String(relativePath || file.name).replaceAll('\\', '/').split('/').filter(Boolean);
    const name = parts.at(-1) || file.name || 'Unknown track';
    const dirs = parts.slice(0, -1);
    const root = rootOverride || dirs[0] || 'Singles';
    const album = dirs.at(-1) || root;
    const id = `local-${hash(`${parts.join('/')}|${file.size || 0}|${file.lastModified || 0}`)}`;
    const meta = parse(name, album);
    return {
      id,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      year: year(name),
      cover: 'assets/covers/fallback.svg',
      src: URL.createObjectURL(file),
      local: true,
      fileName: name,
      path: parts.join('/'),
      _file: file,
      _dirs: dirs,
      _root: root
    };
  }

  async function scanFixed(fileList, mode = 'folder') {
    if (busy) return;
    busy = true;
    try {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) throw new Error('No files were selected.');

      status(`Adding ${files.length.toLocaleString()} files…`);
      const audios = files.filter(isAudio);
      const images = files.filter(isImage);
      if (!audios.length) throw new Error(`No supported music files found. ${files.length.toLocaleString()} files were selected.`);

      const imageByDir = new Map();
      const imageByStem = new Map();
      for (const file of images) {
        const parts = pathOf(file);
        const name = parts.at(-1) || file.name;
        const dir = parts.slice(0, -1).join('/');
        const old = imageByDir.get(dir);
        const rank = n => {
          const x = String(n).replace(/\.[^.]+$/, '').toLowerCase();
          const p = ['cover', 'folder', 'album', 'artwork', 'front', 'front cover'];
          const i = p.indexOf(x);
          return i < 0 ? 50 : i;
        };
        if (!old || rank(name) < rank(old.name)) imageByDir.set(dir, file);
        imageByStem.set(`${dir}/${String(name).replace(/\.[^.]+$/, '').toLowerCase()}`, file);
      }

      const incomingFolders = new Map();
      const saved = [];

      for (const file of audios) {
        const parts = pathOf(file);
        const name = parts.at(-1) || file.name;
        const dirs = parts.slice(0, -1);
        const root = mode === 'files' ? 'Singles' : (dirs[0] || 'Music');
        const relativePath = mode === 'files' ? name : parts.join('/');
        const album = mode === 'files' ? 'Singles' : (dirs.at(-1) || root);
        const dir = mode === 'files' ? '' : dirs.join('/');
        const parentDir = mode === 'files' ? '' : dirs.slice(0, -1).join('/');
        const stem = String(name).replace(/\.[^.]+$/, '').toLowerCase();
        const specific = imageByStem.get(`${dir}/${stem}`);
        const coverFile = specific || imageByDir.get(dir) || imageByDir.get(parentDir);
        const track = makeRecord(file, relativePath, root);
        track.album = album;

        if (coverFile) {
          track.cover = URL.createObjectURL(coverFile);
          if (!window.DMusicScannerUrls) window.DMusicScannerUrls = [];
          window.DMusicScannerUrls.push(track.cover);
        }

        if (!window.DMusicScannerUrls) window.DMusicScannerUrls = [];
        window.DMusicScannerUrls.push(track.src);

        const folderId = `scan-${slug(root)}`;
        if (!incomingFolders.has(folderId)) {
          incomingFolders.set(folderId, {
            id: folderId,
            name: root,
            description: mode === 'files' ? 'Individual tracks' : 'Scanned from your music folder',
            cover: 'assets/covers/fallback.svg',
            tracks: []
          });
        }
        const folder = incomingFolders.get(folderId);
        if (folder.cover === 'assets/covers/fallback.svg' && coverFile) folder.cover = track.cover;
        folder.tracks.push(track);
        saved.push({ id: `audio-${track.id}`, file, path: relativePath, type: 'audio' });
      }

      // IMPORTANT: ADD to the existing library instead of replacing it.
      const existing = Array.isArray(window.DMusicData?.folders) ? window.DMusicData.folders : [];
      const merged = existing.map(folder => ({ ...folder, tracks: [...(folder.tracks || [])] }));
      const byId = new Map(merged.map(folder => [folder.id, folder]));
      let added = 0;

      for (const incoming of incomingFolders.values()) {
        let target = byId.get(incoming.id);
        if (!target) {
          target = { ...incoming, tracks: [] };
          merged.push(target);
          byId.set(target.id, target);
        }

        const known = new Set((target.tracks || []).map(t => t.id));
        for (const track of incoming.tracks) {
          if (!known.has(track.id)) {
            target.tracks.push(track);
            known.add(track.id);
            added++;
          } else {
            // The same track was selected twice; release the unused object URL.
            try { URL.revokeObjectURL(track.src); } catch {}
          }
        }

        if ((!target.cover || target.cover === 'assets/covers/fallback.svg') && incoming.cover) {
          target.cover = incoming.cover;
        }
      }

      try {
        if (typeof putScannedFiles === 'function') await putScannedFiles(saved);
      } catch (e) {
        console.warn('DMusic storage warning:', e);
      }

      window.DMusicData.folders = merged;
      window.DMusicData.scanned = true;
      window.DMusicData.lastScan = Date.now();
      if (typeof setNav === 'function') setNav('library');
      if (typeof render === 'function') render();

      const folderCount = merged.length;
      const label = mode === 'files' ? 'tracks added' : 'tracks added from folder';
      status(`${added.toLocaleString()} ${label} • ${folderCount} folders in library`);
    } catch (e) {
      console.error('DMusic scanner:', e);
      status(`Add failed: ${e?.message || 'Unknown error'}`, true);
    } finally {
      busy = false;
    }
  }

  window.DMusicFixedScan = scanFixed;

  window.addEventListener('load', () => {
    const folderBtn = document.querySelector('#scanBtn');
    const folderInput = document.querySelector('#musicFolderInput');
    const filesBtn = document.querySelector('#addFilesBtn');
    const filesInput = document.querySelector('#musicFilesInput');
    if (!folderBtn || !folderInput || !filesBtn || !filesInput) return;

    folderBtn.onclick = () => {
      status('Choose a music folder to add…');
      folderInput.click();
    };
    folderInput.onchange = e => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length) scanFixed(files, 'folder');
      else status('No folder selected.', true);
      e.target.value = '';
    };

    filesBtn.onclick = () => {
      status('Choose one or more music files to add…');
      filesInput.click();
    };
    filesInput.onchange = e => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length) scanFixed(files, 'files');
      else status('No files selected.', true);
      e.target.value = '';
    };
  });
})();
