import crypto from "crypto";

// Verifies a signature using the sender's public key.
// message: string that was signed
// publicKey: PEM formatted public key string
// signature: base64 signature string
export function verifySignature(message, publicKey, signature) {
    const verify = crypto.createVerify("SHA256");
    verify.update(message);
    verify.end();
    try {
        return verify.verify(publicKey, Buffer.from(signature, "base64"));
    } catch {
        return false;
    }
}
