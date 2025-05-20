import { Injectable } from '@angular/core';
import { Http } from '@capacitor-community/http';

@Injectable({
  providedIn: 'root'
})
export class DeezerService {
  private baseUrl = 'https://api.deezer.com';

  async searchTracks(query: string): Promise<any[]> {
    const response = await Http.get({
      url: `${this.baseUrl}/search`,
      params: { q: query || '' },
      headers: {} 
    });
    return response.data.data;
  }

  async searchArtists(query: string): Promise<any[]> {
    const response = await Http.get({
      url: `${this.baseUrl}/search/artist`,
      params: { q: query || '' },
      headers: {} 
    });
    return response.data.data;
  }

  async searchAlbums(query: string): Promise<any[]> {
    const response = await Http.get({
      url: `${this.baseUrl}/search/album`,
      params: { q: query || '' },
      headers: {}
    });
    return response.data.data;
  }

  async getCharts(): Promise<any> {
    const response = await Http.get({
      url: `${this.baseUrl}/chart`,
      params: {},
      headers: {}
    });
    return response.data;
  }

  async getRadios(): Promise<any> {
    const response = await Http.get({
      url: `${this.baseUrl}/radio`,
      params: {},
      headers: {} 
    });
    return response.data;
  }

  async getRadioTracks(radioId: number): Promise<any[]> {
    const response = await Http.get({
      url: `${this.baseUrl}/radio/${radioId}/tracks`,
      params: {},
      headers: {}
    });
    return response.data.data;
  }
}


