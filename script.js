const audio = new Audio();
let currentTrack = null;

const $ = (selector) => document.querySelector(selector);

function getTracks() {
  return (window.DMusicData?.folders || []).flatMap(folder =>
    (folder.tracks || []).map(track => ({ ...track, folderId: folder.id, folderName: folder.name, folderCover: folder.cover }))
  );
}

function resolveCover(track) {
  return track?.cover || track?.folderCover || "assets/covers/track-default.jpg";
}

function renderLibrary() {
  const grid = $("#library");
  if (!grid) return;

  grid.innerHTML = "";
  for (const folder of window.DMusicData?.folders || []) {
    const card = document.createElement("button");
    card.className = "folder-card";
    card.innerHTML = `
      <img src="${folder.cover || "assets/covers/folder-default.jpg"}" alt="">
      <span>${folder.name}</span>
      <small>${folder.tracks?.length || 0} tracks</small>
    `;
    card.addEventListener("click", () => renderTracks(folder.id));
    grid.appendChild(card);
  }
}

function renderTracks(folderId) {
  const folder = (window.DMusicData?.folders || []).find(item => item.id === folderId);
  const list = $("#tracks");
  if (!list || !folder) return;

  list.innerHTML = "";
  for (const track of folder.tracks || []) {
    const row = document.createElement("button");
    row.className = "track-row";
    row.innerHTML = `
      <img src="${resolveCover({ ...track, folderCover: folder.cover })}" alt="">
      <span class="track-info"><b>${track.title}</b><small>${track.artist || "Unknown artist"}</small></span>
      <span class="play-icon">▶</span>
    `;
    row.addEventListener("click", () => playTrack({ ...track, folderCover: folder.cover }));
    list.appendChild(row);
  }
}

function playTrack(track) {
  currentTrack = track;
  audio.src = track.src;
  audio.play().catch(() => {});

  $("#nowTitle").textContent = track.title;
  $("#nowArtist").textContent = track.artist || "Unknown artist";
  $("#nowCover").src = resolveCover(track);
  $("#playBtn").textContent = "❚❚";
}

$("#playBtn")?.addEventListener("click", () => {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    $("#playBtn").textContent = "❚❚";
  } else {
    audio.pause();
    $("#playBtn").textContent = "▶";
  }
});

$("#volume")?.addEventListener("input", (event) => {
  audio.volume = Number(event.target.value);
});

audio.addEventListener("ended", () => {
  $("#playBtn").textContent = "▶";
});

renderLibrary();
renderTracks(window.DMusicData?.folders?.[0]?.id);
