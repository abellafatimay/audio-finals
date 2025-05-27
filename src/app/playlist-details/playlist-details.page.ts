import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PlaylistService } from '../services/playlist/playlist.service';
import { AudioPlayerService } from '../services/audio-player/audioplayer.service';
import { AudioLibraryService } from '../services/audio-library/audio-library.service';
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
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    private playlistService: PlaylistService,
    public audioPlayer: AudioPlayerService,
    private audioLibrary: AudioLibraryService
  ) {}

  async ngOnInit() {
    await this.audioLibrary.restoreAudiosFromStorage();
    const name = decodeURIComponent(this.route.snapshot.paramMap.get('name') || '');
    this.playlists = await this.playlistService.getPlaylists();
    this.playlist = this.playlists.find((p: any) => p.name === name);

    if (!this.playlist) {
      this.notFound = true;
      return;
    }

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
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  async playTrack(index: number) {
    this.currentTrackIndex = index;
    const track = this.playlist.tracks[index];
    if (!this.audioLibrary.preloadedAssets.has(track.assetId)) {
      try {
        await this.audioLibrary.preloadAudio(track.assetId);
      } catch (e) {
        console.warn('Failed to preload audio', e);
        return;
      }
    }
    this.audioPlayer.playTrack(track, this.playlist.tracks);
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
    this.playlist.tracks.splice(index, 1);
  }

  async debugPlaylistsStorage() {
    const stored = await Preferences.get({ key: 'playlists' });
    console.log('Stored playlists:', stored.value);
  }
}
