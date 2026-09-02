const audio = new Audio();
const STORAGE_KEY = "dmusic-state-v4";
const DB_NAME = "DMusicLibrary";
const DB_VERSION = 1;
const FALLBACK_COVER = "assets/covers/fallback.svg";
const AUDIO_EXTENSIONS = new Set(["mp3","m4a","flac","wav","ogg","oga","aac","opus","webm"]);
const IMAGE_EXTENSIONS = new Set(["jpg","jpeg","png","webp"]);

let state = loadState();
let currentTrack = null, currentIndex = -1, visibleTracks = [], activeFolderId = state.activeFolderId || "all";
let queue = [], favorites = new Set(state.favorites || []), shuffle = !!state.shuffle, repeat = state.repeat || "off";
let view = "library", objectUrls = [], scanBusy = false;

const $ = s => document.querySelector(s);
const ICONS = {
  shuffle:'<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 7h2c5 0 6 10 12 10h3M16 21h5v-5M4 17h2c2.2 0 3.5-1.3 4.4-2.7M13.6 9.7C14.5 8.3 15.8 7 18 7h3"/></svg>',
  prev:'<svg viewBox="0 0 24 24"><path d="M6 5v14M18 6 9 12l9 6V6z"/></svg>',
  next:'<svg viewBox="0 0 24 24"><path d="M18 5v14M6 6l9 6-9 6V6z"/></svg>',
  repeat:'<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  queue:'<svg viewBox="0 0 24 24"><path d="M4 6h12M4 11h12M4 16h7M15 16l2.5 2.5L21 15"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.4-8.8 10.1-8.8 10.1S3.2 14.2 3.2 8.8A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.6Z"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>'
};

function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{};}catch{return {};}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({favorites:[...favorites],shuffle,repeat,volume:audio.volume,currentTrackId:currentTrack?.id||null,activeFolderId,queue:queue.map(t=>t.id),history:state.history||{},playCounts:state.playCounts||{},positions:state.positions||{},playlists:state.playlists||[]}));}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function slug(v){return String(v).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,'-').replace(/^-|-$/g,'');}
function hash(v){let h=0;for(let i=0;i<v.length;i++)h=((h<<5)-h)+v.charCodeAt(i)|0;return Math.abs(h).toString(36);}
function formatTime(s){if(!Number.isFinite(s)||s<0)return'0:00';return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
function resolveCover(t){return t?.cover||t?.folderCover||FALLBACK_COVER;}
function fallback(img){if(img)img.onerror=()=>{img.onerror=null;img.src=FALLBACK_COVER;};}

function allTracks(){return (window.DMusicData?.folders||[]).flatMap(f=>(f.tracks||[]).map(t=>({...t,folderId:f.id,folderName:f.name,folderCover:f.cover})));}
function findTrack(id){return allTracks().find(t=>t.id===id);}
function stat(id,key){return Number((state[key]||{})[id]||0);}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function putScannedFiles(files){try{const db=await openDB();const tx=db.transaction('files','readwrite');const store=tx.objectStore('files');for(const f of files)store.put({id:f.id,file:f.file});return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}catch(e){console.warn('IndexedDB unavailable',e);}}
async function getScannedFiles(){try{const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction('files').objectStore('files').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}catch{return[];}}

function setStatus(text,error=false){const el=$('#scanStatus');if(el){el.textContent=text;el.classList.toggle('error',error);}}
function normalizeName(v){return String(v||'').replace(/\.[^.]+$/,'').replace(/^\s*\[?\d{1,3}\]?\s*[-._)]\s*/,'').replace(/^\s*\d{1,3}\s+/,'').replace(/\s+/g,' ').trim();}
function parseFilename(name,parent,albumHint){
  const base=normalizeName(name), parts=base.split(/\s+-\s+|\s+–\s+|\s+—\s+/).map(x=>x.trim()).filter(Boolean);
  let artist='Unknown artist', album=albumHint||parent||'Unknown album', title=base;
  if(parts.length>=3){artist=parts[0];album=parts[1]||album;title=parts.slice(2).join(' - ');}
  else if(parts.length===2){artist=parts[0];title=parts[1];}
  const feat=artist.match(/^(.+?)\s+(?:feat\.?|ft\.?|with)\s+(.+)$/i);if(feat)artist=feat[1].trim()+` feat. ${feat[2].trim()}`;
  title=title.replace(/\s*\[[^\]]+\]\s*$/,'').trim();
  return {artist,album,title:title||base};
}
function relative(file){const p=(file.webkitRelativePath||file.name).split(/[\\/]/).filter(Boolean);return {root:p[0]||'Music',dirs:p.slice(1,-1),name:p.at(-1)||file.name};}
function isAudio(f){const e=f.name.split('.').pop()?.toLowerCase();return AUDIO_EXTENSIONS.has(e)||(f.type||'').startsWith('audio/');}
function isImage(f){const e=f.name.split('.').pop()?.toLowerCase();return IMAGE_EXTENSIONS.has(e)||(f.type||'').startsWith('image/');}
function imageRank(name){const n=name.replace(/\.[^.]+$/,'').toLowerCase();const p=['cover','folder','album','artwork','front','front cover'];const i=p.indexOf(n);return i<0?50:i;}

