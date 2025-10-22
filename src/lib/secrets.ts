import { createHash, randomBytes, createCipher, createDecipher } from 'crypto'
import { logger } from './logger'

interface SecretConfig {
  encryptionKey: string
  algorithm: string
  encoding: BufferEncoding
}

interface EncryptedSecret {
  encrypted: string
  iv: string
  tag: string
}

class SecretsManager {
  private config: SecretConfig
  private secrets: Map<string, string> = new Map()

  constructor(config: SecretConfig) {
    this.config = config
  }

  // Encrypt a secret
  private encrypt(plaintext: string): EncryptedSecret {
    try {
      const iv = randomBytes(16)
      const cipher = createCipher('aes-256-gcm', this.config.encryptionKey)
      cipher.setAAD(Buffer.from('animesenpai-secrets', 'utf8'))
      
      let encrypted = cipher.update(plaintext, 'utf8', this.config.encoding)
      encrypted += cipher.final(this.config.encoding)
      
      const tag = cipher.getAuthTag()
      
      return {
        encrypted,
        iv: iv.toString(this.config.encoding),
        tag: tag.toString(this.config.encoding)
      }
    } catch (error) {
      logger.error('Secret encryption failed', { error })
      throw new Error('Failed to encrypt secret')
    }
  }

  // Decrypt a secret
  private decrypt(encryptedSecret: EncryptedSecret): string {
    try {
      const decipher = createDecipher('aes-256-gcm', this.config.encryptionKey)
      decipher.setAAD(Buffer.from('animesenpai-secrets', 'utf8'))
      decipher.setAuthTag(Buffer.from(encryptedSecret.tag, this.config.encoding))
      
      let decrypted = decipher.update(encryptedSecret.encrypted, this.config.encoding, 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      logger.error('Secret decryption failed', { error })
      throw new Error('Failed to decrypt secret')
    }
  }

  // Store a secret
  async storeSecret(key: string, value: string): Promise<boolean> {
    try {
      const encrypted = this.encrypt(value)
      const secretData = JSON.stringify(encrypted)
      
      this.secrets.set(key, secretData)
      
      logger.info('Secret stored successfully', { key })
      return true
    } catch (error) {
      logger.error('Failed to store secret', { key, error })
      return false
    }
  }

  // Retrieve a secret
  async getSecret(key: string): Promise<string | null> {
    try {
      const secretData = this.secrets.get(key)
      if (!secretData) {
        return null
      }

      const encryptedSecret: EncryptedSecret = JSON.parse(secretData)
      const decrypted = this.decrypt(encryptedSecret)
      
      return decrypted
    } catch (error) {
      logger.error('Failed to retrieve secret', { key, error })
      return null
    }
  }

  // Delete a secret
  async deleteSecret(key: string): Promise<boolean> {
    try {
      const deleted = this.secrets.delete(key)
      if (deleted) {
        logger.info('Secret deleted successfully', { key })
      }
      return deleted
    } catch (error) {
      logger.error('Failed to delete secret', { key, error })
      return false
    }
  }

  // List all secret keys
  async listSecrets(): Promise<string[]> {
    return Array.from(this.secrets.keys())
  }

  // Check if a secret exists
  async hasSecret(key: string): Promise<boolean> {
    return this.secrets.has(key)
  }

  // Rotate encryption key (requires re-encrypting all secrets)
  async rotateEncryptionKey(newKey: string): Promise<boolean> {
    try {
      const oldKey = this.config.encryptionKey
      const oldSecrets = new Map(this.secrets)
      
      // Update config
      this.config.encryptionKey = newKey
      
      // Re-encrypt all secrets
      this.secrets.clear()
      
      for (const [key, secretData] of oldSecrets) {
        try {
          // Temporarily use old key to decrypt
          const tempConfig = { ...this.config, encryptionKey: oldKey }
          const tempManager = new SecretsManager(tempConfig)
          const decrypted = await tempManager.getSecret(key)
          
          if (decrypted) {
            // Encrypt with new key
            await this.storeSecret(key, decrypted)
          }
        } catch (error) {
          logger.error('Failed to re-encrypt secret during key rotation', { key, error })
          // Continue with other secrets
        }
      }
      
      logger.info('Encryption key rotated successfully')
      return true
    } catch (error) {
      logger.error('Failed to rotate encryption key', { error })
      return false
    }
  }

  // Generate a secure random secret
  generateSecret(length: number = 32): string {
    return randomBytes(length).toString('base64')
  }

  // Hash a secret for comparison (one-way)
  hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex')
  }

  // Verify a secret against its hash
  verifySecret(secret: string, hash: string): boolean {
    const secretHash = this.hashSecret(secret)
    return secretHash === hash
  }

  // Export secrets (for backup/migration)
  async exportSecrets(): Promise<Record<string, string>> {
    const exported: Record<string, string> = {}
    
    for (const [key, secretData] of this.secrets) {
      exported[key] = secretData
    }
    
    return exported
  }

  // Import secrets (for backup/migration)
  async importSecrets(secrets: Record<string, string>): Promise<boolean> {
    try {
      for (const [key, secretData] of Object.entries(secrets)) {
        this.secrets.set(key, secretData)
      }
      
      logger.info('Secrets imported successfully', { count: Object.keys(secrets).length })
      return true
    } catch (error) {
      logger.error('Failed to import secrets', { error })
      return false
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      // Test encryption/decryption
      const testSecret = 'test-secret-' + Date.now()
      const testKey = 'test-key-' + Date.now()
      
      const stored = await this.storeSecret(testKey, testSecret)
      if (!stored) {
        throw new Error('Failed to store test secret')
      }
      
      const retrieved = await this.getSecret(testKey)
      if (retrieved !== testSecret) {
        throw new Error('Failed to retrieve test secret')
      }
      
      await this.deleteSecret(testKey)
      
      return { status: 'healthy' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { status: 'unhealthy', error: errorMessage }
    }
  }
}

// Secrets manager configuration
const secretsConfig: SecretConfig = {
  encryptionKey: process.env.SECRETS_ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
  algorithm: 'aes-256-gcm',
  encoding: 'base64'
}

export const secretsManager = new SecretsManager(secretsConfig)

// Initialize secrets from environment variables
export async function initializeSecrets(): Promise<void> {
  try {
    // Load secrets from environment variables
    const secretVars = [
      'JWT_SECRET',
      'REFRESH_TOKEN_SECRET',
      'DATABASE_URL',
      'REDIS_PASSWORD',
      'EMAIL_SMTP_PASS',
      'SENTRY_DSN'
    ]

    for (const varName of secretVars) {
      const value = process.env[varName]
      if (value) {
        await secretsManager.storeSecret(varName.toLowerCase(), value)
        logger.info('Secret loaded from environment', { key: varName.toLowerCase() })
      }
    }

    logger.info('Secrets manager initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize secrets manager', { error })
    throw error
  }
}

export default secretsManager
