import { ConfigProvider, RemoteConfigEntry } from '../provider'
import { Config } from '../../config-file'
import { defaultsDeep, get, merge, set, unset } from 'lodash'
import Command from '@oclif/command'
import { KV2VaultClient, Vault, VaultRequestError } from '@mittwald/vaults'
import flatten from 'flat'
import chalk = require('chalk')

export class VaultConfigProvider extends ConfigProvider {
  public vaultConfig: Config
  public vault: Vault
  public kvClient: KV2VaultClient

  constructor(public cfg: Config, public command: Command) {
    super()
    this.vaultConfig = this.cfg.get('providers.vault')
    this.vault = new Vault({
      vaultAddress: this.vaultConfig.get('address'),
    })

    this.kvClient = this.vault.KV(2, this.vaultConfig.get('mountPoint'))
  }

  async getValues(
    stages: string[],
    keys: string[]
  ): Promise<{ [stage: string]: RemoteConfigEntry[] }> {
    const secretsPerStage = await this.fetchSecrets(stages)

    const entries = Object.assign(
      {},
      ...Object.entries(secretsPerStage).map(([stage, secrets]) => {
        const stageEntries = SecretsFormatter.entries(secrets)
        return {
          [stage]: keys.map(
            (key) =>
              stageEntries?.find((v) => v.key === key) || {
                key,
                value: undefined,
              }
          ),
        }
      })
    )

    return entries
  }

  async setValues(
    stages: string[],
    entries: RemoteConfigEntry[]
  ): Promise<{ [stage: string]: RemoteConfigEntry[] }> {
    const secretsPerStage = await this.fetchSecrets(stages)

    const written = Object.assign(
      {},
      ...(await Promise.all(
        stages.map(async (stage) => {
          const secretsData = secretsPerStage[stage].data
          let writtenEntries: RemoteConfigEntry[] = []
          entries.map((entry) => {
            const entryKey = Utils.secretKeyPath(entry.key)
            set(secretsData, entry.key, entry.value)
            writtenEntries = [...writtenEntries, { key: entry.key, value: entry.value }]
          })

          await this.kvClient.create(this.secretsPath(stage), {
            data: secretsData,
          })

          return { [stage]: writtenEntries }
        })
      ))
    )

    return written
  }

  async exportValues(stages: string[]): Promise<RemoteConfigEntry[]> {
    const secretsPerStage = await this.fetchSecrets(stages)
    const secretsToMerge = stages.map((stage) => secretsPerStage[stage])

    const merged = defaultsDeep(secretsToMerge[0], ...secretsToMerge)
    return SecretsFormatter.entries(merged)
  }

  async describeValues(
    stages: string[],
    raw: boolean
  ): Promise<{ [stage: string]: RemoteConfigEntry[] | any[] }> {
    const secretsPerStage = await this.fetchSecrets(stages)
    if (raw) {
      return secretsPerStage
    }

    const entries = Object.assign(
      {},
      ...Object.entries(secretsPerStage).map(([stage, secrets]) => {
        return {
          [stage]: SecretsFormatter.entries(secrets),
        }
      })
    )

    return entries
  }

  async deleteValues(
    stages: string[],
    keys: string[]
  ): Promise<{ [key: string]: Pick<RemoteConfigEntry, 'key'>[] }> {
    const secretsPerStage = await this.fetchSecrets(stages)

    // Since we're not deleting secrets but only values inside secrets, we're patching
    // the env file to remove entries.
    const removedKeys = Object.assign({}, ...stages.map((s) => ({ [s]: [] })))
    Promise.all(
      stages.map(async (stage) => {
        const secretsData = secretsPerStage[stage].data
        keys.map((key) => {
          const hasKey = get(secretsData, Utils.secretKeyPath(key))
          unset(secretsData, Utils.secretKeyPath(key))
          if (hasKey != undefined) {
            removedKeys[stage] = [...removedKeys[stage], { key }]
          }
        })

        await this.kvClient.create(this.secretsPath(stage), {
          data: secretsData,
        })
      })
    )

    return removedKeys
  }

  private async fetchSecrets(stages: string[]) {
    const appName = this.cfg.get('app.name')
    const envSecret = this.vaultConfig.get('envSecret')

    const envPerStage: { [stage: string]: any } = {}
    await Promise.all(
      stages.map(async (stage) => {
        try {
          const envResponse = await this.kvClient.read(`${appName}/${stage}/${envSecret}`)
          envPerStage[stage] = envResponse.data
        } catch (e) {
          if (e instanceof VaultRequestError) {
            this.command.warn(
              `Unable to fetch values for stage: ${chalk.red.bold(stage)} (Status Code: ${
                e.response.statusCode
              })`
            )

            envPerStage[stage] = { data: {} }
          } else {
            throw e
          }
        }
      })
    )

    return envPerStage
  }

  private secretsPath(stage: string) {
    const appName = this.cfg.get('app.name')
    const envSecret = this.vaultConfig.get('envSecret')
    return `${appName}/${stage}/${envSecret}`
  }
}

export namespace SecretsFormatter {
  export function entries(secrets: { data: any }) {
    const flatSecret: { [key: string]: any } = flatten(secrets.data)
    return Object.entries(flatSecret).map(([key, value]) => {
      return {
        key: Utils.entryKeyPath(key),
        value,
      }
    })
  }
}

export namespace Utils {
  export function secretKeyPath(path: string) {
    return path.split('/').join('.')
  }
  export function entryKeyPath(path: string) {
    return path.split('.').join('/')
  }
}
