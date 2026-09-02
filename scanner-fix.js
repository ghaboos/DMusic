(() => {
  const AUDIO = new Set(['mp3','m4a','flac','wav','ogg','oga','aac','opus','webm']);
  const IMAGE = new Set(['jpg','jpeg','png','webp']);
  let busy = false;

  const status = (text, error = false) => {
    const el = document.querySelector('#scanStatus');
    if (el) { el.textContent = text; el.classList.toggle('error', error); }
  };

  const ext = (name) => String(name || '').split('.').pop().toLowerCase();
  const isAudio = f => !!f && (AUDIO.has(ext(f.name)) || String(f.type || '').toLowerCase().startsWith('audio/'));
  const isImage = f => !!f && (IMAGE.has(ext(f.name)) || String(f.type || '').toLowerCase().startsWith('image/'));
  const pathOf = f => String(f?.webkitRelativePath || f?.name || '').replaceAll('\\','/').split('/').filter(Boolean);
  const clean = name => String(name || '').replace(/\.[^.]+$/,'').replace(/^\s*\[?\d{1,3}\]?\s*[-._)]\s*/,'').replace(/^\s*\d{1,3}\s+/,'').replace(/\s+/g,' ').trim(); 
  const parse = (name, album) => {
    const base = clean(name);
    const p = base.split(/\s+-\s+|\s+–\s+|\s+—\s+/).map(x=>x.trim()).filter(Boolean);
    let artist='Unknown artist', title=base;
    if (p.length >= 3) { artist=p[0]; title=p.slice(2).join(' - '); album=p[1] || album; }
    else if (p.length === 2) { artist=p[0]; title=p[1]; }
    title = title.replace(/\s*\[[^\]]+\]\s*$/,'').trim();
    return {artist, title:title || base, album:album || 'Unknown album'};
  };
  const slug = v => String(v || 'music').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-|-$/g,'') || 'music';
  const hash = v => { let h=0; for(let i=0;i<v.length;i++) h=((h<<5)-h)+v.charCodeAt(i)|0; return Math.abs(h).toString(36); };
  const year = v => { const m=String(v).match(/(?:19|20)\d{2}/); return m ? Number(m[0]) : ''; };

  async function scanFixed(fileList) {
    if (busy) return;
    busy = true;
    try {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) throw new Error('No files were returned by the folder picker.');
      status(`Scanning ${files.length.toLocaleString()} files…`);

      const audios = files.filter(isAudio);
      const images = files.filter(isImage);
      if (!audios.length) throw new Error(`No supported music files found. ${files.length.toLocaleString()} files were selected.`);

      const imageByDir = new Map();
      const imageByStem = new Map();
      for (const file of images) {
        const parts = pathOf(file), name = parts.at(-1) || file.name, dir = parts.slice(0,-1).join('/');
        const old = imageByDir.get(dir);
        const rank = n => { const x=String(n).replace(/\.[^.]+$/,'').toLowerCase(); const p=['cover','folder','album','artwork','front','front cover']; const i=p.indexOf(x); return i<0?50:i; };
        if (!old || rank(name) < rank(old.name)) imageByDir.set(dir,file);
        imageByStem.set(`${dir}/${String(name).replace(/\.[^.]+$/,'').toLowerCase()}`,file);
      }

      const folders = new Map();
      const saved = [];
      for (const file of audios) {
        const parts = pathOf(file);
        const name = parts.at(-1) || file.name || 'Unknown track';
        const dirs = parts.slice(0,-1);
        const root = dirs[0] || 'Music';
        const folderId = `scan-${slug(root)}`;
        const album = dirs.at(-1) || root;
        const dir = dirs.join('/');
        const parentDir = dirs.slice(0,-1).join('/');
        const key = `${dir}/${clean(name).toLowerCase()}`;
        const coverFile = imageByStem.get(key) || imageByDir.get(dir) || imageByDir.get(parentDir);
        const id = `local-${hash(`${parts.join('/')}|${file.size||0}|${file.lastModified||0}`)}`;

        if (!folders.has(folderId)) folders.set(folderId,{id:folderId,name:root,description:'Scanned from your music folder',cover:'assets/covers/fallback.svg',tracks:[]});
        const folder = folders.get(folderId);
        let cover = 'assets/covers/fallback.svg';
        if (coverFile) {
          cover = URL.createObjectURL(coverFile);
          if (folder.cover === 'assets/covers/fallback.svg') folder.cover = cover;
        }
        const src = URL.createObjectURL(file);
        const meta = parse(name, album);
        folder.tracks.push({id,title:meta.title,artist:meta.artist,album:meta.album,year:year(name),cover,src,local:true,fileName:name,path:parts.join('/')});
        saved.push({id:`audio-${id}`,file,path:parts.join('/'),type:'audio'});
      }

      // Save files when possible, but never let storage failure block the scan.
      try {
        if (typeof putScannedFiles === 'function') await putScannedFiles(saved);
      } catch (e) { console.warn('DMusic storage warning:', e); }

      window.DMusicData.folders = [...folders.values()];
      window.DMusicData.scanned = true;
      status(`${audios.length.toLocaleString()} tracks • ${folders.size} folders scanned`);
      if (typeof setNav === 'function') setNav('library');
      if (typeof render === 'function') render();
    } catch (e) {
      console.error('DMusic scanner fix:', e);
      status(`Scan failed: ${e?.message || 'Unknown error'}`, true);
    } finally { busy = false; }
  }

  window.DMusicFixedScan = scanFixed;
  window.addEventListener('load', () => {
    const btn = document.querySelector('#scanBtn');
    const input = document.querySelector('#musicFolderInput');
    if (!btn || !input) return;
    btn.onclick = () => { status('Choose your music folder…'); input.click(); };
    input.onchange = e => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length) scanFixed(files); else status('No folder selected.', true);
      e.target.value = '';
    };
  });
})();
