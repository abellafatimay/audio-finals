import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({ providedIn: 'root' })
export class PlaylistService {
  private key = 'playlists';

  constructor() { }

  async getPlaylists(): Promise<any[]> {
    const stored = await Preferences.get({ key: this.key });
    const parsed = stored.value ? JSON.parse(stored.value) : [];
    return parsed.map((p: any) => ({
      ...p,
      tracks: Array.isArray(p.tracks) ? p.tracks : [],
    }));
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

    if (playlist) {
      if (!Array.isArray(playlist.tracks)) {
        playlist.tracks = [];
      }
      const alreadyExists = playlist.tracks.some((t: any) => t.assetId === track.assetId);
      if (!alreadyExists) {
        playlist.tracks.push(track);
        await this.savePlaylists(playlists);
      }
    }
  }

  async removeTrackFromPlaylist(playlistName: string, assetId: string) {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find((p: any) => p.name === playlistName);
    if (playlist && Array.isArray(playlist.tracks)) {
      playlist.tracks = playlist.tracks.filter((t: any) => t.assetId !== assetId);
      await this.savePlaylists(playlists);
    }
  }

  async deletePlaylist(name: string) {
    const playlists = await this.getPlaylists();
    const updated = playlists.filter((p: any) => p.name !== name);
    await this.savePlaylists(updated);
  }

  async renamePlaylist(oldName: string, newName: string) {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find((p: any) => p.name === oldName);
    if (playlist) {
      playlist.name = newName;
      await this.savePlaylists(playlists);
    }
  }

  async updateTrackInPlaylist(playlistName: string, updatedTrack: any) {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find((p: any) => p.name === playlistName);
    if (playlist && Array.isArray(playlist.tracks)) {
      const idx = playlist.tracks.findIndex((t: any) => t.assetId === updatedTrack.assetId);
      if (idx !== -1) {
        playlist.tracks[idx] = updatedTrack;
        await this.savePlaylists(playlists);
      }
    }
  }
}
