import { Component } from '@angular/core';
import { NativeAudio } from '@capacitor-community/native-audio';
import { ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import { App } from '@capacitor/app';
import { PlaylistService } from '../services/playlist/playlist.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AudioPlayerService } from '../services/audio-player/audioplayer.service';
import { AudioLibraryService } from '../services/audio-library/audio-library.service';
import { UserPreferencesService } from '../services/user-preference/user-preference.service';
import { AudioMetadataService } from '../services/audio-metadata/audio-metadata.service';
import { AudioTrack } from '../models/audio-track.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-local',
  templateUrl: './local.page.html',
  styleUrls: ['./local.page.scss'],
  standalone: false,
})
export class LocalPage {
  loadedAudios: AudioTrack[] = [];
  isCardExpanded = false;
  private currentToast: HTMLIonToastElement | null = null;
  audioView: 'all' | 'playlists' = 'all';
  playlists: any[] = [];
  selectedPlaylist: any = null;
  currentTrackSnapshot?: AudioTrack;
  isPausedSnapshot = false;
  repeatMode: boolean = false;
  private subscriptions = new Subscription();
  private audiosLoaded = false;
  isLoading = false;
  isLoadingPlaylists = false;

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
        
        const currentTrack = this.audioPlayer.currentTrack$.value;
        const isPaused = this.audioPlayer.isPaused$.value;

        if (currentTrack) {
          await this.userPreferences.setPreference('lastPlayedTrack', currentTrack.assetId);
          await this.userPreferences.setPreference('wasPlaying', !isPaused);

          if (!isPaused) {
            await this.audioPlayer.pause();
          }
        }

