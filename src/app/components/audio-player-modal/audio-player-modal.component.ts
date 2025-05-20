import { Component, Input, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AudioTimePipe } from 'src/app/local/audio-time.pipe';

@Component({
  selector: 'app-audio-player-modal',
  templateUrl: './audio-player-modal.component.html',
  styleUrls: ['./audio-player-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, AudioTimePipe]
})
export class AudioPlayerModalComponent implements OnInit {
  @Input() audio: any;
  @Input() playAudio!: (id: string) => void;
  @Input() pauseAudio!: () => void;
  @Input() stopAudio!: () => void;
  @Input() playNext!: () => void;
  @Input() playPrevious!: () => void;
  @Input() seekTo!: (seconds: number) => void;
  @Input() isPlaying!: boolean;
  @Input() currentTime!: number;

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    // Optionally, sync modal state with parent/local page
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pauseAudio();
    } else {
      this.playAudio(this.audio.assetId);
    }
  }

  onSeek(value: any) {
    if (typeof value === 'number') {
      this.seekTo(value);
    }
  }

  closeModal() {
    this.modalController.dismiss();
  }
}
