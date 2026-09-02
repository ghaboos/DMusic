const audio = new Audio();
let currentTrack = null;
let currentIndex = -1;
let visibleTracks = [];
let activeFolderId = null;

const $ = (selector) => document.querySelector(selector);

function getTracks() {
  return (window.DMusicData?.folders || []).flatMap((folder) =>
    (folder.tracks || []).map((track) => ({
      ...track,
      folderId: folder.id,
      folderName: folder.name,
      folderCover: folder.cover,
    }))
  );
}

function resolveCover(track) {
  return track?.cover || track?.folderCover || "assets/covers/track-default.jpg";
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function setPlayerState(isPlaying) {
  $("#playBtn").textContent = isPlaying ? "❚❚" : "▶";
  $("#playBtn").setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  $("#playingIndicator").hidden = !isPlaying;
  $(".player").classList.toggle("playing", isPlaying);
}

function renderLibrary() {
  const grid = $("#library");
  if (!grid) return;

  const folders = window.DMusicData?.folders || [];
  $("#folderCount").textContent = folders.length;
  grid.innerHTML = "";

  for (const folder of folders) {
    const card = document.createElement("button");
    card.className = "folder-card";
    card.type = "button";
    card.innerHTML = `
      <img src="${folder.cover || "assets/covers/folder-default.jpg"}" alt="">
      <span>${folder.name}</span>
      <small>${folder.tracks?.length || 0} tracks</small>
    `;
    card.addEventListener("click", () => renderTracks(folder.id));
    grid.appendChild(card);
  }
}

function renderTracks(folderId = activeFolderId) {
  const folder = (window.DMusicData?.folders || []).find((item) => item.id === folderId);
  const list = $("#tracks");
  if (!list || !folder) return;

  activeFolderId = folder.id;
  const query = $("#searchInput")?.value.trim().toLowerCase() || "";
  visibleTracks = (folder.tracks || [])
    .map((track) => ({ ...track, folderId: folder.id, folderName: folder.name, folderCover: folder.cover }))
    .filter((track) => `${track.title} ${track.artist || ""} ${track.album || ""}`.toLowerCase().includes(query));

  $("#tracksHeading").textContent = folder.name;
  $("#emptyState").hidden = visibleTracks.length > 0;
  list.innerHTML = "";

  visibleTracks.forEach((track, index) => {
    const row = document.createElement("button");
    row.className = "track-row";
    row.type = "button";
    row.dataset.trackId = track.id;
    if (currentTrack?.id === track.id) row.classList.add("active");

    const isCurrent = currentTrack?.id === track.id && !audio.paused;
    row.innerHTML = `
      <span class="track-number">${String(index + 1).padStart(2, "0")}</span>
      <img src="${resolveCover(track)}" alt="">
      <span class="track-info">
        <b>${track.title}</b>
        <small>${track.artist || "Unknown artist"}${track.album ? ` · ${track.album}` : ""}</small>
      </span>
      <span class="play-icon">${isCurrent ? "❚❚" : "▶"}</span>
    `;

    row.addEventListener("click", () => playTrack(track));
    list.appendChild(row);
  });
}

function updateActiveRow() {
  document.querySelectorAll(".track-row").forEach((row) => {
    const active = row.dataset.trackId === currentTrack?.id;
    row.classList.toggle("active", active);
    const icon = row.querySelector(".play-icon");
    if (icon) icon.textContent = active && !audio.paused ? "❚❚" : "▶";
  });
}

function playTrack(track) {
  if (!track?.src) return;

  currentTrack = track;
  currentIndex = visibleTracks.findIndex((item) => item.id === track.id);
  if (currentIndex < 0) currentIndex = 0;

  audio.src = track.src;
  audio.load();
  audio.play().catch(() => {});

  $("#nowTitle").textContent = track.title || "Unknown title";
  $("#nowArtist").textContent = track.artist || "Unknown artist";
  $("#nowCover").src = resolveCover(track);
  $("#currentTime").textContent = "0:00";
  $("#duration").textContent = "0:00";
  $("#progress").value = 0;
  setPlayerState(true);
  renderTracks(activeFolderId);
}

function togglePlay() {
  if (!currentTrack) {
    const first = visibleTracks[0] || getTracks()[0];
    if (first) playTrack(first);
    return;
  }

  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function playRelative(direction) {
  if (!visibleTracks.length) return;
  if (currentIndex < 0) {
    playTrack(visibleTracks[0]);
    return;
  }

  const nextIndex = (currentIndex + direction + visibleTracks.length) % visibleTracks.length;
  playTrack(visibleTracks[nextIndex]);
}

$("#playBtn")?.addEventListener("click", togglePlay);
$("#prevBtn")?.addEventListener("click", () => playRelative(-1));
$("#nextBtn")?.addEventListener("click", () => playRelative(1));

$("#volume")?.addEventListener("input", (event) => {
  audio.volume = Number(event.target.value);
});

$("#progress")?.addEventListener("input", (event) => {
  if (!audio.duration) return;
  audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
});

$("#searchInput")?.addEventListener("input", () => renderTracks(activeFolderId));

audio.addEventListener("loadedmetadata", () => {
  $("#duration").textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  $("#currentTime").textContent = formatTime(audio.currentTime);
  $("#progress").value = (audio.currentTime / audio.duration) * 100;
});

audio.addEventListener("play", () => {
  setPlayerState(true);
  updateActiveRow();
});

audio.addEventListener("pause", () => {
  setPlayerState(false);
  updateActiveRow();
});

audio.addEventListener("ended", () => {
  playRelative(1);
});

renderLibrary();
const firstFolder = window.DMusicData?.folders?.[0];
if (firstFolder) renderTracks(firstFolder.id);
