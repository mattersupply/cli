import { has, template } from 'lodash'
import { Config } from '../matter-config'
import {
  EntryType,
  RemoteConfigurationConfig,
  RemoteConfigurationDeleteResult,
  RemoteConfigurationEntry,
  RemoteConfigurationService,
} from './config'
import axios, { AxiosInstance } from 'axios'
import { combineEntries } from './utils'

const pathTemplateOptions = {
  interpolate: /{(.+?)}/g,
}

export interface MappedSecret {
  key: string
  value?: string
  metadata: {
    created_time: string
    custom_metadata?: unknown
    deletion_time: string
    destroyed: boolean
    version: number
  }
}

export class VaultRemoteConfigurationService implements RemoteConfigurationService {
  protected config: Config
  protected vaultClient: VaultClient

  private isInitialized = false

  constructor(config: Config, vaultClient: VaultClient) {
    this.config = config
    this.vaultClient = vaultClient
  }

  async init(force = false) {
    if (this.isInitialized && !force) {
      return
    }

    await this.login()
    this.isInitialized = true
  }

  async getAllCombinedEntries(stages: string[]): Promise<RemoteConfigurationEntry[]> {
    const entriesByStage = await this.getAllEntries(stages)
    return combineEntries(entriesByStage, stages)
  }

  async getAllEntries(stages: string[]): Promise<RemoteConfigurationConfig[]> {
    const pathFormat = this.getConfigValue<string>('pathFormat')
    if (!pathFormat) {
      throw new Error('Missing pathFormat config')
    }

    const configs = await Promise.all(
      stages.map(async (stage) => {
        const basePath = template(
          pathFormat,
          pathTemplateOptions
        )({
          appName: this.config.get('app.name'),
          stage,
          key: '',
        }).replace(/\/$/, '')

        const secrets = await this.getSecretsForPath(basePath)
        return {
          stage,
          entries: Object.values(secrets).map((secret) => this.entryFromSecret(secret)),
        }
      })
    )

    return configs
  }

  async getCombinedEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationEntry[]> {
    const entriesByStage = await this.getEntries(keys, stages)
    return combineEntries(entriesByStage, stages)
  }

  async getEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationConfig[]> {
    const pathFormat = this.getConfigValue<string>('pathFormat')
    if (!pathFormat) {
      throw new Error('Missing pathFormat config')
    }

    const configs = await Promise.all(
      stages.map(async (stage) => {
        const config: RemoteConfigurationConfig = { stage, entries: [] }
        await Promise.all(
          keys.map(async (key) => {
            // This is the "normal" case, where the key is a file and we're trying to retrieve all secrets
            // contained at that path (recursively.)
            const basePath = template(
              pathFormat,
              pathTemplateOptions
            )({
              appName: this.config.get('app.name'),
              stage,
              key,
            }).replace(/\/$/, '')

            const secrets = await this.getSecretsForPath(basePath)
            const entries = Object.values(secrets).map((secret) => this.entryFromSecret(secret))
            config.entries.push(...entries)

            // Splitting the key into two parts, the base path and the key itself.
            // This is because the keys are stored in files and we'll need to find the key inside those files.
            // e.g. /develop/foo should actually look in the /develop file for a key "foo".
            const { path: keyPath } = this.fileAndKeyFromKeyOrPath(key)
            const basePathWithoutKey = template(
              pathFormat,
              pathTemplateOptions
            )({
              appName: this.config.get('app.name'),
              stage,
              key: keyPath,
            }).replace(/\/$/, '')

            const secretsAtPath = await this.getSecretsForPath(basePathWithoutKey, false)
            const fullKeyPath = this.pathWithKey(key, stage)
            // Filtering for the key, there is only one entry in the object.
            const secret = Object.values(secretsAtPath).find((secret) => secret.key === fullKeyPath)
            if (secret) {
              config.entries.push(this.entryFromSecret(secret))
            }
          })
        )

        return config
      })
    )

    return configs
  }

