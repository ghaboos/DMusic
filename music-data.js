const musicData = {
  folders: [
    {
      id: "featured",
      name: "Featured",
      description: "Your featured tracks",
      cover: "assets/covers/folder-featured.svg",
      tracks: [
        {
          id: "demo-01",
          title: "DMusic Demo",
          artist: "Lil Danny",
          album: "DMusic",
          year: 2026,
          cover: "assets/covers/track-demo.svg",
          src: "assets/music/demo.mp3"
        }
      ]
    },
    {
      id: "albums",
      name: "Albums",
      description: "Full albums and projects",
      cover: "assets/covers/folder-albums.svg",
      tracks: []
    },
    {
      id: "singles",
      name: "Singles",
      description: "Standalone tracks",
      cover: "assets/covers/folder-singles.svg",
      tracks: []
    }
  ]
};

window.DMusicData = musicData;
