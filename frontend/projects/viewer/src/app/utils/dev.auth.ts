

export async function generateDevIdentity(name: string) {
  const keyPair = await window.crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  }, true, ["sign", "verify"])

  const data = new TextEncoder().encode(`I am ${name}`)
  const signatureBuffer = await window.crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    keyPair.privateKey,
    data
  )

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  const exportedKey = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)))
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`

  return { name, publicKey: publicKeyPem, signature }
}
