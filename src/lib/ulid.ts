// Minimal ULID: 48-bit time + 80 bits of randomness, Crockford base32.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function ulid(now: number = Date.now()): string {
  let time = ''
  let t = now
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time
    t = Math.floor(t / 32)
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let rand = ''
  for (let i = 0; i < 16; i++) rand += ALPHABET[bytes[i] % 32]
  return time + rand
}

export function ulidTime(id: string): number {
  let t = 0
  for (let i = 0; i < 10; i++) t = t * 32 + ALPHABET.indexOf(id[i])
  return t
}
