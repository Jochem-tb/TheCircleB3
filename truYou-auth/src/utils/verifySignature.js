const crypto = require('crypto');

function verifySignature(challenge, publicKey, signature) {
  console.log('--- verifySignature ---');
  console.log('Challenge (hex):', challenge);
  console.log('Public Key (PEM start):', publicKey.slice(0, 30) + '...');
  console.log('Signature (base64):', signature);

  const messageBuffer = Buffer.from(challenge, 'hex');
  const signatureBuffer = Buffer.from(signature, 'base64');

  console.log('Message Buffer (hex):', messageBuffer.toString('hex'));
  console.log('Signature Buffer (hex):', signatureBuffer.toString('hex'));

  const verify = crypto.createVerify('SHA256');
  verify.update(messageBuffer);
  verify.end();

  try {
    const result = verify.verify(
      {
        key: publicKey,
        format: 'pem',
        type: 'spki',
        // You can explicitly add padding if needed, but RSASSA-PKCS1-v1_5 is default:
        // padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      signatureBuffer
    );
    console.log('Verification result:', result);
    return result;
  } catch (err) {
    console.error('Verification error:', err);
    return false;
  }
}

module.exports = verifySignature;
