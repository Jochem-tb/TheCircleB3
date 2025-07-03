import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CryptoKeyService {
  private privateKey: CryptoKey | null = null;

  setKey(key: CryptoKey) {
    this.privateKey = key;
  }

  getKey(): CryptoKey | null {
    return this.privateKey;
  }
}
