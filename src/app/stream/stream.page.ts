import { Component } from '@angular/core';
import { DeezerService } from '../services/deezer/deezer.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-stream',
  templateUrl: './stream.page.html',
  styleUrls: ['./stream.page.scss'],
  standalone: false
})
export class StreamPage {
  searchQuery = '';
  deezerTracks: any[] = [];
  deezerArtists: any[] = [];
  deezerAlbums: any[] = [];
  deezerCharts: any = null;
  deezerRadios: any = null;
  selectedRadioTracks: any[] = [];
  errorMessage = '';
  audio = new Audio();

  constructor(
    private deezer: DeezerService,
    private alertController: AlertController
  ) {}

  async searchDeezerTracks() {
    if (!this.searchQuery.trim()) {
      this.deezerTracks = [];
      this.showErrorAlert('Please enter a search term.');
      return;
    }

    try {
      this.deezerTracks = await this.deezer.searchTracks(this.searchQuery);
      if (!this.deezerTracks || this.deezerTracks.length === 0) {
        this.showErrorAlert('No tracks found.');
      }
    } catch (err) {
      this.handleError('tracks', err);
    }
  }

  async searchDeezerArtists() {
    this.errorMessage = '';
    if (!this.searchQuery.trim()) {
      this.deezerArtists = [];
      this.showErrorAlert('Please enter a search term.');
      return;
    }

    try {
      this.deezerArtists = await this.deezer.searchArtists(this.searchQuery);
      if (!this.deezerArtists || this.deezerArtists.length === 0) {
        this.showErrorAlert('No artists found.');
      }
    } catch (err) {
      this.handleError('artists', err);
    }
  }

  async searchDeezerAlbums() {
    this.errorMessage = '';
    if (!this.searchQuery.trim()) {
      this.deezerAlbums = [];
      this.showErrorAlert('Please enter a search term.');
      return;
    }

    try {
      this.deezerAlbums = await this.deezer.searchAlbums(this.searchQuery);
      if (!this.deezerAlbums || this.deezerAlbums.length === 0) {
        this.showErrorAlert('No albums found.');
      }
    } catch (err) {
      this.handleError('albums', err);
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
