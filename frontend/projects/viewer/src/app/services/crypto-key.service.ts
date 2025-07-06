import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CryptoKeyService {
  private privateKey: CryptoKey | null = null;

  setKey(key: CryptoKey | null) {
    this.privateKey = key;
  }

  getKey(): CryptoKey | null {
    return this.privateKey;
  }
}
