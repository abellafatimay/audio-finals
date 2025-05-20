import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlaylistDetailsPage } from './playlist-details.page';

describe('PlaylistDetailsPage', () => {
  let component: PlaylistDetailsPage;
  let fixture: ComponentFixture<PlaylistDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaylistDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
