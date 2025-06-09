import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
import { NativeAudio } from '@capacitor-community/native-audio';
import { AudioTrack } from 'src/app/models/audio-track.model';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  public currentTrack$ = new BehaviorSubject<any>(null);
  public isPaused$ = new BehaviorSubject<boolean>(true);
  public playlist$ = new BehaviorSubject<any[]>([]);
  public currentIndex$ = new BehaviorSubject<number>(-1);
  public duration$ = new BehaviorSubject<number>(0);
  public currentTime$ = new BehaviorSubject<number>(0);

  private htmlAudio = new Audio();
  private progressInterval: any;
  private repeatPoll: any;
  private repeatMode = false;

  async playTrack(track: AudioTrack, playlist: AudioTrack[] = []) {


    if (this.currentTrack$.value) {
      try {
        if (this.currentTrack$.value.type === 'local' && NativeAudio && NativeAudio.stop) {
          await NativeAudio.stop({ assetId: this.currentTrack$.value.assetId });
        } else if (this.currentTrack$.value.type === 'stream') {
          this.htmlAudio.pause();
          this.htmlAudio.currentTime = 0;
        }
      } catch (e) {
        console.warn('Error stopping previous track', e);
      }
    }

    this.playlist$.next(playlist);
    this.currentTrack$.next(track);
    const idx = playlist.findIndex(t =>
      (t.assetId && track.assetId && t.assetId === track.assetId) ||
      (t.src && track.src && t.src === track.src)
    );
    this.currentIndex$.next(idx);

    try {
      if (track.type === 'local' && NativeAudio && NativeAudio.play) {
        if (track.assetId) {
          await NativeAudio.play({ assetId: track.assetId });
        } else {
          throw new Error('Track assetId is undefined');
        }
      } else if (track.type === 'stream') {
        this.htmlAudio.src = track.src;
        await this.htmlAudio.play();
        this.htmlAudio.ontimeupdate = () => {
          this.currentTime$.next(this.htmlAudio.currentTime);
          this.duration$.next(this.htmlAudio.duration || 0);
        };
      }
      this.isPaused$.next(false);
    } catch (e) {
      console.warn('Error playing track', e);
    }

    this.setupRepeatListener(track);
  }

  setRepeatMode(repeat: boolean) {
    this.repeatMode = repeat;
  }

  setupRepeatListener(track: AudioTrack) {
    if (track.type === 'local' && NativeAudio && NativeAudio.isPlaying) {
      
      if (this.repeatPoll) clearInterval(this.repeatPoll);
      this.repeatPoll = setInterval(async () => {
        if (track.assetId) {
          const res = await NativeAudio.isPlaying({ assetId: track.assetId });
          if (!res.isPlaying && this.repeatMode) {
            await NativeAudio.play({ assetId: track.assetId });
          }
        }
      }, 1000);
    } else if (track.type === 'stream' && this.htmlAudio) {
      this.htmlAudio.onended = async () => {
        if (this.repeatMode) {
          this.htmlAudio.currentTime = 0;
          await this.htmlAudio.play();
        }
      };
    }
  }

  async togglePlayPause() {
    const track = this.currentTrack$.value;
    if (!track) {
      this.isPaused$.next(true);
      return;
    }

    try {
      if (track.type === 'local') {
        if (this.isPaused$.value) {
          if (NativeAudio && NativeAudio.resume) {
            await NativeAudio.resume({ assetId: track.assetId });
          } else if (NativeAudio && NativeAudio.play) {
            await NativeAudio.play({ assetId: track.assetId });
          }
          this.isPaused$.next(false);
        } else {
          if (NativeAudio && NativeAudio.pause) {
            await NativeAudio.pause({ assetId: track.assetId });
          } else if (NativeAudio && NativeAudio.stop) {
            await NativeAudio.stop({ assetId: track.assetId });
          }
          this.isPaused$.next(true);
        }
      } else if (track.type === 'stream') {
        if (this.isPaused$.value) {
          await this.htmlAudio.play();
          this.isPaused$.next(false);
        } else {
          this.htmlAudio.pause();
          this.isPaused$.next(true);
        }
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

  setCurrentTrack(track: AudioTrack, playlist: AudioTrack[]) {
    this.currentTrack$.next(track);
    this.playlist$.next(playlist);
  }

  clearRepeatPoll() {
    if (this.repeatPoll) {
      clearInterval(this.repeatPoll);
      this.repeatPoll = null;
    }
  }

  async pause() {
    const track = this.currentTrack$.value;
    if (!track) return;
    this.clearRepeatPoll();
    if (track.type === 'local' && NativeAudio && NativeAudio.pause) {
      await NativeAudio.pause({ assetId: track.assetId });
    } else if (track.type === 'stream' && this.htmlAudio) {
      this.htmlAudio.pause();
    }
    this.isPaused$.next(true);
  }

  async resume() {
    const track = this.currentTrack$.value;
    if (!track) return;
    if (track.type === 'local' && NativeAudio && NativeAudio.resume) {
      await NativeAudio.resume({ assetId: track.assetId });
    } else if (track.type === 'stream' && this.htmlAudio) {
      await this.htmlAudio.play();
    }
    this.isPaused$.next(false);
  }

  restoreTrackState(track: AudioTrack, playlist: AudioTrack[], isPaused: boolean = true) {
    this.currentTrack$.next(track);
    this.playlist$.next(playlist);
    const idx = playlist.findIndex(t =>
      (t.assetId && track.assetId && t.assetId === track.assetId) ||
      (t.src && track.src && t.src === track.src)
    );
    this.currentIndex$.next(idx);
    this.isPaused$.next(isPaused);

    if (track) {
      if (track.type === 'stream') {
        this.htmlAudio.src = track.src;
        this.htmlAudio.load();
        if (!isPaused) {
          this.htmlAudio.play();
        }
      } else if (track.type === 'local' && NativeAudio && track.assetId) {
        if (!isPaused) {
          if (NativeAudio.resume) {
            NativeAudio.resume({ assetId: track.assetId });
          } else if (NativeAudio.play) {
            NativeAudio.play({ assetId: track.assetId });
          }
        }
      }
    }
  }

  seekTo(seconds: number) {
    const track = this.currentTrack$.value;
    if (!track) return;
    if (track.type === 'stream') {
      this.htmlAudio.currentTime = seconds;
    }
  }

  async stop() {
    const track = this.currentTrack$.value;
    if (!track) return;
    this.clearRepeatPoll();
    try {
      if (track.type === 'local' && NativeAudio && NativeAudio.stop) {
        await NativeAudio.stop({ assetId: track.assetId });
      } else if (track.type === 'stream' && this.htmlAudio) {
        this.htmlAudio.pause();
        this.htmlAudio.currentTime = 0;
      }
    } catch (e) {
      console.warn('Error stopping track', e);
    }
    this.currentTrack$.next(null);
    this.isPaused$.next(true);
  }

}
