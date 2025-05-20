import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NativeAudio } from '@capacitor-community/native-audio';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  public currentTrack$ = new BehaviorSubject<any>(null);
  public isPaused$ = new BehaviorSubject<boolean>(true);
  public playlist$ = new BehaviorSubject<any[]>([]);
  public currentIndex$ = new BehaviorSubject<number>(-1);

  async playTrack(track: any, playlist: any[] = []) {
    // Stop previous
    if (this.currentTrack$.value) {
      try {
        if (NativeAudio && NativeAudio.stop) {
          await NativeAudio.stop({ assetId: this.currentTrack$.value.assetId });
        }
      } catch (e) {
        console.warn('Error stopping previous track', e);
      }
    }
    this.playlist$.next(playlist);
    this.currentTrack$.next(track);
    this.currentIndex$.next(playlist.findIndex(t => t.assetId === track.assetId));
    try {
      if (NativeAudio && NativeAudio.play) {
        await NativeAudio.play({ assetId: track.assetId });
      }
      this.isPaused$.next(false);
    } catch (e) {
      console.warn('Error playing track', e);
    }
  }

  async togglePlayPause() {
    const track = this.currentTrack$.value;
    if (!track) return;
    try {
      if (this.isPaused$.value) {
        if (NativeAudio && NativeAudio.resume) {
          await NativeAudio.resume({ assetId: track.assetId });
        }
        this.isPaused$.next(false);
      } else {
        if (NativeAudio && NativeAudio.pause) {
          await NativeAudio.pause({ assetId: track.assetId });
        }
        this.isPaused$.next(true);
      }
    } catch (e) {
      console.warn('Error toggling play/pause', e);
    }
  }

  async playNext() {
    const playlist = this.playlist$.value;
    let idx = this.currentIndex$.value;
    if (!playlist.length) return;
    idx = (idx + 1) % playlist.length;
    await this.playTrack(playlist[idx], playlist);
  }

  async playPrevious() {
    const playlist = this.playlist$.value;
    let idx = this.currentIndex$.value;
    if (!playlist.length) return;
    idx = (idx - 1 + playlist.length) % playlist.length;
    await this.playTrack(playlist[idx], playlist);
  }
}