async function scanFiles(fileList){
  if(scanBusy)return;scanBusy=true;setStatus('Scanning your library…');
  objectUrls.forEach(u=>URL.revokeObjectURL(u));objectUrls=[];
  const files=[...fileList], audios=files.filter(isAudio), images=files.filter(isImage);
  if(!audios.length){setStatus('No supported audio files found.',true);scanBusy=false;return;}
  const imageMap=new Map();images.forEach(f=>{const r=relative(f),key=r.dirs.join('/');const old=imageMap.get(key);if(!old||imageRank(f.name)<imageRank(old.name))imageMap.set(key,f);});
  const folders=new Map(), persist=[];
  audios.forEach((file,i)=>{
    const r=relative(file), top=r.dirs[0]||r.root||'Music', folderId='scan-'+slug(top), albumHint=r.dirs.at(-1)||top;
    const parsed=parseFilename(r.name,albumHint,albumHint), dir=r.dirs.join('/');
    const coverFile=imageMap.get(dir)||imageMap.get(r.dirs.slice(0,-1).join('/'));
    const id='local-'+hash((file.webkitRelativePath||file.name)+'|'+file.size+'|'+file.lastModified);
    if(!folders.has(folderId))folders.set(folderId,{id:folderId,name:top,description:'Scanned from your music folder',cover:FALLBACK_COVER,tracks:[]});
    const f=folders.get(folderId);let cover=FALLBACK_COVER;
    if(coverFile){cover=URL.createObjectURL(coverFile);objectUrls.push(cover);}
    if(f.cover===FALLBACK_COVER&&cover!==FALLBACK_COVER)f.cover=cover;
    const src=URL.createObjectURL(file);objectUrls.push(src);
    f.tracks.push({id,title:parsed.title,artist:parsed.artist,album:parsed.album,year:extractYear(r.name)||'',cover,src,local:true,fileName:r.name,path:file.webkitRelativePath||file.name});
    persist.push({id,file});
  });
  await putScannedFiles(persist);
  window.DMusicData.folders=[...folders.values()];window.DMusicData.scanned=true;
  state.scanSignature={count:audios.length,updated:Date.now()};saveState();
  setStatus(`${audios.length.toLocaleString()} tracks • ${folders.size} folders scanned`);
  activeFolderId='all';view='library';setNav('library');render();scanBusy=false;
}
function extractYear(v){const m=String(v).match(/(?:19|20)\d{2}/);return m?Number(m[0]):'';}

async function restoreScanned(){const saved=await getScannedFiles();if(!saved.length)return;const files=saved.map(x=>x.file);const fake=new DataTransfer();files.forEach(f=>fake.items.add(f));for(let i=0;i<files.length;i++){Object.defineProperty(files[i],'webkitRelativePath',{value:saved[i].file.webkitRelativePath||saved[i].file.name});}await scanFiles(files);}

