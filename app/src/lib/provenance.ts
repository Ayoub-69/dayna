import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

/** SHA-256 of the recorded file, hex encoded. The server recomputes it after upload. */
export async function sha256OfFile(uri: string): Promise<string> {
  const bytes = new Uint8Array(await new File(uri).arrayBuffer());
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const MAX_CLIP_SECONDS = 60;
export const MIN_CLIP_SECONDS = 2;
