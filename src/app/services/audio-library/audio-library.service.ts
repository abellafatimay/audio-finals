import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { NativeAudio } from '@capacitor-community/native-audio';

@Injectable({
  providedIn: 'root'
})
export class AudioLibraryService {
  private audioListKey = 'audioList';

  preloadedAssets: Set<string> = new Set();

  constructor() { }

  async saveAudioList(audioList: any[]) {
    await Preferences.set({
      key: this.audioListKey,
      value: JSON.stringify(audioList),
    });
  }

  async getAudioList(): Promise<any[]> {
    const stored = await Preferences.get({ key: this.audioListKey });
    return stored.value ? JSON.parse(stored.value) : [];
  }

  async addAudio(audio: any) {
    const list = await this.getAudioList();
    list.push(audio);
    await this.saveAudioList(list);
  }

  async removeAudio(assetId: string) {
    const list = await this.getAudioList();
    const updated = list.filter(a => a.assetId !== assetId);
    await this.saveAudioList(updated);
  }

  generateAssetId(file: File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const fileHash = this.simpleFileHash(file);
    return `audio_${timestamp}_${random}_${fileHash}`;
  }

  private simpleFileHash(file: File): string {
    const str = `${file.name}_${file.size}_${file.lastModified}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async isDuplicateFile(file: File): Promise<{isDuplicate: boolean, existingAudio?: any}> {
    const list = await this.getAudioList();
    const fileHash = this.simpleFileHash(file);

    const existingAudio = list.find(audio =>
      audio.fileHash === fileHash &&
      audio.size === file.size &&
      audio.originalName === file.name
    );

    return {
      isDuplicate: !!existingAudio,
      existingAudio: existingAudio
    };
  }

  async addAndPreloadAudio(
    file: File,
    assetId: string,
    fileName: string,
    extractMetadata: (file: File) => Promise<any>
  ) {
    // 1. File size limit (10MB example)
    if (file.size > 10 * 1024 * 1024) {
      return { status: 'too_large' };
    }

    const dupCheck = await this.isDuplicateFile(file);
    if (dupCheck.isDuplicate) {
      console.log('[Duplicate by file hash]', file.name, file.size, file.lastModified);
      return { status: 'duplicate' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = this.arrayBufferToBase64(arrayBuffer);

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    const fileUri = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Data,
    });

    let picture, artist, album;
    try {
      ({ picture, artist, album } = await extractMetadata(file) || {});
    } catch (e) {
      console.warn('Metadata extraction failed', e);
    }

    const fileHash = this.simpleFileHash(file);
    const newAudio = {
      assetId,
      name: file.name,
      originalName: file.name,
      fileName,
      picture,
      artist,
      album,
      size: file.size,
      fileHash,
      lastModified: file.lastModified
    };


    try {
      await NativeAudio.preload({
        assetId,
        assetPath: fileUri.uri,
        audioChannelNum: 1,
        isUrl: true,
      });
      this.preloadedAssets.add(assetId);
      await this.addAudio(newAudio);
      return { status: 'added' };
    } catch (e) {
      // Cleanup if needed (e.g., remove file)
      try {
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Data,
        });
      } catch {}
      return { status: 'error', error: (e instanceof Error ? e.message : String(e)) };
    }
  }

  async restoreAudiosFromStorage(): Promise<any[]> {
    const loadedAudios = await this.getAudioList();
    const validAudios: any[] = [];
    for (const audio of loadedAudios) {
      if (
        !audio.assetId ||
        !audio.fileName ||
        audio.fileName.includes('/') ||
        typeof audio.assetId !== 'string' ||
        typeof audio.fileName !== 'string'
      ) {
        
        await this.removeAudio(audio.assetId);
        continue;
      }
      try {
        await Filesystem.stat({
          path: audio.fileName,
          directory: Directory.Data,
        });
        const fileUri = await Filesystem.getUri({
          path: audio.fileName,
          directory: Directory.Data,
        });
        
        let preloadSuccess = false;
        try {
          if (!this.preloadedAssets.has(audio.assetId)) {
            await NativeAudio.preload({
              assetId: audio.assetId,
              assetPath: fileUri.uri,
              audioChannelNum: 1,
              isUrl: true,
            });
            this.preloadedAssets.add(audio.assetId);
          }
          preloadSuccess = true;
        } catch (preloadErr) {
          
          try {
            await NativeAudio.unload({ assetId: audio.assetId });
            await NativeAudio.preload({
              assetId: audio.assetId,
              assetPath: fileUri.uri,
              audioChannelNum: 1,
              isUrl: true,
            });
            this.preloadedAssets.add(audio.assetId);
            preloadSuccess = true;
          } catch (retryErr) {
            console.warn(`Failed to preload audio asset ${audio.assetId}:`, retryErr);
          }
        }
        if (preloadSuccess) {
          validAudios.push(audio);
        } else {
          await this.removeAudio(audio.assetId);
        }
      } catch (err) {
        
        await this.removeAudio(audio.assetId);
      }
    }
    return validAudios;
  }

  async unloadAudioFile(audio: any) {
    await NativeAudio.unload({ assetId: audio.assetId });
    this.preloadedAssets.delete(audio.assetId);
    try {
      await Filesystem.deleteFile({
        path: audio.fileName,
        directory: Directory.Data,
      });
    } catch (e) {}
    await this.removeAudio(audio.assetId);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  async unloadAllNativeAudioAssets() {
    for (const assetId of this.preloadedAssets) {
      try {
        await NativeAudio.unload({ assetId });
      } catch (e) {
        console.warn(`Failed to unload ${assetId}`, e);
      }
    }
    this.preloadedAssets.clear();
  }

  async getAudioFileUri(fileName: string): Promise<string> {
    const fileUri = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Data,
    });
    return fileUri.uri;
  }

  // Add this method anywhere you want to debug
  async debugAudioListStorage() {
    const stored = await Preferences.get({ key: 'audioList' });
    console.log('audioList in Preferences:', stored.value);
  }

  async preloadAudio(assetId: string): Promise<void> {
    // Example: Use NativeAudio to preload the asset
    const audioList = await this.getAudioList();
    const audio = audioList.find(a => a.assetId === assetId);
    if (!audio) throw new Error('Audio not found');
    // Get the file URI to use as assetPath
    const fileUri = await Filesystem.getUri({
      path: audio.fileName,
      directory: Directory.Data,
    });
    await NativeAudio.preload({
      assetId,
      assetPath: fileUri.uri,
      audioChannelNum: 1,
      isUrl: true,
    });
    this.preloadedAssets.add(assetId);
  }
}
