import { Component } from '@angular/core';
import { NativeAudio } from '@capacitor-community/native-audio';
import { ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import { App } from '@capacitor/app';
import { PlaylistService } from '../services/playlist/playlist.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AudioPlayerService } from '../services/audioplayer/audioplayer.service'
import { AudioLibraryService } from '../services/audio-library/audio-library.service';
import { UserPreferencesService } from '../services/user-preference/user-preference.service';
import { AudioMetadataService } from '../services/audio-metadata/audio-metadata.service';

export type AudioItem = {
  assetId: string;
  name: string;
  fileName: string; 
  picture?: string; 
  artist?: string;
  album?: string;
};

@Component({
  selector: 'app-local',
  templateUrl: './local.page.html',
  styleUrls: ['./local.page.scss'],
  standalone: false,
})
export class LocalPage {
  loadedAudios: AudioItem[] = [];
  isCardExpanded = false;
  private currentToast: HTMLIonToastElement | null = null;
  audioView: 'all' | 'playlists' = 'all';
  playlists: any[] = [];
  selectedPlaylist: any = null;
  currentTrackSnapshot?: AudioItem;
  isPausedSnapshot = false;
  preloadedAssets: Set<string> = new Set();
  repeatMode: boolean = false;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private playlistService: PlaylistService,
    private router: Router,
    private route: ActivatedRoute,
    public audioPlayer: AudioPlayerService,
    private audioLibrary: AudioLibraryService,
    private userPreferences: UserPreferencesService,
    private audioMetadata: AudioMetadataService,
  ) {
    this.route.queryParams.subscribe(params => {
      if (params['segment'] === 'playlists') {
        this.audioView = 'playlists';
      }
    });

    // Load audios immediately in constructor
    this.restoreAudios();

    App.addListener('backButton', () => {
      if (this.isCardExpanded) {
        this.toggleCard();
      } else {
        App.exitApp();
      }
    });

    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) {
        // App going to background - save current state
        const currentTrack = this.audioPlayer.currentTrack$.value;
        const isPaused = this.audioPlayer.isPaused$.value;

        if (currentTrack) {
          await this.userPreferences.setPreference('lastPlayedTrack', currentTrack.assetId);
          await this.userPreferences.setPreference('wasPlaying', !isPaused);

          // Pause playback (don't stop completely)
          if (!isPaused) {
            await this.audioPlayer.pause();
          }
        }
      } else {
        // App coming back to foreground - restore state
        console.log('App resumed - restoring state');

        // First, restore the audio list
        await this.restoreAudios();

        // Then restore the last played track
        const lastPlayedAssetId = await this.userPreferences.getPreference('lastPlayedTrack');
        const wasPlaying = await this.userPreferences.getPreference('wasPlaying');

        if (lastPlayedAssetId && this.loadedAudios.length > 0) {
          const track = this.loadedAudios.find(a => a.assetId === lastPlayedAssetId);
          if (track) {
            // Restore the track state without auto-playing
            this.audioPlayer.restoreTrackState(track, this.loadedAudios, !wasPlaying);

            // If user was playing music, resume it
            if (wasPlaying) {
              setTimeout(async () => {
                try {
                  await this.audioPlayer.resume();
                } catch (e) {
                  console.warn('Could not resume playback:', e);
                }
              }, 500);
            }
          }
        }
      }
    });
  }

  async ngOnInit() {
    await this.restoreAudios();
     await this.audioLibrary.debugAudioListStorage();
    this.audioPlayer.currentTrack$.subscribe(track => {
      this.currentTrackSnapshot = track;
    });
    this.audioPlayer.isPaused$.subscribe(paused => {
      this.isPausedSnapshot = paused;
    });
    const savedView = await this.userPreferences.getPreference('audioView');
    if (savedView) {
      this.audioView = savedView;
    }
  }

  async ionViewWillEnter() {
    await this.restoreAudios();

    this.playlists = (await this.playlistService.getPlaylists())
      .filter(p => !!p)
      .map(p => ({
        ...p,
        tracks: Array.isArray(p.tracks) ? p.tracks : []
      }));

    this.audioPlayer.currentTrack$.subscribe(track => {
      this.currentTrackSnapshot = track;
    });
    this.audioPlayer.isPaused$.subscribe(paused => {
      this.isPausedSnapshot = paused;
    });

    // Only restore track if we don't already have one and there's no current playback
    if (!this.audioPlayer.currentTrack$.value) {
      const lastPlayedAssetId = await this.userPreferences.getPreference('lastPlayedTrack');
      if (lastPlayedAssetId && this.loadedAudios.length > 0) {
        const track = this.loadedAudios.find(a => a.assetId === lastPlayedAssetId);
        if (track) {
          this.audioPlayer.restoreTrackState(track, this.loadedAudios, true);
        }
      }
    }
  }

  async handleMultipleFiles(event: any) {
    const supportedExtensions = ['aac', 'm4a', 'mp3', 'wav', 'ogg', 'flac', 'opus'];
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    let addedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    let unsupportedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !supportedExtensions.includes(extension)) {
        unsupportedCount++;
        continue;
      }
      const assetId = `audio-${Date.now()}-${i}`;
      const fileName = `${assetId}.${extension}`;
      try {
        const result = await this.audioLibrary.addAndPreloadAudio(
          file,
          assetId,
          fileName,
          this.audioMetadata.extractMetadata.bind(this.audioMetadata)
        );
        if (result.status === 'duplicate') {
          duplicateCount++;
        } else if (result.status === 'added') {
          addedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    if (addedCount > 1) {
      this.presentToast(`${addedCount} songs added!`, 'success');
    } else if (addedCount === 1) {
      this.presentToast(`Song added!`, 'success');
    }
    if (duplicateCount > 0) {
      this.presentToast(`${duplicateCount} duplicate file(s) skipped.`, 'danger');
    }
    if (unsupportedCount > 0) {
      this.presentToast(`${unsupportedCount} unsupported file(s) skipped.`, 'danger');
    }
    if (failedCount > 0) {
      this.presentToast(`${failedCount} file(s) failed to load.`, 'danger');
    }

    await this.restoreAudios();
  }

  async restoreAudios() {
    try {
      this.loadedAudios = await this.audioLibrary.restoreAudiosFromStorage();
      console.log('Loaded audios:', this.loadedAudios);

      // Ensure the current track is in loadedAudios if it exists
      const currentTrack = this.audioPlayer.currentTrack$.value;
      if (currentTrack && !this.loadedAudios.some(a => a.assetId === currentTrack.assetId)) {
        this.loadedAudios.push(currentTrack);
      }
    } catch (error) {
      console.error('Error restoring audios:', error);
      this.loadedAudios = [];
    }
  }
  

  async unloadAudio(assetId: string) {
    const audio = this.loadedAudios.find(a => a.assetId === assetId);
    if (audio) {
      await this.audioLibrary.unloadAudioFile(audio);
      this.loadedAudios = this.loadedAudios.filter(a => a.assetId !== assetId);
    }
  }

  async confirmAndUnloadAudio(assetId: string) {
    const alert = await this.alertController.create({
      header: 'Delete Audio',
      message: 'Are you sure you want to delete this audio file?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.unloadAudio(assetId);
          }
        }
      ]
    });
    await alert.present();
  }

  playAudio(assetId: string) {
    if (!this.audioLibrary.preloadedAssets.has(assetId)) {
      // Preload before playing
      this.audioLibrary.preloadAudio(assetId).then(() => {
        this.audioPlayer.playTrack(
          this.loadedAudios.find(a => a.assetId === assetId),
          this.loadedAudios
        );
        this.userPreferences.setPreference('lastPlayedTrack', assetId);
      }).catch(() => {
        this.presentToast('Audio failed to preload.', 'danger');
      });
      return;
    }
    const track = this.loadedAudios.find(a => a.assetId === assetId);
    if (track) {
      this.audioPlayer.playTrack(track, this.loadedAudios);
      this.userPreferences.setPreference('lastPlayedTrack', assetId);
    }
  }

  async loopAudio(assetId: string) {
    await NativeAudio.loop({ assetId });
  }

  async stopAllAudios() {
    for (const audio of this.loadedAudios) {
      try {
        await NativeAudio.stop({ assetId: audio.assetId });
      } catch (e) {
       
      }
    }
  }

  async getDuration(assetId: string) {
    const result = await NativeAudio.getDuration({ assetId });
    return result.duration;
  }

  async getCurrentTime(assetId: string) {
    const result = await NativeAudio.getCurrentTime({ assetId });
    console.log(`Current Time:`, result.currentTime);
  }

  toggleCard() {
    this.isCardExpanded = !this.isCardExpanded;
  }

  async presentToast(message: string, color: 'success' | 'danger' = 'danger') {
    if (this.currentToast) {
      await this.currentToast.dismiss();
      this.currentToast = null;
    }
    this.currentToast = await this.toastController.create({
      message,
      color,
      position: 'bottom',
      duration: 3000
    });
    await this.currentToast.present();
  }

  async presentAudioOptions(event: Event, audio: AudioItem) {
    event.stopPropagation();
    const actionSheet = await this.actionSheetController.create({
      header: audio.name,
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          icon: 'trash',
          handler: () => this.unloadAudio(audio.assetId)
        },
        {
          text: 'Get Duration',
          icon: 'time',
          handler: async () => {
            const duration = await this.getDuration(audio.assetId);
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            this.presentToast(`Duration: ${mins}:${secs.toString().padStart(2, '0')}`, 'success');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });
    await actionSheet.present();
  }

  // To create a playlist
  async createPlaylist() {
    const alert = await this.alertController.create({
      header: 'New Playlist',
      inputs: [{ name: 'name', type: 'text', placeholder: 'Playlist Name' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Create',
          handler: async (data) => {
            if (data.name) {
              await this.playlistService.addPlaylist(data.name);
              this.playlists = (await this.playlistService.getPlaylists())
                .filter(p => !!p) // remove null/undefined
                .map(p => ({
                  ...p,
                  tracks: Array.isArray(p.tracks) ? p.tracks : []
                }));
              this.presentToast('Playlist created!', 'success');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // To add a track to a playlist
  async addToPlaylist(audio: AudioItem) {
    const playlists = await this.playlistService.getPlaylists();
    const alert = await this.alertController.create({
      header: 'Add to Playlist',
      inputs: playlists.map(p => ({
        type: 'radio',
        label: p.name,
        value: p.name
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: async (playlistName) => {
            await this.playlistService.addTrackToPlaylist(playlistName, audio);
            this.presentToast('Track added to playlist!', 'success');
           
            this.playlists = (await this.playlistService.getPlaylists())
              .filter(p => !!p)
              .map(p => ({
                ...p,
                tracks: Array.isArray(p.tracks) ? p.tracks : []
              }));
          }
        }
      ]
    });
    await alert.present();
  }

  selectPlaylist(playlist: any) {
    this.selectedPlaylist = playlist;
  }

  async openAddToPlaylistModal(playlist: any, event: Event) {
    event.stopPropagation();
    
    const alert = await this.alertController.create({
      header: `Add Songs to "${playlist.name}"`,
      inputs: this.loadedAudios.map(audio => ({
        type: 'checkbox',
        label: audio.artist && audio.album
          ? `${audio.name} (${audio.artist} - ${audio.album})`
          : audio.artist
            ? `${audio.name} (${audio.artist})`
            : audio.album
              ? `${audio.name} (${audio.album})`
              : audio.name,
        value: audio.assetId,
        checked: playlist.tracks.some((t: any) => t.assetId === audio.assetId)
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: async (selectedAssetIds: string[]) => {
            playlist.tracks = this.loadedAudios.filter(audio => selectedAssetIds.includes(audio.assetId));
            await this.playlistService.savePlaylists(this.playlists);
            if (selectedAssetIds.length === 1) {
              this.presentToast('Song added to playlist!', 'success');
            } else if (selectedAssetIds.length > 1) {
              this.presentToast('Songs added to playlist!', 'success');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  goToPlaylistDetail(playlist: any) {
    this.router.navigate(['/playlist-details', playlist.name]);
  }

  isCurrentTrack(audio: AudioItem): boolean {
    return this.currentTrackSnapshot?.assetId === audio.assetId;
  }

  onAudioItemClick(audio: AudioItem) {
    if (!this.currentTrackSnapshot || this.currentTrackSnapshot.assetId !== audio.assetId) {
      this.playAudio(audio.assetId);
    }
  }

  setAudioView(view: 'all' | 'playlists') {
    this.audioView = view;
    this.userPreferences.setPreference('audioView', view);
  }

  async onAudioViewChange(event: any) {
    this.audioView = event.detail.value;
    await this.userPreferences.setPreference('audioView', this.audioView);
  }

  async presentPlaylistOptions(event: Event, playlist: any) {
    event.stopPropagation();
    const actionSheet = await this.actionSheetController.create({
      header: playlist.name,
      buttons: [
        {
          text: 'Rename',
          icon: 'create',
          handler: () => this.onRenamePlaylist(playlist.name)
        },
        {
          text: 'Delete',
          role: 'destructive',
          icon: 'trash',
          handler: () => this.onDeletePlaylist(playlist.name)
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });
    await actionSheet.present();
  }

  async onDeletePlaylist(playlistName: string) {
    await this.playlistService.deletePlaylist(playlistName);
    this.playlists = (await this.playlistService.getPlaylists())
      .filter(p => !!p) // remove null/undefined
      .map(p => ({
        ...p,
        tracks: Array.isArray(p.tracks) ? p.tracks : []
      }));
  }

async onRenamePlaylist(oldName: string) {
  const alert = await this.alertController.create({
    header: 'Rename Playlist',
    inputs: [{ name: 'name', type: 'text', placeholder: 'New Playlist Name' }],
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Rename',
        handler: async (data) => {
          const newName = data.name?.trim();
          if (!newName || newName === oldName) return;

          if (this.playlists.some(p => p.name === newName)) {
            this.presentToast('Playlist name already exists.', 'danger');
            return;
          }

          try {
            await this.playlistService.renamePlaylist(oldName, newName);
            this.playlists = (await this.playlistService.getPlaylists())
              .filter(p => !!p) // remove null/undefined
              .map(p => ({
                ...p,
                tracks: Array.isArray(p.tracks) ? p.tracks : []
              }));
            this.presentToast('Playlist renamed!', 'success');
          } catch (error) {
            console.error('Rename failed', error);
            this.presentToast('Failed to rename playlist.', 'danger');
          }
        }
      }
    ]
  });
  await alert.present();
}

  async toggleRepeat() {
    if (!this.currentTrackSnapshot) return;
    this.repeatMode = !this.repeatMode;
    if (this.repeatMode) {
      await NativeAudio.loop({ assetId: this.currentTrackSnapshot.assetId });
      this.presentToast('Repeat is ON', 'success');
    } else {
      await NativeAudio.stop({ assetId: this.currentTrackSnapshot.assetId });
      await NativeAudio.play({ assetId: this.currentTrackSnapshot.assetId });
      this.presentToast('Repeat is OFF', 'danger');
    }
  }
}
