import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LocalPageRoutingModule } from './local-routing.module';

import { LocalPage } from './local.page';
import { AudioTimePipe } from '../local/audio-time.pipe';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LocalPageRoutingModule,
    AudioTimePipe
  ],
  declarations: [LocalPage]
})
export class LocalPageModule {}
