import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PlaylistService } from '../services/playlist/playlist.service';
import { AudioPlayerService } from '../services/audioplayer/audioplayer.service';
import { Preferences } from '@capacitor/preferences';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-playlist-details',
  templateUrl: './playlist-details.page.html',
  styleUrls: ['./playlist-details.page.scss'],
  standalone: false,
})
export class PlaylistDetailsPage implements OnInit, OnDestroy {
  playlist: any = null;
  playlists: any[] = [];
  currentTrackIndex: number = -1;
  isPaused: boolean = false;
  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private playlistService: PlaylistService,
    public audioPlayer: AudioPlayerService
  ) {}

  async ngOnInit() {
    const name = decodeURIComponent(this.route.snapshot.paramMap.get('name') || '');
    this.playlists = await this.playlistService.getPlaylists();
    this.playlist = this.playlists.find((p: any) => p.name === name);

    // Subscribe to currentTrack$ and isPaused$
    this.subs.push(
      this.audioPlayer.currentTrack$.subscribe(track => {
        this.currentTrackIndex = this.playlist?.tracks?.findIndex(
          (t: any) => t.assetId === track?.assetId
        ) ?? -1;
      })
    );
    this.subs.push(
      this.audioPlayer.isPaused$.subscribe(paused => {
        this.isPaused = paused;
      })
    );
    this.debugPlaylistsStorage();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  playTrack(index: number) {
    this.audioPlayer.playTrack(this.playlist.tracks[index], this.playlist.tracks);
  }

  async togglePlayPause() {
    await this.audioPlayer.togglePlayPause();
  }

  async playNext() {
    if (!this.playlist?.tracks?.length) return;
    let nextIndex = this.currentTrackIndex + 1;
    if (nextIndex >= this.playlist.tracks.length) nextIndex = 0;
    this.playTrack(nextIndex);
  }

  async playPrevious() {
    if (!this.playlist?.tracks?.length) return;
    let prevIndex = this.currentTrackIndex - 1;
    if (prevIndex < 0) prevIndex = this.playlist.tracks.length - 1;
    this.playTrack(prevIndex);
  }

  async removeTrackFromPlaylist(index: number, event: Event) {
    event.stopPropagation();
    const track = this.playlist.tracks[index];
    await this.playlistService.removeTrackFromPlaylist(this.playlist.name, track.assetId);
    // Refresh the playlist from storage
    const playlists = await this.playlistService.getPlaylists();
    this.playlist = playlists.find((p: any) => p.name === this.playlist.name);
  }

  async debugPlaylistsStorage() {
    const stored = await Preferences.get({ key: 'playlists' });
    console.log('Stored playlists:', stored.value);
  }
}
