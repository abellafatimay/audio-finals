import { Component } from '@angular/core';
import { NativeAudio } from '@capacitor-community/native-audio';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  loadedAudios: Array<{ assetId: string; name: string; fileName: string }> = [];

  constructor() {
    this.restoreAudios();
  }

  async handleMultipleFiles(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const assetId = `audio-${Date.now()}-${i}`;
      const extension = file.name.split('.').pop();
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

        this.loadedAudios.push({ assetId, name: file.name, fileName });
        await this.saveAudiosToPreferences();

      } catch (err) {
        console.error(`Error loading ${file.name}:`, err);
      }
    }
  }

  async restoreAudios() {
    const stored = await Preferences.get({ key: 'audioList' });
    if (!stored.value) return;

    const audios = JSON.parse(stored.value) as Array<{ assetId: string; name: string; fileName: string }>;

    for (const audio of audios) {
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

        this.loadedAudios.push(audio);
      } catch (err) {
        console.error(`Restore failed for ${audio.name}:`, err);
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
    await NativeAudio.unload({ assetId });

    this.loadedAudios = this.loadedAudios.filter(audio => audio.assetId !== assetId);
    await this.saveAudiosToPreferences();
  }

  playAudio(assetId: string) {
    NativeAudio.play({ assetId });
  }

  loopAudio(assetId: string) {
    NativeAudio.loop({ assetId });
  }

  stopAudio(assetId: string) {
    NativeAudio.stop({ assetId });
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

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }
}
