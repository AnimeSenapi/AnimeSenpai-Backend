import { exec } from 'child_process'
import { promisify } from 'util'
import { unlink, readdir } from 'fs/promises'
import { join } from 'path'
import { logger } from './logger'

const execAsync = promisify(exec)

interface BackupConfig {
  databaseUrl: string
  backupDir: string
  retentionDays: number
  compression: boolean
  encryption: boolean
  encryptionKey?: string
}

interface BackupResult {
  success: boolean
  filename: string
  size: number
  timestamp: Date
  duration: number
  error?: string
}

class DatabaseBackup {
  private config: BackupConfig

  constructor(config: BackupConfig) {
    this.config = config
  }

  async createBackup(): Promise<BackupResult> {
    const startTime = Date.now()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${timestamp}.sql`
    const filepath = join(this.config.backupDir, filename)

    try {
      logger.info('Starting database backup', { filename })

      // Create backup directory if it doesn't exist
      await this.ensureBackupDirectory()

      // Create database dump
      const dumpCommand = this.buildDumpCommand(filepath)
      const { stderr } = await execAsync(dumpCommand)

      if (stderr && !stderr.includes('Warning')) {
        throw new Error(`Database dump failed: ${stderr}`)
      }

      // Compress backup if enabled
      let finalFilename = filename
      if (this.config.compression) {
        finalFilename = await this.compressBackup(filepath)
      }

      // Encrypt backup if enabled
      if (this.config.encryption && this.config.encryptionKey) {
        finalFilename = await this.encryptBackup(join(this.config.backupDir, finalFilename))
      }

      // Get file size
      const stats = await import('fs').then(fs => fs.promises.stat(join(this.config.backupDir, finalFilename)))
      const size = stats.size

      const duration = Date.now() - startTime

      logger.info('Database backup completed successfully', {
        filename: finalFilename,
        size,
        duration
      })

      return {
        success: true,
        filename: finalFilename,
        size,
        timestamp: new Date(),
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime

      logger.error(
        'Database backup failed',
        error instanceof Error ? error : new Error('Unknown error'),
        undefined,
        { duration }
      )

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      return {
        success: false,
        filename,
        size: 0,
        timestamp: new Date(),
        duration,
        error: errorMessage
      }
    }
  }

  private buildDumpCommand(filepath: string): string {
    const url = new URL(this.config.databaseUrl)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.slice(1)
    const username = url.username
    const password = url.password

    // Build pg_dump command
    let command = `pg_dump`
    command += ` --host=${host}`
    command += ` --port=${port}`
    command += ` --username=${username}`
    command += ` --dbname=${database}`
    command += ` --no-password`
    command += ` --verbose`
    command += ` --format=plain`
    command += ` --file=${filepath}`

    // Set password via environment variable
    if (password) {
      command = `PGPASSWORD="${password}" ${command}`
    }

    return command
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await import('fs').then(fs => fs.promises.mkdir(this.config.backupDir, { recursive: true }))
    } catch (error) {
      logger.error(
        'Failed to create backup directory',
        error instanceof Error ? error : new Error('Unknown error')
      )
      throw error
    }
  }

  private async compressBackup(filepath: string): Promise<string> {
    const compressedPath = `${filepath}.gz`
    
    try {
      await execAsync(`gzip -c "${filepath}" > "${compressedPath}"`)
      await unlink(filepath) // Remove original file
      
      logger.info('Backup compressed successfully', { 
        original: filepath, 
        compressed: compressedPath 
      })
      
      return `${filepath.split('/').pop()}.gz`
    } catch (error) {
      logger.error(
        'Backup compression failed',
        error instanceof Error ? error : new Error('Unknown error')
      )
      throw error
    }
  }

  private async encryptBackup(filepath: string): Promise<string> {
    const encryptedPath = `${filepath}.enc`
    
    try {
      // Use OpenSSL for encryption
      const command = `openssl enc -aes-256-cbc -salt -in "${filepath}" -out "${encryptedPath}" -pass pass:"${this.config.encryptionKey}"`
      await execAsync(command)
      await unlink(filepath) // Remove unencrypted file
      
      logger.info('Backup encrypted successfully', { 
        original: filepath, 
        encrypted: encryptedPath 
      })
      
      return `${filepath.split('/').pop()}.enc`
    } catch (error) {
      logger.error(
        'Backup encryption failed',
        error instanceof Error ? error : new Error('Unknown error')
      )
      throw error
    }
  }

  async listBackups(): Promise<Array<{ filename: string; size: number; created: Date }>> {
    try {
      const files = await readdir(this.config.backupDir)
      const backups = []

      for (const file of files) {
        if (file.startsWith('backup-') && (file.endsWith('.sql') || file.endsWith('.sql.gz') || file.endsWith('.sql.enc'))) {
          const filepath = join(this.config.backupDir, file)
          const stats = await import('fs').then(fs => fs.promises.stat(filepath))
          
          backups.push({
            filename: file,
            size: stats.size,
            created: stats.birthtime
          })
        }
      }

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime())
    } catch (error) {
      logger.error(
        'Failed to list backups',
        error instanceof Error ? error : new Error('Unknown error')
      )
      return []
    }
  }

  async cleanupOldBackups(): Promise<{ deleted: number; errors: string[] }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

    const backups = await this.listBackups()
    const oldBackups = backups.filter(backup => backup.created < cutoffDate)

    let deleted = 0
    const errors: string[] = []

    for (const backup of oldBackups) {
      try {
        const filepath = join(this.config.backupDir, backup.filename)
        await unlink(filepath)
        deleted++
        
        logger.info('Deleted old backup', { filename: backup.filename })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to delete ${backup.filename}: ${errorMessage}`)
        logger.error(
          'Failed to delete old backup',
          error instanceof Error ? error : new Error('Unknown error'),
          undefined,
          { filename: backup.filename }
        )
      }
    }

    logger.info('Backup cleanup completed', { deleted, errors: errors.length })

    return { deleted, errors }
  }

  async restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    const filepath = join(this.config.backupDir, filename)

    try {
      logger.info('Starting database restore', { filename })

      // Check if file exists
      try {
        await import('fs').then(fs => fs.promises.access(filepath))
      } catch {
        throw new Error(`Backup file not found: ${filename}`)
      }

      // Decrypt if needed
      let restoreFile = filepath
      if (filename.endsWith('.enc')) {
        restoreFile = await this.decryptBackup(filepath)
      }

      // Decompress if needed
      if (filename.endsWith('.gz') || restoreFile.endsWith('.gz')) {
        restoreFile = await this.decompressBackup(restoreFile)
      }

      // Restore database
      const restoreCommand = this.buildRestoreCommand(restoreFile)
      const { stderr } = await execAsync(restoreCommand)

      if (stderr && !stderr.includes('Warning')) {
        throw new Error(`Database restore failed: ${stderr}`)
      }

      // Clean up temporary files
      if (restoreFile !== filepath) {
        await unlink(restoreFile)
      }

      logger.info('Database restore completed successfully', { filename })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(
        'Database restore failed',
        error instanceof Error ? error : new Error('Unknown error'),
        undefined,
        { filename }
      )
      return { success: false, error: errorMessage }
    }
  }

  private async decryptBackup(filepath: string): Promise<string> {
    const decryptedPath = filepath.replace('.enc', '')
    
    const command = `openssl enc -aes-256-cbc -d -in "${filepath}" -out "${decryptedPath}" -pass pass:"${this.config.encryptionKey}"`
    await execAsync(command)
    
    return decryptedPath
  }

  private async decompressBackup(filepath: string): Promise<string> {
    const decompressedPath = filepath.replace('.gz', '')
    
    await execAsync(`gunzip -c "${filepath}" > "${decompressedPath}"`)
    
    return decompressedPath
  }

  private buildRestoreCommand(filepath: string): string {
    const url = new URL(this.config.databaseUrl)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.slice(1)
    const username = url.username
    const password = url.password

    let command = `psql`
    command += ` --host=${host}`
    command += ` --port=${port}`
    command += ` --username=${username}`
    command += ` --dbname=${database}`
    command += ` --no-password`
    command += ` --file=${filepath}`

    if (password) {
      command = `PGPASSWORD="${password}" ${command}`
    }

    return command
  }
}

