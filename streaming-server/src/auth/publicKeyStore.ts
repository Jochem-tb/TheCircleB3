const publicKeys = new Map<string, string>();

export function storeUserPublicKey(username: string, publicKeyPem: string): void {
    publicKeys.set(username, publicKeyPem);
}

export function getUserPublicKey(username: string): string | undefined {
    return publicKeys.get(username);
}