function setNav(name){document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));}
function baseTracksForView(){const all=allTracks();if(view==='favorites')return all.filter(t=>favorites.has(t.id));if(view==='recent')return all.filter(t=>stat(t.id,'history')).sort((a,b)=>stat(b.id,'history')-stat(a.id,'history'));if(view==='most')return all.filter(t=>stat(t.id,'playCounts')).sort((a,b)=>stat(b.id,'playCounts')-stat(a.id,'playCounts'));if(view==='continue')return all.filter(t=>stat(t.id,'positions')>2&&stat(t.id,'positions')<1e9).sort((a,b)=>stat(b.id,'positions')-stat(a.id,'positions'));return activeFolderId==='all'?all:(window.DMusicData?.folders||[]).find(f=>f.id===activeFolderId)?.tracks.map(t=>({...t,folderId:activeFolderId,folderName:(window.DMusicData.folders.find(f=>f.id===activeFolderId)||{}).name,folderCover:(window.DMusicData.folders.find(f=>f.id===activeFolderId)||{}).cover}))||[];}
function applySearchSortFilter(items){const q=($('#searchInput')?.value||'').trim().toLowerCase(),filter=$('#filterSelect')?.value||'all',sort=$('#sortSelect')?.value||'name';let out=items.filter(t=>`${t.title} ${t.artist||''} ${t.album||''} ${t.year||''} ${t.folderName||''}`.toLowerCase().includes(q));if(filter==='favorites')out=out.filter(t=>favorites.has(t.id));if(filter==='played')out=out.filter(t=>stat(t.id,'playCounts')>0);if(filter==='unplayed')out=out.filter(t=>!stat(t.id,'playCounts'));if(filter==='year')out=out.filter(t=>t.year);out.sort((a,b)=>{if(sort==='artist')return (a.artist||'').localeCompare(b.artist||'');if(sort==='album')return (a.album||'').localeCompare(b.album||'');if(sort==='year')return Number(b.year||0)-Number(a.year||0);if(sort==='recent')return stat(b.id,'history')-stat(a.id,'history');if(sort==='plays')return stat(b.id,'playCounts')-stat(a.id,'playCounts');return (a.title||'').localeCompare(b.title||'');});return out;}

function renderLibrary(){const grid=$('#library');if(!grid)return;const folders=window.DMusicData?.folders||[];$('#folderCount').textContent=folders.length;grid.innerHTML='';folders.forEach(f=>{const b=document.createElement('button');b.className='folder-card'+(f.id===activeFolderId?' selected':'');b.innerHTML=`<img src="${esc(f.cover||FALLBACK_COVER)}" alt=""><span>${esc(f.name)}</span><small>${f.tracks?.length||0} tracks</small>`;fallback(b.querySelector('img'));b.onclick=()=>{view='library';activeFolderId=f.id;setNav('library');renderTracks();};grid.appendChild(b);});}
function renderTracks(){const list=$('#tracks');if(!list)return;let items=baseTracksForView();visibleTracks=applySearchSortFilter(items);$('#tracksHeading').textContent=view==='favorites'?'Favorites':view==='recent'?'Recently Played':view==='most'?'Most Played':view==='continue'?'Continue Listening':(activeFolderId==='all'?'All Tracks':(window.DMusicData?.folders||[]).find(f=>f.id===activeFolderId)?.name||'Tracks');$('#pageTitle').textContent=view==='playlists'?'Playlists':view==='library'?'Folders':$('#tracksHeading').textContent;$('#emptyState').hidden=visibleTracks.length>0;list.innerHTML='';visibleTracks.forEach((t,i)=>list.appendChild(trackRow(t,i)));renderStats();}
function trackRow(t,i){const wrap=document.createElement('div');wrap.className='track-row-wrap';const active=currentTrack?.id===t.id;wrap.innerHTML=`<button class="track-row${active?' active':''}" data-track-id="${esc(t.id)}"><span class="track-number">${String(i+1).padStart(2,'0')}</span><img src="${esc(resolveCover(t))}" alt=""><span class="track-info"><b>${esc(t.title)}</b><small>${esc(t.artist||'Unknown artist')}${t.album?` · ${esc(t.album)}`:''}${t.year?` · ${esc(t.year)}`:''}</small></span><span class="track-play">${active&&!audio.paused?'❚❚':'▶'}</span></button><button class="favorite-btn${favorites.has(t.id)?' active':''}" title="Favorite">${ICONS.heart}</button><button class="add-queue-btn" title="Add to queue">${ICONS.plus}</button>`;fallback(wrap.querySelector('img'));wrap.querySelector('.track-row').onclick=()=>playTrack(t);wrap.querySelector('.favorite-btn').onclick=e=>{e.stopPropagation();toggleFavorite(t.id);};wrap.querySelector('.add-queue-btn').onclick=e=>{e.stopPropagation();addQueue(t);};return wrap;}
function renderStats(){const el=$('#statsBar');if(el)el.innerHTML=`<span>${visibleTracks.length.toLocaleString()} tracks</span><span>${favorites.size} favorites</span><span>${queue.length} queued</span>`;}

function toggleFavorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);saveState();render();}
function addQueue(t){if(!queue.some(x=>x.id===t.id))queue.push(t);saveState();renderQueue();renderStats();}
function removeQueue(id){queue=queue.filter(t=>t.id!==id);saveState();renderQueue();renderStats();}
function renderQueue(){const list=$('#queueList');if(!list)return;list.innerHTML='';if(!queue.length){list.innerHTML='<div class="queue-empty">Queue is empty.</div>';return;}queue.forEach((t,i)=>{const item=document.createElement('div');item.className='queue-item'+(currentTrack?.id===t.id?' active':'');item.innerHTML=`<button class="queue-play"><img src="${esc(resolveCover(t))}" alt=""><span><b>${esc(t.title)}</b><small>${esc(t.artist||'Unknown artist')}</small></span><em>${String(i+1).padStart(2,'0')}</em></button><button class="queue-remove">×</button>`;fallback(item.querySelector('img'));item.querySelector('.queue-play').onclick=()=>playTrack(t,false);item.querySelector('.queue-remove').onclick=()=>removeQueue(t.id);list.appendChild(item);});}
function toggleQueue(){const p=$('#queuePanel'),b=$('#queueBackdrop'),open=!p.classList.contains('open');p.classList.toggle('open',open);p.setAttribute('aria-hidden',String(!open));b.hidden=!open;}

function playTrack(t,add=true){if(!t?.src)return;currentTrack=t;currentIndex=visibleTracks.findIndex(x=>x.id===t.id);if(add&&!queue.some(x=>x.id===t.id))queue.push(t);audio.src=t.src;audio.currentTime=Number((state.positions||{})[t.id]||0);audio.play().catch(()=>setPlayerState(false));$('#nowTitle').textContent=t.title||'Unknown title';$('#nowArtist').textContent=t.artist||'Unknown artist';$('#nowCover').src=resolveCover(t);fallback($('#nowCover'));$('#currentTime').textContent=formatTime(audio.currentTime);$('#progress').value=0;state.playCounts=state.playCounts||{};state.history=state.history||{};state.playCounts[t.id]=(state.playCounts[t.id]||0)+1;state.history[t.id]=Date.now();saveState();render();}
function togglePlay(){if(!currentTrack){const t=visibleTracks[0]||allTracks()[0];if(t)playTrack(t);}else audio.paused?audio.play().catch(()=>{}):audio.pause();}
function relative(dir){if(!visibleTracks.length)return;if(repeat==='one'&&dir>0){audio.currentTime=0;audio.play();return;}if(shuffle&&visibleTracks.length>1){let n=currentIndex;while(n===currentIndex)n=Math.floor(Math.random()*visibleTracks.length);playTrack(visibleTracks[n]);return;}let n=currentIndex+dir;if(n<0)n=visibleTracks.length-1;if(n>=visibleTracks.length){if(repeat==='off'){audio.currentTime=0;setPlayerState(false);return;}n=0;}playTrack(visibleTracks[n]);}
function setPlayerState(on){$('#playBtn').textContent=on?'❚❚':'▶';$('#playingIndicator').hidden=!on;$('.player').classList.toggle('playing',on);document.querySelectorAll('.track-row').forEach(r=>{const a=r.dataset.trackId===currentTrack?.id;r.classList.toggle('active',a);const i=r.querySelector('.track-play');if(i)i.textContent=a&&!audio.paused?'❚❚':'▶';});}
function updateModes(){$('#shuffleBtn').classList.toggle('active',shuffle);$('#repeatBtn').classList.toggle('active',repeat!=='off');$('#repeatBtn').title=`Repeat: ${repeat}`;}

function setView(v){view=v;setNav(v);if(v==='playlists')renderPlaylists();else render();window.scrollTo({top:document.querySelector('.tracks-section')?.offsetTop||0,behavior:'smooth'});}
function renderPlaylists(){const list=$('#tracks');$('#tracksHeading').textContent='Playlists';$('#pageTitle').textContent='Playlists';$('#library').innerHTML='';$('#folderCount').textContent='';const playlists=state.playlists||[];list.innerHTML=`<div class="playlist-create"><button id="newPlaylistBtn" class="scan-btn">${ICONS.plus} NEW PLAYLIST</button></div>`;if(!playlists.length){list.innerHTML+='<div class="empty-state">No playlists yet. Create your first one.</div>';$('#newPlaylistBtn').onclick=openPlaylistModal;return;}playlists.forEach(p=>{const b=document.createElement('button');b.className='playlist-card';b.innerHTML=`<span class="playlist-art">♪</span><span><b>${esc(p.name)}</b><small>${p.tracks.length} tracks</small></span>`;b.onclick=()=>openPlaylist(p.id);list.appendChild(b);});$('#newPlaylistBtn').onclick=openPlaylistModal;}
function openPlaylist(id){const p=(state.playlists||[]).find(x=>x.id===id);if(!p)return;const tracks=p.tracks.map(findTrack).filter(Boolean);visibleTracks=tracks;$('#tracksHeading').textContent=p.name;$('#pageTitle').textContent=p.name;$('#tracks').innerHTML='';tracks.forEach((t,i)=>$('#tracks').appendChild(trackRow(t,i)));}
function openPlaylistModal(){$('#playlistModal').hidden=false;$('#playlistName').focus();}
function closePlaylistModal(){$('#playlistModal').hidden=true;$('#playlistName').value='';}
function createPlaylist(){const name=$('#playlistName').value.trim();if(!name)return;state.playlists=state.playlists||[];state.playlists.push({id:'pl-'+Date.now().toString(36),name,tracks:[]});saveState();closePlaylistModal();renderPlaylists();}

