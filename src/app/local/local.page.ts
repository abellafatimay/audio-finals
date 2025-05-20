import { Component } from '@angular/core';
import { NativeAudio } from '@capacitor-community/native-audio';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { ToastController, AlertController, ActionSheetController, ModalController } from '@ionic/angular';
import { App } from '@capacitor/app';
import { AudioPlayerModalComponent } from '../components/audio-player-modal/audio-player-modal.component';
import { PlaylistService } from '../services/playlist/playlist.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AudioPlayerService } from '../services/audioplayer/audioplayer.service'
import { parseBlob } from 'music-metadata-browser';

type AudioItem = {
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
  errorMessage: string = '';
  private currentToast: HTMLIonToastElement | null = null;
  audioView: 'all' | 'playlists' = 'all';
  playlists: any[] = [];
  selectedPlaylist: any = null;
  currentTrackSnapshot?: AudioItem;
  isPausedSnapshot = false;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private modalController: ModalController,
    private playlistService: PlaylistService,
    private router: Router,
    private route: ActivatedRoute,
    public audioPlayer: AudioPlayerService
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
      if (isActive) {
        await this.stopAllAudios();
      }
    });
  }

  ngOnInit() {
    this.audioPlayer.currentTrack$.subscribe(track => {
      this.currentTrackSnapshot = track;
    });
    this.audioPlayer.isPaused$.subscribe(paused => {
      this.isPausedSnapshot = paused;
    });
  }

  async ionViewWillEnter() {
    this.restoreAudios();
    this.playlists = await this.playlistService.getPlaylists();
  }

  async handleMultipleFiles(event: any) {
    const supportedExtensions = ['aac', 'm4a', 'mp3', 'wav', 'ogg', 'flac', 'opus'];
    this.errorMessage = '';
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !supportedExtensions.includes(extension)) {
        this.presentErrorToast(`Unsupported file type: ${file.name}`);
        continue;
      }

      // Check for duplicate by file name
      if (this.loadedAudios.some(audio => audio.name === file.name)) {
        this.presentErrorToast(`Duplicate file: ${file.name}`);
        continue;
      }

      const assetId = `audio-${Date.now()}-${i}`;
      const fileName = `${assetId}.${extension}`;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = this.arrayBufferToBase64(arrayBuffer);

        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });

        await NativeAudio.preload({
          assetId,
          assetPath: fileUri.uri,
          audioChannelNum: 1,
          isUrl: true,
        });

        // Extract metadata
        let picture: string | undefined;
        let artist: string | undefined;
        let album: string | undefined;
        try {
          const metadata = await parseBlob(file);
          artist = metadata.common.artist;
          album = metadata.common.album;
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            const base64 = btoa(String.fromCharCode(...new Uint8Array(pic.data)));
            picture = `data:${pic.format};base64,${base64}`;
          }
        } catch (metaErr) {
          console.warn('Metadata extraction failed:', metaErr);
        }

        this.loadedAudios.push({ assetId, name: file.name, fileName, picture, artist, album });
        await this.saveAudiosToPreferences();
        this.restoreAudios();
      } catch (err) {
        console.error(`Error loading ${file.name}:`, err);
      }
    }
  }

  async restoreAudios() {
    const stored = await Preferences.get({ key: 'audioList' });
    if (!stored.value) return;
    this.loadedAudios = JSON.parse(stored.value);

    // Preload all audios after restoring
    for (const audio of this.loadedAudios) {
      try {
        const fileUri = await Filesystem.getUri({
          path: audio.fileName,
          directory: Directory.Cache,
        });
        await NativeAudio.preload({
          assetId: audio.assetId,
          assetPath: fileUri.uri,
          audioChannelNum: 1,
          isUrl: true,
        });
      } catch (err) {
        console.error('Failed to preload audio:', audio.name, err);
      }
    }
  }

  async saveAudiosToPreferences() {
    await Preferences.set({
      key: 'audioList',
      value: JSON.stringify(this.loadedAudios),
    });
  }

  async unloadAudio(assetId: string) {
    const audio = this.loadedAudios.find(a => a.assetId === assetId);
    await NativeAudio.unload({ assetId });

    if (audio) {
      try {
        await Filesystem.deleteFile({
          path: audio.fileName,
          directory: Directory.Cache,
        });
      } catch (e) {
      }
    }

    this.loadedAudios = this.loadedAudios.filter(audio => audio.assetId !== assetId);
    await this.saveAudiosToPreferences();
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
      this.audioPlayer.playTrack(track, this.loadedAudios);
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
        // Ignore if not playing
      }
    }
  }

  setVolume(assetId: string, volume: number) {
    NativeAudio.setVolume({ assetId, volume });
  }

  async getDuration(assetId: string) {
    const result = await NativeAudio.getDuration({ assetId });
    console.log(`Duration:`, result.duration);
  }

  async getCurrentTime(assetId: string) {
    const result = await NativeAudio.getCurrentTime({ assetId });
    console.log(`Current Time:`, result.currentTime);
  }

  async isPlaying(assetId: string) {
    const result = await NativeAudio.isPlaying({ assetId });
    console.log(`Is Playing:`, result.isPlaying);
  }

  toggleCard() {
    this.isCardExpanded = !this.isCardExpanded;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  async presentErrorToast(message: string) {
    if (this.currentToast) {
      await this.currentToast.dismiss();
      this.currentToast = null;
    }
    this.currentToast = await this.toastController.create({
      message,
      color: 'danger',
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await this.currentToast.present();
  }

  async presentAudioOptions(event: Event, audio: AudioItem) {
    event.stopPropagation();
    const actionSheet = await this.actionSheetController.create({
      header: audio.name,
      buttons: [
        {
          text: 'Unload',
          role: 'destructive',
          icon: 'trash',
          handler: () => this.unloadAudio(audio.assetId)
        },
        {
          text: 'Get Duration',
          icon: 'time',
          handler: async () => {
            const result = await NativeAudio.getDuration({ assetId: audio.assetId });
            const mins = Math.floor(result.duration / 60);
            const secs = Math.floor(result.duration % 60);
            this.presentErrorToast(`Duration: ${mins}:${secs.toString().padStart(2, '0')}`);
          }
        },
        {
          text: 'Add to Playlist',
          icon: 'add',
          handler: () => this.addToPlaylist(audio)
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

  async openCardModal() {
    // You may want to update this to use audioPlayer service as well
    // or remove if not needed
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
              this.playlists = await this.playlistService.getPlaylists(); // <-- reload playlists here
              this.presentErrorToast('Playlist created!');
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
            this.presentErrorToast('Track added to playlist!');
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
    // Show a modal or alert with all loadedAudios as options
    const alert = await this.alertController.create({
      header: `Add Songs to "${playlist.name}"`,
      inputs: this.loadedAudios.map(audio => ({
        type: 'checkbox',
        label: audio.name,
        value: audio.assetId,
        checked: playlist.tracks.some((t: any) => t.assetId === audio.assetId)
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: async (selectedAssetIds: string[]) => {
            // Add selected audios to playlist
            playlist.tracks = this.loadedAudios.filter(audio => selectedAssetIds.includes(audio.assetId));
            await this.playlistService.savePlaylists(this.playlists);
            this.presentErrorToast('Songs added to playlist!');
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
}

