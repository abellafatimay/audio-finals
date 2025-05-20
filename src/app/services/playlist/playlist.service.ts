import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({ providedIn: 'root' })
export class PlaylistService {
  private key = 'playlists';

  constructor() { }

  async getPlaylists(): Promise<any[]> {
    const stored = await Preferences.get({ key: this.key });
    return stored.value ? JSON.parse(stored.value) : [];
  }

  async savePlaylists(playlists: any[]) {
    await Preferences.set({ key: this.key, value: JSON.stringify(playlists) });
  }

  async addPlaylist(name: string) {
    const playlists = await this.getPlaylists();
    playlists.push({ name, tracks: [] });
    await this.savePlaylists(playlists);
  }

  async addTrackToPlaylist(playlistName: string, track: any) {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find((p: any) => p.name === playlistName);
    if (playlist && !playlist.tracks.some((t: any) => t.assetId === track.assetId)) {
      playlist.tracks.push(track);
      await this.savePlaylists(playlists);
    }
  }

  async removeTrackFromPlaylist(playlistName: string, assetId: string) {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find((p: any) => p.name === playlistName);
    if (playlist) {
      playlist.tracks = playlist.tracks.filter((t: any) => t.assetId !== assetId);
      await this.savePlaylists(playlists);
    }
  }
}
