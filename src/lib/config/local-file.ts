import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as crypto from 'crypto'
import * as path from 'path'
import { Config } from '../matter-config'
import {
  RemoteConfigurationConfig,
  RemoteConfigurationDeleteResult,
  RemoteConfigurationEntry,
  RemoteConfigurationService,
} from './config'
import { combineEntries } from './utils'

export class LocalFileConfigurationService implements RemoteConfigurationService {
  protected config: Config

  protected path: string
  protected password: string
  protected algorithm = 'aes-256-cbc'
  protected keyIterations = 100000
  protected keyLength = 32

  constructor(config: Config) {
    this.config = config

    this.path = this.config.get('remoteConfig.local.path')
    this.password = this.config.get('remoteConfig.local.password')
  }

  async getAllCombinedEntries(stages: string[]): Promise<RemoteConfigurationEntry[]> {
    const entriesByStage = await this.getAllEntries(stages)
    return combineEntries(entriesByStage, stages)
  }

  async getAllEntries(stages: string[]): Promise<RemoteConfigurationConfig[]> {
    return stages.map((stage) => {
      const configFilePath = this.configFilePath(stage)
      const entries = this.loadConfigFromFile(configFilePath) || []
      return {
        stage,
        entries,
      }
    })
  }

  async getCombinedEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationEntry[]> {
    const entriesByStage = await this.getEntries(keys, stages)
    return combineEntries(entriesByStage, stages)
  }

  async getEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationConfig[]> {
    return stages.map((stage) => {
      const configFilePath = this.configFilePath(stage)
      const entries = this.loadConfigFromFile(configFilePath) || []
      const filteredEntries = entries.filter((e) => {
        return keys.filter((k) => e.key.startsWith(`${k}/`) || k === e.key).length > 0
      })

      return {
        stage,
        entries: filteredEntries,
      }
    })
  }

  async setEntries(
    entries: RemoteConfigurationEntry[],
    stages: string[]
  ): Promise<RemoteConfigurationConfig[]> {
    stages.forEach((stage) => {
      const configFilePath = this.configFilePath(stage)
      const existingEntries = this.loadConfigFromFile(configFilePath) || []

      const newKeys = entries.map((e) => e.key)
      const filteredEntries = existingEntries.filter((e) => !newKeys.includes(e.key))

      const combinedEntries = [...filteredEntries, ...entries]

      this.writeConfigToFile(combinedEntries, configFilePath)
    })

    return this.getEntries(
      entries.map((e) => e.key),
      stages
    )
  }

  async deleteEntries(
    keys: string[],
    stages: string[]
  ): Promise<RemoteConfigurationDeleteResult[]> {
    return stages.map((stage) => {
      const configFilePath = this.configFilePath(stage)
      const existingEntries = this.loadConfigFromFile(configFilePath) || []

      const filteredEntries = existingEntries.filter((e) => !keys.includes(e.key))

      this.writeConfigToFile(filteredEntries, configFilePath)

      return { stage, deleted: keys, failed: [] }
    })
  }

  protected writeConfigToFile(config: RemoteConfigurationEntry[], filePath: string) {
    const configBuffer = Buffer.from(yaml.dump(config))
    const encryptedBuffer = this.encrypt(configBuffer, this.password)

    fs.mkdirSync(path.dirname(filePath), { recursive: true })

    return fs.writeFileSync(filePath, encryptedBuffer)
  }

  protected loadConfigFromFile(path: string): RemoteConfigurationEntry[] | null {
    if (!fs.existsSync(path)) {
      return null
    }

    const fileContents = fs.readFileSync(path)
    const decrypted = this.decrypt(fileContents, this.password)

    const config = yaml.load(decrypted.toString('utf-8')) as RemoteConfigurationEntry[]

    return config
  }

  protected encrypt(text: Buffer, password: string): Buffer {
    // Use a salt and pbkdf2Sync to derive a key from the password
    const salt = crypto.randomBytes(32)
    const key = crypto.pbkdf2Sync(password, salt, this.keyIterations, this.keyLength, 'sha512')

    // Generate a new IV every time we encrypt something
    const iv = crypto.randomBytes(16)

    const cipher: crypto.Cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()])

    // The "encrypted" result is the concatenation of the salt, iv, and the actual encrypted data
    return Buffer.concat([salt, iv, encrypted])
  }

  protected decrypt(encrypted: Buffer, password: string): Buffer {
    // First split the salt and IV from the input (which is assumed to be the output from the encrypt function)
    const salt = encrypted.slice(0, 32)
    const iv = encrypted.slice(32, 48)
    const actualEncryptedData = encrypted.slice(48)

    // Derive the key using the same salt and number of iterations
    const key = crypto.pbkdf2Sync(password, salt, this.keyIterations, this.keyLength, 'sha512')

    const decipher: crypto.Decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    const decrypted = Buffer.concat([decipher.update(actualEncryptedData), decipher.final()])

    return decrypted
  }

  protected configFilePath(stage: string): string {
    return `${this.path.replace(/\/$/, '')}/${this.config.get('app.name')}/${stage}.yml.enc`
  }
}
