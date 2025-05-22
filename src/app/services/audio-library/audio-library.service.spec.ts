import { TestBed } from '@angular/core/testing';

import { AudioLibraryService } from './audio-library.service';

describe('AudioLibraryService', () => {
  let service: AudioLibraryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioLibraryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
