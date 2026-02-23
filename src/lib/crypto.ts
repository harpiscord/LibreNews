// AES-256-GCM encryption with PBKDF2 key derivation

const SALT_LENGTH = 16
const IV_LENGTH = 12
const PBKDF2_ITERATIONS = 100000

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(passphrase, salt)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)

  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encryptedData: string, passphrase: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))

  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)

  const key = await deriveKey(passphrase, salt)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return new TextDecoder().decode(decrypted)
}

const STORAGE_KEY = 'librenews_encrypted_api_key'

export async function storeEncryptedApiKey(apiKey: string, passphrase: string): Promise<void> {
  const encrypted = await encrypt(apiKey, passphrase)
  localStorage.setItem(STORAGE_KEY, encrypted)
}

export async function retrieveApiKey(passphrase: string): Promise<string> {
  const encrypted = localStorage.getItem(STORAGE_KEY)
  if (!encrypted) {
    throw new Error('No stored API key found')
  }
  return decrypt(encrypted, passphrase)
}

export function hasStoredApiKey(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(STORAGE_KEY)
}
