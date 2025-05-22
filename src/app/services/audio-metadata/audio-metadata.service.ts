import { Injectable } from '@angular/core';
import { parseBlob } from 'music-metadata-browser';

@Injectable({ providedIn: 'root' })
export class AudioMetadataService {
  async extractMetadata(file: File): Promise<{ picture?: string, artist?: string, album?: string }> {
    let picture: string | undefined;
    let artist: string | undefined;
    let album: string | undefined;
    try {
      const metadata = await parseBlob(file);
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        const blob = new Blob([pic.data], { type: pic.format });
        picture = URL.createObjectURL(blob);
      }
      artist = metadata.common.artist;
      album = metadata.common.album;
    } catch (err) {
      console.warn('Metadata extraction failed:', err);
    }
    return { picture, artist, album };
  }
}
