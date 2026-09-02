const audio = new Audio();
const STORAGE_KEY = "dmusic-state-v2";
const FALLBACK_COVER = "assets/covers/fallback.svg";

let currentTrack = null;
let currentIndex = -1;
let visibleTracks = [];
let activeFolderId = "featured";
let queue = [];
let favorites = new Set();
let shuffle = false;
let repeat = "off"; // off | all | one
let state = loadState();

const $ = (selector) => document.querySelector(selector);

const ICONS = {
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 7h2c5 0 6 10 12 10h3M16 21h5v-5M4 17h2c2.2 0 3.5-1.3 4.4-2.7M13.6 9.7C14.5 8.3 15.8 7 18 7h3"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M18 6 9 12l9 6V6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M6 6l9 6-9 6V6z"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  queue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h12M4 11h12M4 16h7M15 16l2.5 2.5L21 15"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.4-8.8 10.1-8.8 10.1S3.2 14.2 3.2 8.8A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.6Z"/></svg>'
};

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    favorites: [...favorites], shuffle, repeat, volume: audio.volume,
    currentTrackId: currentTrack?.id || null,
    activeFolderId,
    queue: queue.map((track) => track.id)
  }));
}

function getAllTracks() {
  return (window.DMusicData?.folders || []).flatMap((folder) =>
    (folder.tracks || []).map((track) => ({
      ...track,
      folderId: folder.id,
      folderName: folder.name,
      folderCover: folder.cover
    }))
  );
}

function resolveCover(track) {
  return track?.cover || track?.folderCover || FALLBACK_COVER;
}