// Backup configuration
const backupConfig: BackupConfig = {
  databaseUrl: process.env.DATABASE_URL || '',
  backupDir: process.env.BACKUP_DIR || './backups',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  compression: process.env.BACKUP_COMPRESSION === 'true',
  encryption: process.env.BACKUP_ENCRYPTION === 'true',
  ...(process.env.BACKUP_ENCRYPTION_KEY !== undefined && { encryptionKey: process.env.BACKUP_ENCRYPTION_KEY })
}

export const databaseBackup = new DatabaseBackup(backupConfig)

// Scheduled backup function
export async function runScheduledBackup(): Promise<void> {
  try {
    logger.info('Starting scheduled backup')
    
    const result = await databaseBackup.createBackup()
    
    if (result.success) {
      logger.info('Scheduled backup completed successfully', {
        filename: result.filename,
        size: result.size,
        duration: result.duration
      })
    } else {
      logger.error(
        'Scheduled backup failed',
        new Error(result.error || 'Unknown error'),
        undefined,
        { error: result.error }
      )
    }

    // Clean up old backups
    await databaseBackup.cleanupOldBackups()
  } catch (error) {
    logger.error(
      'Scheduled backup process failed',
      error instanceof Error ? error : new Error('Unknown error')
    )
  }
}

export default databaseBackup
