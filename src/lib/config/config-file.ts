import { writeFile } from 'fs'
import * as yaml from 'js-yaml'
import { Config } from '../matter-config'
import { EntryType, RemoteConfigurationEntry } from './config'
import { defaultsDeep, has } from 'lodash'

abstract class RemoteConfigFile {
  _config: Config
  _entries?: RemoteConfigurationEntry[]
  showDescription: boolean = false
  showType: boolean = true
  useSecureEntries: boolean = false

  constructor(config: Config) {
    this._config = config
  }

  abstract loadBuffer(content: Buffer): void
  abstract toBuffer(): Buffer

  setShowDescription(showDescription: boolean) {
    this.showDescription = showDescription
  }

  setShowType(showType: boolean) {
    this.showType = showType
  }

  setUseSecureEntries(useSecureEntries: boolean) {
    this.useSecureEntries = useSecureEntries
  }

  loadEntries(entries: RemoteConfigurationEntry[]) {
    this._entries = entries
  }

  toEntries(): RemoteConfigurationEntry[] | undefined {
    this._entries?.map((entry) => {
      if (this.useSecureEntries && entry.type === EntryType.string) {
        entry.type = EntryType.secureString
      }

      if (!this.showDescription) {
        delete entry.description
      }

      if (!this.showType) {
        delete entry.type
      }

      return entry
    })
    return this._entries
  }

  async write(path: string) {
    const output = this.toBuffer()
    return new Promise((resolve, reject) =>
      writeFile(path, output, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    )
  }
}

export class DotenvRemoteConfigFile extends RemoteConfigFile {
  _entries?: RemoteConfigurationEntry[]

  loadBuffer(content: Buffer) {
    const lines = content.toString().split('\n')

    this._entries = lines
      .map((line) => {
        const match = line.match(/^## (.*)$/)

        if (match) {
          return {
            description: match[1],
          }
        }

        const keyMatch = line.match(/^([A-Z0-9_]+)=(.*)$/)

        if (keyMatch) {
          return {
            key: this.keyFromDotenvKey(keyMatch[1]),
            value: keyMatch[2],
            type: EntryType.string,
          }
        }

        return undefined
      })
      .filter((entry) => entry !== undefined) as RemoteConfigurationEntry[]
  }

  toBuffer(): Buffer {
    if (!this._entries) {
      return Buffer.from('')
    }

    const output = this.toEntries()!
      .map((entry) => {
        let envEntry = ''
        if (entry.description) {
          envEntry = `\n## ${entry.description}\n`
        }

        if (entry.value) {
          envEntry += `${this.dotenvKey(entry.key)}=${entry.value}`
        } else {
          envEntry += `${this.dotenvKey(entry.key)}=`
        }

        return envEntry
      })
      .join('\n')

    return Buffer.from(output)
  }

  dotenvKey(key: string): string {
    return key
      .replace(/\//g, '__')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toUpperCase()
  }

  keyFromDotenvKey(dotenvKey: string): string {
    return dotenvKey.replace(/__/g, '/').replace(/_/g, '-').toLowerCase()
  }
}

// TODO: This should probably create nested configurations for nested keys
export class YamlRemoteConfigFile extends RemoteConfigFile {
  loadBuffer(content: Buffer) {
    const data = yaml.safeLoad(content.toString())
    const flattened = this.flattenEntries(data)

    this._entries = flattened
  }

  toBuffer(): Buffer {
    const nested = this.nestedEntriesByKey()
    return Buffer.from(yaml.safeDump(nested))
  }

  flattenEntries(content: { [key: string]: any }): RemoteConfigurationEntry[] {
    if (has(content, 'key') && has(content, 'value')) {
      return [{ ...content, type: EntryType.string } as RemoteConfigurationEntry]
    }

    return Object.entries(content).reduce<RemoteConfigurationEntry[]>((acc, [key, value]) => {
      if (typeof value === 'object') {
        return [...acc, ...this.flattenEntries(value as { [key: string]: Object })]
      } else {
        return acc
      }
    }, [])
  }

  nestedEntriesByKey() {
    return this.toEntries()?.reduce<{ [key: string]: any }>((acc, entry) => {
      const nestedEntry = this.nestEntry(entry, entry.key)
      return defaultsDeep(acc, nestedEntry)
    }, {})
  }

  nestEntry(entry: RemoteConfigurationEntry, fullKey: string): any {
    const keyParts = entry.key.split(/\/(.*)/s)
    if (keyParts.length === 1) {
      return { [keyParts[0]]: { ...entry, key: fullKey } }
    } else {
      // const { key, entry: remainingEntry } = this.nestEntry(entry)
      return { [keyParts[0]]: this.nestEntry({ ...entry, key: keyParts[1] }, fullKey) }
    }
  }
}

export function createRemoteConfigFile(format: string, config: Config): RemoteConfigFile {
  if (format === 'dotenv') {
    return new DotenvRemoteConfigFile(config)
  } else if (format === 'yaml') {
    return new YamlRemoteConfigFile(config)
  }

  throw new Error(`Unknown format: ${format}`)
}
