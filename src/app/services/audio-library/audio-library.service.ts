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

    const list = await this.getAudioList();
    if (list.some(a => a.assetId === assetId || a.fileName === fileName)) {
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

    // 2. Robust metadata extraction
    let picture, artist, album;
    try {
      ({ picture, artist, album } = await extractMetadata(file) || {});
    } catch (e) {
      console.warn('Metadata extraction failed', e);
    }

    const newAudio = { assetId, name: file.name, fileName, picture, artist, album };

    // 3. Atomic preload + save
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
      // Validate assetId and fileName
      if (
        !audio.assetId ||
        !audio.fileName ||
        audio.fileName.includes('/') || // basic check for invalid filename
        typeof audio.assetId !== 'string' ||
        typeof audio.fileName !== 'string'
      ) {
        // Invalid entry, skip and remove
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
        // Retry/fallback for preload
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
          // Retry once if preload fails
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
        // Remove broken entry from storage
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
