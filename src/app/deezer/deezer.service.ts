import { Injectable } from '@angular/core';
import { Http } from '@capacitor-community/http';

@Injectable({
  providedIn: 'root'
})
export class DeezerService {
  private baseUrl = 'https://api.deezer.com';

  constructor() {}

  async searchTracks(query: string): Promise<any[]> {
    const response = await Http.get({
      url: `${this.baseUrl}/search`,
      params: { q: query || '' }
      // Do NOT add headers if you don't need them
    });
    return response.data.data;
  }

  async searchArtists(query: string): Promise<any[]> {
    const response = await Http.get({url: `${this.baseUrl}/search/artist`,params: { q: query || '' }});
    return response.data.data;
  }

  async searchAlbums(query: string): Promise<any[]> {
    const response = await Http.get({ url: `${this.baseUrl}/search/album?q=${encodeURIComponent(query)}` });
    return response.data.data;
  }

  async getCharts(): Promise<any> {
    const response = await Http.get({ url: `${this.baseUrl}/chart` });
    return response.data;
  }

  async getRadios(): Promise<any> {
    const response = await Http.get({ url: `${this.baseUrl}/radio` });
    return response.data;
  }
}
