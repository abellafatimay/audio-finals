import { Component } from '@angular/core';
import { DeezerService } from '../deezer/deezer.service';

@Component({
  selector: 'app-stream',
  templateUrl: './stream.page.html',
  styleUrls: ['./stream.page.scss'],
  standalone: false,
})
export class StreamPage {
  searchQuery = '';
  deezerTracks: any[] = [];
  deezerArtists: any[] = [];
  deezerAlbums: any[] = [];
  deezerCharts: any = null;
  deezerRadios: any = null;
  errorMessage = '';

  constructor(private deezer: DeezerService) {}

  async searchDeezerTracks() {
    this.errorMessage = '';
    try {
      const res = await this.deezer.searchTracks(this.searchQuery);
      this.deezerTracks = res || [];
      this.deezerAlbums = [];
      this.deezerArtists = [];
      if (this.deezerTracks.length === 0) {
        this.errorMessage = 'No tracks found.';
      }
    } catch (err) {
      const error = err as any;
      this.errorMessage = 'Error loading tracks: ' + (error.message || err);
    }
  }

  async searchDeezerArtists() {
    this.errorMessage = '';
    if (!this.searchQuery.trim()) {
      this.deezerArtists = [];
      this.errorMessage = 'Please enter a search term.';
      return;
    }

    try {
      this.deezerArtists = await this.deezer.searchArtists(this.searchQuery);
      if (!this.deezerArtists || this.deezerArtists.length === 0) {
        this.errorMessage = 'No artists found.';
      }
    } catch (err) {
      this.handleError('artists', err);
    }
  }

  async searchDeezerAlbums() {
    this.errorMessage = '';
    if (!this.searchQuery.trim()) {
      this.deezerAlbums = [];
      this.errorMessage = 'Please enter a search term.';
      return;
    }

    try {
      this.deezerAlbums = await this.deezer.searchAlbums(this.searchQuery);
      if (!this.deezerAlbums || this.deezerAlbums.length === 0) {
        this.errorMessage = 'No albums found.';
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
        this.errorMessage = 'No charts found.';
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
        this.errorMessage = 'No radios found.';
      }
    } catch (err) {
      this.handleError('radios', err);
    }
  }

  private handleError(context: string, err: any) {
    const error = err as any;
    this.errorMessage = `Error loading ${context}: ${error.message || err}`;
  }
}
