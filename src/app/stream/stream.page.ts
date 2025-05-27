import { Component, OnInit } from '@angular/core';
import { DeezerService } from '../services/deezer/deezer.service';
import { AlertController, LoadingController } from '@ionic/angular';
import { AudioPlayerService } from 'src/app/services/audio-player/audioplayer.service';

@Component({
  selector: 'app-stream',
  templateUrl: './stream.page.html',
  styleUrls: ['./stream.page.scss'],
  standalone: false
})
export class StreamPage implements OnInit {
  searchQuery = '';
  deezerTracks: any[] = [];
  deezerArtists: any[] = [];
  deezerAlbums: any[] = [];
  deezerCharts: any = null;
  deezerRadios: any = null;
  selectedRadioTracks: any[] = [];
  selectedAlbumTracks: any[] = [];
  audio = new Audio();
  isViewingAlbumTracks = false;
  isViewingArtistAlbums = false;
  selectedArtistAlbums: any[] = [];
  selectedArtistName = '';
  isLoadingCharts = false;
  constructor(
    private deezer: DeezerService,
    private alertController: AlertController,
    public audioPlayer: AudioPlayerService,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.loadCharts();
    this.loadRadios();
  }

  async searchDeezerTracks() {
    this.deezerArtists = [];
    this.deezerAlbums = [];
    this.deezerTracks = [];
    if (!this.searchQuery.trim()) {
      this.showErrorAlert('Please enter a search term.');
      return;
    }
    const loading = await this.loadingController.create({
      message: 'Searching tracks...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      this.deezerTracks = await this.deezer.searchTracks(this.searchQuery);
      if (!this.deezerTracks || this.deezerTracks.length === 0) {
        await this.showNoResultsAlert('No tracks found.');
      }
    } catch (err) {
      this.showErrorAlert('Error searching tracks.');
    } finally {
      await loading.dismiss();
    }
  }

  async searchDeezerArtists() {
    this.deezerTracks = [];
    this.deezerAlbums = [];
    this.deezerArtists = [];
    if (!this.searchQuery.trim()) {
      this.showErrorAlert('Please enter a search term.');
      return;
    }
    const loading = await this.loadingController.create({
      message: 'Searching artists...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      this.deezerArtists = await this.deezer.searchArtists(this.searchQuery);
      if (!this.deezerArtists || this.deezerArtists.length === 0) {
        await this.showNoResultsAlert('No artists found.');
      }
    } catch (err) {
      this.showErrorAlert('Error searching artists.');
    } finally {
      await loading.dismiss();
    }
  }

  async searchDeezerAlbums() {
    this.deezerTracks = [];
    this.deezerArtists = [];
    this.deezerAlbums = [];
    if (!this.searchQuery.trim()) {
      this.showErrorAlert('Please enter a search term.');
      return;
    }
    const loading = await this.loadingController.create({
      message: 'Searching albums...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      this.deezerAlbums = await this.deezer.searchAlbums(this.searchQuery);
      if (!this.deezerAlbums || this.deezerAlbums.length === 0) {
        await this.showNoResultsAlert('No albums found.');
      }
    } catch (err) {
      this.showErrorAlert('Error searching albums.');
    } finally {
      await loading.dismiss();
    }
  }

  async loadCharts() {
    
    this.isLoadingCharts = true;
    try {
      this.deezerCharts = await this.deezer.getCharts();
      if (
        !this.deezerCharts ||
        !this.deezerCharts.tracks ||
        !this.deezerCharts.tracks.data ||
        this.deezerCharts.tracks.data.length === 0
      ) {
        this.showErrorAlert('No charts found.');
      }
    } catch (err) {
      this.handleError('charts', err);
    } finally {
      this.isLoadingCharts = false;
    }
  }

  async loadRadios() {
    try {
      this.deezerRadios = await this.deezer.getRadios();
      if (!this.deezerRadios || !this.deezerRadios.data || this.deezerRadios.data.length === 0) {
        this.showErrorAlert('No radios found.');
      }
    } catch (err) {
      this.handleError('radios', err);
    }
  }


  async loadRadioTracks(radioId: number) {
    try {
      this.selectedRadioTracks = await this.deezer.getRadioTracks(radioId);
    } catch (err) {
      this.selectedRadioTracks = [];
      this.showErrorAlert('Could not load radio songs.');
    }
  }

  async showAlbumTracks(albumId: number) {
    this.isViewingAlbumTracks = true;
    this.selectedAlbumTracks = [];
    // Do NOT clear this.deezerAlbums, this.deezerTracks, etc.
    try {
      this.selectedAlbumTracks = await this.deezer.getAlbumTracks(albumId);
    } catch (err) {
      this.selectedAlbumTracks = [];
      this.showErrorAlert('Could not load album tracks.');
    }
  }

  async backToAlbums() {
    this.isViewingAlbumTracks = false;
    this.selectedAlbumTracks = [];
    // Reload albums using the current search query
    if (this.searchQuery && this.searchQuery.trim()) {
      this.deezerAlbums = await this.deezer.searchAlbums(this.searchQuery);
    }
  }

  async showArtistAlbums(artist: any) {
    this.isViewingArtistAlbums = true;
    this.selectedArtistAlbums = [];
    this.selectedArtistName = artist.name;
    // Do NOT clear this.deezerArtists, this.deezerTracks, etc.
    try {
      this.selectedArtistAlbums = await this.deezer.getArtistAlbums(artist.id);
    } catch (err) {
      this.selectedArtistAlbums = [];
      this.showErrorAlert('Could not load artist albums.');
    }
  }

  async backToArtists() {
    this.isViewingArtistAlbums = false;
    this.selectedArtistAlbums = [];
    // Reload artists using the current search query
    if (this.searchQuery && this.searchQuery.trim()) {
      this.deezerArtists = await this.deezer.searchArtists(this.searchQuery);
    }
  }

  backToRadios() {
    this.selectedRadioTracks = [];
  }

  async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async showNoResultsAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'No Results',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  handleError(context: string, err: any) {
    const error = err as any;
    const msg = `Error loading ${context}: ${error.message || err}`;
    this.showErrorAlert(msg);
  }

  clearSearchAndShowCharts() {
    this.searchQuery = '';
    this.deezerTracks = [];
    this.deezerArtists = [];
    this.deezerAlbums = [];
    this.isViewingArtistAlbums = false;
    this.isViewingAlbumTracks = false;
  }

  playDeezerTrack(track: any, playlist: any[]) {
    this.audioPlayer.playTrack({
      src: track.preview,
      type: 'stream',
      name: track.title || '',
      artist: track.artist ? track.artist : { name: track.artist_name || 'Unknown Artist' },
      album: track.album ? track.album : { cover: (track.album?.cover || track.cover || 'assets/placeholder.png'), title: track.album?.title || '' }
    }, playlist);
  }
}