function render(){if(view==='playlists'){renderPlaylists();return;}renderLibrary();renderTracks();renderQueue();updateModes();}

function bind(){
  $('#scanBtn').onclick=()=>$('#musicFolderInput').click();$('#musicFolderInput').onchange=e=>{if(e.target.files?.length)scanFiles(e.target.files);e.target.value='';};
  $('#allTracksBtn').onclick=()=>{view='library';activeFolderId='all';setNav('library');render();};
  $('#searchInput').oninput=renderTracks;$('#sortSelect').onchange=renderTracks;$('#filterSelect').onchange=renderTracks;
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('#shuffleBtn').innerHTML=ICONS.shuffle;$('#prevBtn').innerHTML=ICONS.prev;$('#nextBtn').innerHTML=ICONS.next;$('#repeatBtn').innerHTML=ICONS.repeat;$('#queueBtn').innerHTML=ICONS.queue;
  $('#playBtn').onclick=togglePlay;$('#prevBtn').onclick=()=>relative(-1);$('#nextBtn').onclick=()=>relative(1);$('#shuffleBtn').onclick=()=>{shuffle=!shuffle;updateModes();saveState();};$('#repeatBtn').onclick=()=>{repeat=repeat==='off'?'all':repeat==='all'?'one':'off';updateModes();saveState();};$('#queueBtn').onclick=toggleQueue;$('#closeQueueBtn').onclick=toggleQueue;$('#queueBackdrop').onclick=toggleQueue;$('#clearQueueBtn').onclick=()=>{queue=[];saveState();renderQueue();renderStats();};
  $('#volume').value=typeof state.volume==='number'?state.volume:1;audio.volume=Number($('#volume').value);$('#volume').oninput=e=>{audio.volume=Number(e.target.value);saveState();};$('#progress').oninput=e=>{if(audio.duration)audio.currentTime=(Number(e.target.value)/100)*audio.duration;};
  $('#closePlaylistModal').onclick=closePlaylistModal;$('#createPlaylistBtn').onclick=createPlaylist;
  audio.onloadedmetadata=()=>$('#duration').textContent=formatTime(audio.duration);audio.ontimeupdate=()=>{if(audio.duration){$('#currentTime').textContent=formatTime(audio.currentTime);$('#progress').value=audio.currentTime/audio.duration*100;state.positions=state.positions||{};state.positions[currentTrack?.id]=audio.currentTime;saveState();}};audio.onplay=()=>setPlayerState(true);audio.onpause=()=>setPlayerState(false);audio.onended=()=>relative(1);
  document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;const k=e.key.toLowerCase();if(e.code==='Space'){e.preventDefault();togglePlay();}else if(e.key==='ArrowRight'){e.preventDefault();relative(1);}else if(e.key==='ArrowLeft'){e.preventDefault();relative(-1);}else if(e.key==='ArrowUp'){e.preventDefault();audio.volume=Math.min(1,audio.volume+.05);$('#volume').value=audio.volume;saveState();}else if(e.key==='ArrowDown'){e.preventDefault();audio.volume=Math.max(0,audio.volume-.05);$('#volume').value=audio.volume;saveState();}else if(k==='m'){audio.muted=!audio.muted;}else if(k==='s'){shuffle=!shuffle;updateModes();saveState();}else if(k==='r'){$('#repeatBtn').click();}});
}

(async function init(){bind();queue=(state.queue||[]).map(findTrack).filter(Boolean);render();if(state.currentTrackId){const t=findTrack(state.currentTrackId);if(t){currentTrack=t;$('#nowTitle').textContent=t.title;$('#nowArtist').textContent=t.artist||'Unknown artist';$('#nowCover').src=resolveCover(t);fallback($('#nowCover'));}}if(window.DMusicData?.scanned)return;await restoreScanned();})();
