import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PlaylistDetailsPage } from './playlist-details.page';

const routes: Routes = [
  {
    path: '',
    component: PlaylistDetailsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PlaylistDetailsPageRoutingModule {}
