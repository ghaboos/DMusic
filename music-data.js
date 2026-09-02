const musicData = {
  folders: [
    {
      id: "featured",
      name: "Featured",
      description: "Your featured tracks",
      cover: "assets/covers/folder-default.jpg",
      tracks: [
        {
          id: "demo-01",
          title: "DMusic Demo",
          artist: "Lil Danny",
          album: "DMusic",
          year: 2026,
          cover: "assets/covers/track-default.jpg",
          src: "assets/music/demo.mp3"
        }
      ]
    },
    {
      id: "albums",
      name: "Albums",
      description: "Full albums and projects",
      cover: "assets/covers/folder-default.jpg",
      tracks: []
    },
    {
      id: "singles",
      name: "Singles",
      description: "Standalone tracks",
      cover: "assets/covers/folder-default.jpg",
      tracks: []
    }
  ]
};

// Global data used by script.js
window.DMusicData = musicData;