        await this.stopAllAudios();
      } else {
        await this.stopAllAudios();
        await this.restoreAudios();

        const lastPlayedAssetId = await this.userPreferences.getPreference('lastPlayedTrack');
        if (lastPlayedAssetId && this.loadedAudios.length > 0) {
          const track = this.loadedAudios.find(a => a.assetId === lastPlayedAssetId);
          if (track) {
            
            this.audioPlayer.restoreTrackState(track, this.loadedAudios, true);
          }
        }
      }
    });
  }

  private subscribeToPlayer() {
    this.subscriptions.add(this.audioPlayer.currentTrack$.subscribe(track => {
      this.currentTrackSnapshot = track;
    }));
    this.subscriptions.add(this.audioPlayer.isPaused$.subscribe(paused => {
      this.isPausedSnapshot = paused;
    }));
  }

  async ngOnInit() {
    await this.stopAllAudios();
    await this.restoreAudios();
    await this.audioLibrary.debugAudioListStorage();
    this.subscribeToPlayer();
    const savedView = await this.userPreferences.getPreference('audioView');
    if (savedView) {
      this.audioView = savedView;
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async ionViewWillEnter() {
    await this.restoreAudios();

    this.playlists = (await this.playlistService.getPlaylists())
      .filter(p => !!p)
      .map(p => ({
        ...p,
        tracks: Array.isArray(p.tracks) ? p.tracks : []
      }));

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
    this.isLoading = true;
    try {
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
        const assetId = this.audioLibrary.generateAssetId(file);
        const fileName = `${assetId}.${extension}`;
        const result = await this.audioLibrary.addAndPreloadAudio(
          file,
          assetId,
          fileName,
          this.audioMetadata.extractMetadata.bind(this.audioMetadata)
        );
        if (result.status === 'duplicate') {
          duplicateCount++;
        } else if (result.status === 'too_large') {
          failedCount++;
          this.presentToast(`File too large: ${file.name}`, 'danger');
        } else if (result.status === 'added') {
          addedCount++;
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

      this.audiosLoaded = false;
      await this.restoreAudios();
    } finally {
      this.isLoading = false;
    }
  }

  async preloadAllAudios() {
    for (const audio of this.loadedAudios) {
      if (audio.assetId && audio.src) {
        try {
          await NativeAudio.preload({ assetId: audio.assetId, assetPath: audio.src });
        } catch (e) {
        }
      }
    }
  }

  async restoreAudios() {
    if (this.audiosLoaded) return;
    try {
      this.loadedAudios = await this.audioLibrary.restoreAudiosFromStorage();
      this.audiosLoaded = true;

      await this.preloadAllAudios();

      const currentTrack = this.audioPlayer.currentTrack$.value;
      if (currentTrack && !this.loadedAudios.some(a => a.assetId === currentTrack.assetId)) {
        this.loadedAudios.push(currentTrack);
      }
    } catch (error) {
      console.error('Error restoring audios:', error);
      this.loadedAudios = [];
      this.audiosLoaded = false;
    }
  }
  

  async unloadAudio(assetId: string) {
    const audio = this.loadedAudios.find(a => a.assetId === assetId);
    if (audio) {
      if (this.currentTrackSnapshot?.assetId === assetId) {
        try {
          await this.audioPlayer.pause();
        } catch (e) {
        }
        this.audioPlayer.currentTrack$.next(null);
        this.audioPlayer.isPaused$.next(true);
        this.isPausedSnapshot = false;
      }
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
    const track = this.loadedAudios.find(a => a.assetId === assetId);
    if (track) {
      if (!track.type) {
        track.type = 'local';
      }
      this.audioPlayer.playTrack(track, this.loadedAudios);
      NativeAudio.isPlaying({ assetId }).then(res => {
        console.log('Native isPlaying:', res.isPlaying);
      });
      this.userPreferences.setPreference('lastPlayedTrack', assetId);
    } else {
      this.presentToast('Audio track not found.', 'danger');
    }
  }

  async loopAudio(assetId: string) {
    await NativeAudio.loop({ assetId });
  }

  async stopAllAudios() {
    for (const audio of this.loadedAudios) {
      try {
        if (audio.assetId) {
          await NativeAudio.stop({ assetId: audio.assetId });
        }
      } catch (e) {
       console.error(`Failed to stop audio with assetId: ${audio.assetId}`, e);
      }
    }
  }

  async getDuration(assetId: string) {
    const result = await NativeAudio.getDuration({ assetId });
    return result.duration;
  }

  async getCurrentTime(assetId: string) {
    try {
      const result = await NativeAudio.getCurrentTime({ assetId });
      console.log('Current Time:', result.currentTime);
    } catch (error) {
      console.error('Error getting current time:', error);
      this.presentToast('Failed to get current time.', 'danger');
    }
  }

  toggleCard() {
    this.isCardExpanded = !this.isCardExpanded;
  }

  async presentToast(message: string, color: 'success' | 'danger' = 'danger') {
    if (this.currentToast) {
      await this.currentToast.dismiss();
    }
    this.currentToast = await this.toastController.create({
      message,
      color,
      position: 'bottom',
      duration: 3000
    }); 
    await this.currentToast.present();
  }

  async presentAudioOptions(event: Event, audio: AudioTrack) {
    event.stopPropagation();
    const actionSheet = await this.actionSheetController.create({
      header: audio.name,
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          icon: 'trash',
          handler: () => {
            if (audio.assetId) {
              this.unloadAudio(audio.assetId);
            }
          }
        },
        {
          text: 'Get Duration',
          icon: 'time',
          handler: async () => {
            if (audio.assetId) {
              try {
                const duration = await this.getDuration(audio.assetId);
                const mins = Math.floor(duration / 60);
                const secs = Math.floor(duration % 60);
                this.presentToast(`Duration: ${mins}:${secs.toString().padStart(2, '0')}`, 'success');
              } catch (error) {
                this.presentToast('Failed to get duration.', 'danger');
              }
            } else {
              this.presentToast('Duration not available for this track.', 'danger');
            }
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

  goToPlaylistDetail(playlist: any) {
    this.router.navigate(['/playlist-details', playlist.name]);
  }

  isCurrentTrack(audio: AudioTrack): boolean {
    return this.currentTrackSnapshot?.assetId === audio.assetId;
  }

  onAudioTrackClick(audio: AudioTrack) {
    if (audio.assetId) {
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

  // To create a playlist
  async createPlaylist() {
    const alert = await this.alertController.create({
      header: 'New Playlist',
      inputs: [{ name: 'name', type: 'text', placeholder: 'Enter playlist name' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Create',
          handler: async (data) => {
            if (data.name) {
              await this.playlistService.addPlaylist(data.name);
              this.playlists = (await this.playlistService.getPlaylists())
                .filter(p => !!p) 
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

  async addToPlaylist(audio: AudioTrack) {
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

            const playlist = this.playlists.find(p => p.name === playlistName);
            if (playlist && playlist.tracks) {
              const track = playlist.tracks.find((t: { assetId: string | undefined; }) => t.assetId === audio.assetId);
              if (track) {
                this.audioPlayer.playTrack(track, playlist.tracks);
              }
            }
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
            playlist.tracks = this.loadedAudios.filter(audio => audio.assetId && selectedAssetIds.includes(audio.assetId));
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
      .filter(p => !!p)
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
              .filter(p => !!p)
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
    this.repeatMode = !this.repeatMode;
    this.audioPlayer.setRepeatMode(this.repeatMode);
    await this.presentToast(
      this.repeatMode ? 'Repeat mode enabled' : 'Repeat mode disabled',
      this.repeatMode ? 'success' : 'danger'
    );
  }

  togglePlayPause() {
    if (!this.currentTrackSnapshot && this.loadedAudios.length > 0) {
      const firstAssetId = this.loadedAudios[0].assetId;
      if (firstAssetId) {
        this.playAudio(firstAssetId);
      }
      return;
    }
    if (this.isPausedSnapshot) {
      this.audioPlayer.resume();
    } else {
      this.audioPlayer.pause();
    }
  }

  async playNext() {
  if (!this.currentTrackSnapshot && this.loadedAudios.length > 0) {
    const assetId = this.loadedAudios[0].assetId;
    if (assetId) {
      this.playAudio(assetId);
    }
    return;
  }
  this.audioPlayer.playNext();
}

async playPrevious() {
  if (!this.currentTrackSnapshot && this.loadedAudios.length > 0) {
    const firstAssetId = this.loadedAudios[0].assetId;
    if (firstAssetId) {
      this.playAudio(firstAssetId);
    }
    return;
  }
  this.audioPlayer.playPrevious();
}

async refreshPlaylists() {
  this.isLoadingPlaylists = true;
  try {
    this.playlists = (await this.playlistService.getPlaylists())
      .filter(p => !!p)
      .map(p => ({
        ...p,
        tracks: Array.isArray(p.tracks) ? p.tracks : []
      }));
  } finally {
    this.isLoadingPlaylists = false;
  }
}

async doRefresh(event: any) {
  await this.refreshPlaylists();
  event.target.complete();
}
}