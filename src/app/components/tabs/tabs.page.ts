import { Component } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor(private router: Router) {
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        const { value } = await Preferences.get({ key: 'lastTab' });
        if (value) {
          this.router.navigate([`/tabs/${value}`]);
        }
      }
    });

    // Cold start
    Preferences.get({ key: 'lastTab' }).then(({ value }) => {
      if (value) {
        this.router.navigate([`/tabs/${value}`]);
      }
    });
  }

  async onTabChange(event: any) {
    console.log('Tab changed:', event);
    await Preferences.set({ key: 'lastTab', value: event.tab });
  }
}