  async setEntries(
    entries: RemoteConfigurationEntry[],
    stages: string[]
  ): Promise<RemoteConfigurationConfig[]> {
    const pathFormat = this.getConfigValue<string>('pathFormat')
    if (!pathFormat) {
      throw new Error('Missing pathFormat config')
    }

    await Promise.all(
      stages.map(async (stage) => {
        // Because we have to check if the file exists before we can write (put or patch) to it,
        // we have to do this sequentially per stage. (So that the file doesn't get created multiple times.)
        for (const entry of entries) {
          // entries.forEach(async (entry) => {
          const { path, key } = this.fileAndKeyFromKeyOrPath(entry.key)
          if (!key) {
            throw new Error(`Unable to parse key: ${entry.key}`)
          }

          const basePath = template(
            pathFormat,
            pathTemplateOptions
          )({
            appName: this.config.get('app.name'),
            stage,
            key: path,
          }).replace(/\/$/, '')

          const existingSecrets = await this.vaultClient.kvGet(basePath)
          if (!existingSecrets) {
            await this.vaultClient.kvPut(basePath, key, entry.value || null)
          } else {
            await this.vaultClient.kvPatch(basePath, key, entry.value || null)
          }
          // })
        }
      })
    )

    return this.getEntries(
      entries.map((entry) => entry.key),
      stages
    )
  }

  async deleteEntries(
    keys: string[],
    stages: string[]
  ): Promise<RemoteConfigurationDeleteResult[]> {
    const pathFormat = this.getConfigValue<string>('pathFormat')
    if (!pathFormat) {
      throw new Error('Missing pathFormat config')
    }

    const result = await Promise.all(
      stages.map(async (stage) => {
        const stageResult: RemoteConfigurationDeleteResult = { stage, deleted: [], failed: [] }
        await Promise.all(
          keys.map(async (key) => {
            // If the "key" is a file, we can just delete it.
            await this.vaultClient.kvMetadataDelete(key)

            // If the key is a "leaf" (meaning, a key inside of a file), then we'll need to set that key to null.
            const basePath = template(
              pathFormat,
              pathTemplateOptions
            )({
              appName: this.config.get('app.name'),
              stage,
              key,
            }).replace(/\/$/, '')
            const { path, key: keyInFile } = this.fileAndKeyFromKeyOrPath(basePath)
            if (keyInFile) {
              await this.vaultClient.kvPatch(path, keyInFile, null)
            }

            stageResult.deleted.push(key)
          })
        )

        return stageResult
      })
    )

    return result
  }

  protected async login() {
    const vaultAuth = this.config.get('remoteConfig.vault.auth')
    await this.vaultClient.login(vaultAuth.mountPoint, vaultAuth.options)

    return this.vaultClient
  }

  protected fileAndKeyFromKeyOrPath(key: string) {
    const keyParts = key.split('/')
    const keyPart = keyParts.pop()
    const keyPath = keyParts.join('/')

    return { path: keyPath, key: keyPart }
  }

  protected pathWithKey(key: string, stage: string) {
    const appName = this.config.get('app.name')
    const pathFormat = this.getConfigValue<string>('pathFormat')
    if (!pathFormat) {
      throw new Error('Missing pathFormat config')
    }

    const path = template(pathFormat, pathTemplateOptions)({ appName, stage, key })
    return path
  }

  protected keyForPath(path: string) {
    const parameters = this.extractParametersFromPath(path)
    return parameters['key']
  }