function applyCoverFallback(img) {
  img.addEventListener("error", () => {
    if (img.src.endsWith(FALLBACK_COVER)) return;
    img.src = FALLBACK_COVER;
  }, { once: true });
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function setPlayerState(isPlaying) {
  const button = $("#playBtn");
  button.textContent = isPlaying ? "❚❚" : "▶";
  button.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  $("#playingIndicator").hidden = !isPlaying;
  $(".player").classList.toggle("playing", isPlaying);
  updateActiveRow();
}

function renderLibrary() {
  const grid = $("#library");
  const folders = window.DMusicData?.folders || [];
  if (!grid) return;
  $("#folderCount").textContent = folders.length;
  grid.innerHTML = "";

  folders.forEach((folder) => {
    const card = document.createElement("button");
    card.className = `folder-card${folder.id === activeFolderId ? " selected" : ""}`;
    card.type = "button";
    card.innerHTML = `<img src="${folder.cover || FALLBACK_COVER}" alt=""><span>${escapeHtml(folder.name)}</span><small>${folder.tracks?.length || 0} tracks</small>`;
    const img = card.querySelector("img");
    applyCoverFallback(img);
    card.addEventListener("click", () => renderTracks(folder.id));
    grid.appendChild(card);
  });
}

function renderTracks(folderId = activeFolderId) {
  const folders = window.DMusicData?.folders || [];
  const list = $("#tracks");
  const folder = folders.find((item) => item.id === folderId);
  if (!list) return;

  activeFolderId = folder ? folder.id : "all";
  const query = $("#searchInput")?.value.trim().toLowerCase() || "";
  const source = folder ? (folder.tracks || []).map((track) => ({ ...track, folderId: folder.id, folderName: folder.name, folderCover: folder.cover })) : getAllTracks();
  visibleTracks = source.filter((track) => `${track.title} ${track.artist || ""} ${track.album || ""}`.toLowerCase().includes(query));

  $("#tracksHeading").textContent = folder?.name || "All Tracks";
  $("#emptyState").hidden = visibleTracks.length > 0;
  list.innerHTML = "";

  visibleTracks.forEach((track, index) => {
    const row = document.createElement("div");
    row.className = "track-row-wrap";
    const active = currentTrack?.id === track.id;
    row.innerHTML = `
      <button class="track-row${active ? " active" : ""}" type="button" data-track-id="${escapeHtml(track.id)}">
        <span class="track-number">${String(index + 1).padStart(2, "0")}</span>
        <img src="${resolveCover(track)}" alt="">
        <span class="track-info"><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.artist || "Unknown artist")}${track.album ? ` · ${escapeHtml(track.album)}` : ""}</small></span>
        <span class="play-icon">${active && !audio.paused ? "❚❚" : "▶"}</span>
      </button>
      <button class="favorite-btn${favorites.has(track.id) ? " active" : ""}" type="button" aria-label="${favorites.has(track.id) ? "Remove from favorites" : "Add to favorites"}" title="Favorite">${ICONS.heart}</button>`;
    const img = row.querySelector("img");
    applyCoverFallback(img);
    row.querySelector(".track-row").addEventListener("click", () => playTrack(track));
    row.querySelector(".favorite-btn").addEventListener("click", (event) => { event.stopPropagation(); toggleFavorite(track.id); });
    list.appendChild(row);
  });

  renderLibrary();
}

function updateActiveRow() {
  document.querySelectorAll(".track-row").forEach((row) => {
    const active = row.dataset.trackId === currentTrack?.id;
    row.classList.toggle("active", active);
    const icon = row.querySelector(".play-icon");
    if (icon) icon.textContent = active && !audio.paused ? "❚❚" : "▶";
  });
}

function playTrack(track, addToQueue = true) {
  if (!track?.src) return;
  currentTrack = track;
  currentIndex = visibleTracks.findIndex((item) => item.id === track.id);
  if (currentIndex < 0) currentIndex = 0;

  if (addToQueue && !queue.some((item) => item.id === track.id)) queue.push(track);
  audio.src = track.src;
  audio.load();
  audio.play().catch(() => setPlayerState(false));

  $("#nowTitle").textContent = track.title || "Unknown title";
  $("#nowArtist").textContent = track.artist || "Unknown artist";
  $("#nowCover").src = resolveCover(track);
  applyCoverFallback($("#nowCover"));
  $("#currentTime").textContent = "0:00";
  $("#duration").textContent = "0:00";
  $("#progress").value = 0;
  saveState();
  renderTracks(activeFolderId);
  renderQueue();
}

function togglePlay() {
  if (!currentTrack) {
    const first = visibleTracks[0] || getAllTracks()[0];
    if (first) playTrack(first);
  } else if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function playRelative(direction) {
  if (!visibleTracks.length) return;
  if (repeat === "one" && direction === 1) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  if (shuffle && visibleTracks.length > 1) {
    let next = currentIndex;
    while (next === currentIndex) next = Math.floor(Math.random() * visibleTracks.length);
    playTrack(visibleTracks[next]);
    return;
  }
  let nextIndex = currentIndex + direction;
  if (repeat === "off" && nextIndex >= visibleTracks.length) { audio.currentTime = 0; setPlayerState(false); return; }
  if (nextIndex < 0) nextIndex = visibleTracks.length - 1;
  if (nextIndex >= visibleTracks.length) nextIndex = 0;
  playTrack(visibleTracks[nextIndex]);
}

function toggleFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  saveState();
  renderTracks(activeFolderId);
}

function renderQueue() {
  const list = $("#queueList");
  if (!list) return;
  list.innerHTML = "";
  if (!queue.length) { list.innerHTML = '<div class="queue-empty">Queue is empty.</div>'; return; }
  queue.forEach((track, index) => {
    const item = document.createElement("button");
    item.className = `queue-item${currentTrack?.id === track.id ? " active" : ""}`;
    item.type = "button";
    item.innerHTML = `<img src="${resolveCover(track)}" alt=""><span><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.artist || "Unknown artist")}</small></span><em>${String(index + 1).padStart(2, "0")}</em>`;
    applyCoverFallback(item.querySelector("img"));
    item.addEventListener("click", () => playTrack(track, false));
    list.appendChild(item);
  });
}

function toggleQueue() {
  const panel = $("#queuePanel");
  const backdrop = $("#queueBackdrop");
  const open = !panel.classList.contains("open");
  panel.classList.toggle("open", open);
  panel.setAttribute("aria-hidden", String(!open));
  backdrop.hidden = !open;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
}

$("#shuffleBtn").innerHTML = ICONS.shuffle;
$("#prevBtn").innerHTML = ICONS.prev;
$("#nextBtn").innerHTML = ICONS.next;
$("#repeatBtn").innerHTML = ICONS.repeat;
$("#queueBtn").innerHTML = ICONS.queue;

$("#playBtn")?.addEventListener("click", togglePlay);
$("#prevBtn")?.addEventListener("click", () => playRelative(-1));
$("#nextBtn")?.addEventListener("click", () => playRelative(1));
$("#shuffleBtn")?.addEventListener("click", () => { shuffle = !shuffle; updateModes(); saveState(); });
$("#repeatBtn")?.addEventListener("click", () => { repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off"; updateModes(); saveState(); });
$("#queueBtn")?.addEventListener("click", toggleQueue);
$("#closeQueueBtn")?.addEventListener("click", toggleQueue);
$("#queueBackdrop")?.addEventListener("click", toggleQueue);
$("#allTracksBtn")?.addEventListener("click", () => { $("#searchInput").value = ""; renderTracks("all"); });
$("#searchInput")?.addEventListener("input", () => renderTracks(activeFolderId));

$("#volume")?.addEventListener("input", (event) => { audio.volume = Number(event.target.value); saveState(); });
$("#progress")?.addEventListener("input", (event) => { if (audio.duration) audio.currentTime = (Number(event.target.value) / 100) * audio.duration; });

audio.addEventListener("loadedmetadata", () => { $("#duration").textContent = formatTime(audio.duration); });
audio.addEventListener("timeupdate", () => { if (audio.duration) { $("#currentTime").textContent = formatTime(audio.currentTime); $("#progress").value = (audio.currentTime / audio.duration) * 100; } });
audio.addEventListener("play", () => setPlayerState(true));
audio.addEventListener("pause", () => setPlayerState(false));
audio.addEventListener("ended", () => playRelative(1));

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input,textarea")) return;
  if (event.code === "Space") { event.preventDefault(); togglePlay(); }
  if (event.code === "ArrowRight" && currentTrack && audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  if (event.code === "ArrowLeft" && currentTrack && audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 5);
  if (event.key.toLowerCase() === "m") audio.muted = !audio.muted;
});

favorites = new Set(state.favorites || []);
shuffle = Boolean(state.shuffle);
repeat = state.repeat || "off";
audio.volume = typeof state.volume === "number" ? state.volume : 1;
$("#volume").value = audio.volume;
updateModes();
renderLibrary();
const initialFolder = (window.DMusicData?.folders || []).some((folder) => folder.id === state.activeFolderId) ? state.activeFolderId : "featured";
renderTracks(initialFolder);

if (state.currentTrackId) {
  const restored = getAllTracks().find((track) => track.id === state.currentTrackId);
  if (restored) {
    currentTrack = restored;
    $("#nowTitle").textContent = restored.title || "Unknown title";
    $("#nowArtist").textContent = restored.artist || "Unknown artist";
    $("#nowCover").src = resolveCover(restored);
    applyCoverFallback($("#nowCover"));
    updateActiveRow();
  }
}

function updateModes() {
  $("#shuffleBtn")?.classList.toggle("active", shuffle);
  $("#repeatBtn")?.classList.toggle("active", repeat !== "off");
  $("#repeatBtn")?.setAttribute("title", `Repeat: ${repeat}`);
  $("#repeatBtn")?.setAttribute("aria-label", `Repeat: ${repeat}`);
}
