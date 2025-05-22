import { Component, OnInit } from '@angular/core';
import { DeezerService } from '../services/deezer/deezer.service';
import { AlertController } from '@ionic/angular';

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
  errorMessage = '';
  audio = new Audio();
  isViewingAlbumTracks = false;
  isViewingArtistAlbums = false;
  selectedArtistAlbums: any[] = [];
  selectedArtistName = '';

  constructor(
    private deezer: DeezerService,
    private alertController: AlertController
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
    try {
      this.deezerTracks = await this.deezer.searchTracks(this.searchQuery);
    } catch (err) {
      this.showErrorAlert('Error searching tracks.');
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
    try {
      this.deezerArtists = await this.deezer.searchArtists(this.searchQuery);
    } catch (err) {
      this.showErrorAlert('Error searching artists.');
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
    try {
      this.deezerAlbums = await this.deezer.searchAlbums(this.searchQuery);
    } catch (err) {
      this.showErrorAlert('Error searching albums.');
    }
  }

  async loadCharts() {
    this.errorMessage = '';
    try {
      this.deezerCharts = await this.deezer.getCharts();
      if (!this.deezerCharts || !this.deezerCharts.tracks || !this.deezerCharts.tracks.data || this.deezerCharts.tracks.data.length === 0) {
        this.showErrorAlert('No charts found.');
      }
    } catch (err) {
      this.handleError('charts', err);
    }
  }

  async loadRadios() {
    this.errorMessage = '';
    try {
      this.deezerRadios = await this.deezer.getRadios();
      if (!this.deezerRadios || !this.deezerRadios.data || this.deezerRadios.data.length === 0) {
        this.showErrorAlert('No radios found.');
      }
    } catch (err) {
      this.handleError('radios', err);
    }
  }

  playPreview(previewUrl: string) {
    this.audio.pause();
    this.audio.src = previewUrl;
    this.audio.load();
    this.audio.play();
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
    this.deezerAlbums = []; // Clear albums list
    // Optionally clear other lists if needed
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
    // Clear other lists
    this.deezerTracks = [];
    this.deezerAlbums = [];
    this.deezerArtists = [];
    this.selectedAlbumTracks = [];
    this.selectedRadioTracks = [];
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

  handleError(context: string, err: any) {
    const error = err as any;
    const msg = `Error loading ${context}: ${error.message || err}`;
    this.showErrorAlert(msg);
  }
}