  protected extractParametersFromPath(path: string): { [key: string]: string } {
    const pathFormat = this.getConfigValue<string>('pathFormat')
    if (!pathFormat) {
      throw new Error('Missing pathFormat config')
    }

    const regexTemplate = template(
      pathFormat,
      pathTemplateOptions
    )({
      appName: '(?<appName>.*?)',
      stage: '(?<stage>.*?)',
      key: '(?<key>.*)',
    })

    const re = new RegExp(regexTemplate)
    const mapResult = re.exec(path)
    if (!mapResult || !mapResult.groups) {
      throw new Error(`Unable to parse path: ${path}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return mapResult!.groups!
  }

  protected entryFromSecret(secret: MappedSecret): RemoteConfigurationEntry {
    const key = this.keyForPath(secret.key)
    const value = secret.value

    return {
      key,
      value,
      type: EntryType.secureString,
      description: `Version: ${secret.metadata.version} - Key: ${secret.key} - Last Modified: ${secret.metadata.created_time}`,
    }
  }

  protected getConfigValue<T>(key: string, defaultValue?: T): T | string {
    return this.config.get(`remoteConfig.vault.${key}`, defaultValue)
  }

  /**
   * Fetches all secrets for a given path (recursively).
   */
  protected async getSecretsForPath(
    path: string,
    recursive = true
  ): Promise<{ [key: string]: MappedSecret }> {
    let values = {}
    let metadata = {}
    // Only the first call will be ambiguous about the trailing slash, but is expected to remove the slash.
    // All recursive calls with either end in a slash when the path is a directory, or not end in a slash
    // when the path is a file.
    if (!path.endsWith('/')) {
      const response = await this.vaultClient.kvGet(path)
      metadata = response?.metadata || {}
      values = response?.data || {}
    } else {
      path = path.replace(/\/$/, '')
    }

    // console.log('Values: ', values)

    // Keys are stored as paths, so we prefix them with the current "path" to make them absolute.
    let secrets = Object.entries(values).reduce<{ [key: string]: unknown }>((acc, [key, value]) => {
      acc[`${path}/${key}`] = {
        key: `${path}/${key}`,
        value: value as string,
        metadata: metadata,
      }
      return acc
    }, {}) as { [key: string]: MappedSecret }

    if (recursive) {
      // If the path is a directory, we need to recursively fetch all secrets for all "subdirectories".
      const keys = await this.vaultClient.kvList(path)
      // console.log('Lists: ', keys)
      if (keys != null && keys.keys.length > 0) {
        const nestedValues = await Promise.all(
          keys.keys.map(async (key: string) => {
            const nestedPath = `${path}/${key}`
            const nestedValues = await this.getSecretsForPath(nestedPath)
            return nestedValues
          })
        )

        nestedValues.forEach((v) => {
          secrets = { ...secrets, ...v }
        })
      }
    }

    return secrets
  }
}

interface VaultKeyValueConfig {
  mountPoint: string
}

// TODO: This class here was made on a budget, it's not very good.
// For now it's working for our purposes, but it should be improved.
export class VaultClient {
  axiosClient: AxiosInstance
  kvConfig: VaultKeyValueConfig

  constructor(
    address: string,
    namespace: string,
    kvConfig: VaultKeyValueConfig,
    clientOptions = {}
  ) {
    this.kvConfig = kvConfig
    this.axiosClient = axios.create({
      baseURL: address,
      headers: {
        'X-Vault-Request': 'true',
        'X-Vault-Namespace': `${namespace}/`,
      },
      ...clientOptions,
    })
  }

  async login(mountPoint: string, options = {}) {
    const authResult = await this.axiosClient.post(`/v1/auth/${mountPoint}/login`, options)

    if (!has(authResult, 'data.auth.client_token')) {
      throw new Error('Unable to authenticate with Vault')
    }

    const token = authResult.data.auth.client_token
    this.axiosClient.defaults.headers.common['X-Vault-Token'] = token
  }

  async kvList(path: string) {
    const requestPath = `/v1/${this.kvConfig.mountPoint}/metadata/${path}?list=true`
    try {
      const result = await this.axiosClient.get(requestPath)
      return result.data.data
    } catch (e: any) {
      if (e.response?.status === 404) {
        return null
      }

      throw e
    }
  }

  async kvGet(path: string) {
    const requestPath = `/v1/${this.kvConfig.mountPoint}/data/${path}`
    try {
      const result = await this.axiosClient.get(requestPath)
      console.log(result.data.data)
      return result.data.data
    } catch (e: any) {
      if (e.response?.status === 404) {
        return null
      }

      throw e
    }
  }

  async kvMetadataDelete(path: string) {
    const requestPath = `/v1/${this.kvConfig.mountPoint}/metadata/${path}`
    try {
      const result = await this.axiosClient.delete(requestPath)
      return result.status === 204
    } catch (e: any) {
      if (e.response?.status === 404) {
        return false
      }

      throw e
    }
  }

  async kvPatch(path: string, key: string, value: string | null) {
    try {
      const requestPath = `/v1/${this.kvConfig.mountPoint}/data/${path}`
      const data = { data: { [key]: value } }
      const result = await this.axiosClient.patch(requestPath, data, {
        headers: {
          'Content-Type': 'application/merge-patch+json',
        },
      })

      return result.data.data
    } catch (e: any) {
      if (e.response?.status === 404) {
        return false
      }

      throw e
    }
  }

  async kvPut(path: string, key: string, value: string | null) {
    const requestPath = `/v1/${this.kvConfig.mountPoint}/data/${path}`
    const data = { data: { [key]: value } }
    const result = await this.axiosClient.put(requestPath, data)

    return result.data.data
  }
}
