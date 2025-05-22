import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private key = 'userPreferences';

  constructor() { }

  async savePreferences(preferences: any) {
    await Preferences.set({
      key: this.key,
      value: JSON.stringify(preferences),
    });
  }

  async getPreferences(): Promise<any> {
    const stored = await Preferences.get({ key: this.key });
    return stored.value ? JSON.parse(stored.value) : {};
  }

  async setPreference(key: string, value: any) {
    const prefs = await this.getPreferences();
    prefs[key] = value;
    await this.savePreferences(prefs);
  }

  async getPreference(key: string): Promise<any> {
    const prefs = await this.getPreferences();
    return prefs[key];
  }
}
