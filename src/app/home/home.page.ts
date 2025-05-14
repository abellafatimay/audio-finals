import { Component } from '@angular/core';
import { NativeAudio } from '@capacitor-community/native-audio';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {

  audioLoaded = false;
  selectedAudio  = 'user-audio'
  
  constructor() {}

  async handleFile(event: any){
    const file: File = event.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = async () => {
      try {
        const blob = new Blob([file], { type: file.type });
        const audioURL = URL.createObjectURL(blob);

        await NativeAudio.preload({
          assetId: this.selectedAudio,
          assetPath: audioURL,
          audioChannelNum: 1,
          isUrl: true,
        });
        this.audioLoaded = true;
        
      }
       catch (err) {

    }
  }

}
}