import { defaults, snakeCase, toUpper, kebabCase, flatten, has } from 'lodash'
import {
  SSMClient,
  DeleteParametersCommand,
  GetParametersByPathCommand,
  Parameter,
  PutParameterCommand,
  GetParametersCommand,
} from '@aws-sdk/client-ssm'
import { Config } from '../matter-config'
import { createSSMConfigManager } from './aws'
import {
  EntryType,
  RemoteConfigurationConfig,
  RemoteConfigurationDeleteResult,
  RemoteConfigurationEntry,
  RemoteConfigurationService,
} from './config'
import { combineEntries } from './utils'

export class AWSSSMRemoteConfigurationService implements RemoteConfigurationService {
  protected config: Config
  protected ssm: SSMClient

  constructor(config: Config) {
    this.config = config
    this.ssm = createSSMConfigManager(config)
  }

  async getAllCombinedEntries(stages: string[]) {
    const entriesByStage = await this.getAllEntries(stages)
    return combineEntries(entriesByStage, stages)
  }

  async getCombinedEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationEntry[]> {
    const entriesByStage = await this.getEntries(keys, stages)
    return combineEntries(entriesByStage, stages)
  }

  async getEntries(keys: string[], stages: string[]) {
    const paths = stages.flatMap((stage) =>
      keys.flatMap((key) => RemoteConfigurationPath.pathFromKey(key, stage, this.config))
    )

    const ssmPathParameters = flatten(
      await Promise.all(paths.map(async (path) => this._getParametersByPath(path)))
    )

    // splitting list into chunks of 10 to avoid throttling
    const names = stages.flatMap((stage) =>
      keys.map((key) => RemoteConfigurationPath.pathFromKey(key, stage, this.config))
    )
    const perChunk = 2
    const chunkedNames = names.reduce<string[][]>((acc, key, index) => {
      const chunkIndex = Math.floor(index / perChunk)

      if (!acc[chunkIndex]) {
        acc[chunkIndex] = [] // start a new chunk
      }

      acc[chunkIndex].push(key)
      return acc
    }, [])

    const ssmNameParameters = flatten(
      await Promise.all(chunkedNames.map(async (chunk) => await this._getParameters(chunk)))
    )

    const combinedParameters = [...ssmNameParameters, ...ssmPathParameters]
    const remoteConfig = RemoteConfigurationConfigUtils.configFromParameters(
      combinedParameters,
      this.config
    )

    return remoteConfig
  }

  async getAllEntries(stages: string[]) {
    const ssmParameters = await Promise.all(
      stages.map(async (stage) => ({
        stage: stage,
        values: await this._listParametersByStage(stage),
      }))
    )

    const entries = ssmParameters.map((parameterSet) => {
      return {
        stage: parameterSet.stage,
        entries: parameterSet.values.map((value) => {
          return RemoteConfigurationParameter.entryFromParameter(value, this.config)
        }),
      }
    })

    return entries
  }

  async setEntries(entries: RemoteConfigurationEntry[], stages: string[]) {
    const entriesWithPath = stages.flatMap((stage) =>
      entries.map((entry) => ({
        ...entry,
        key: RemoteConfigurationPath.pathFromKey(entry.key, stage, this.config),
      }))
    )

    await Promise.all(
      entriesWithPath.map(async (entry) => {
        const input = {
          Name: entry.key,
          Value: entry.value,
          Type: RemoteConfigurationParameter.typeAsParameterType(entry.type || EntryType.string),
          Overwrite: true,
        }

        const command = new PutParameterCommand(input)
        const putResult = await this.ssm.send(command)
      })
    )

    return this.getEntries(
      entries.map((e) => e.key),
      stages
    )
  }

  async deleteEntries(keys: string[], stages: string[]) {
    const names = stages.flatMap((stage) =>
      keys.map((key) => RemoteConfigurationPath.pathFromKey(key, stage, this.config))
    )

    const input = {
      Names: names,
    }
    const command = new DeleteParametersCommand(input)

    const deleteResult = await this.ssm.send(command)
    const entries = stages.reduce<{ [stage: string]: RemoteConfigurationDeleteResult }>(
      (acc, stage) => {
        acc[stage] = { stage, deleted: [], failed: [] }
        return acc
      },
      {}
    )

    const mapDeletionResult = (paths: string[] | undefined, status: 'deleted' | 'failed') => {
      if (!paths) {
        return
      }

      return paths.forEach((path) => {
        const stage = RemoteConfigurationPath.stageFromPath(path, this.config)
        const key = RemoteConfigurationPath.keyFromPath(path, stage, this.config)

        entries[stage][status].push(key)
      })
    }

    mapDeletionResult(deleteResult.DeletedParameters, 'deleted')
    mapDeletionResult(deleteResult.InvalidParameters, 'failed')

    return stages.map((stage) => entries[stage])
  }

  private async _getParameters(names: string[]) {
    let input = {
      Names: names,
      WithDecryption: true,
    }

    const command = new GetParametersCommand(input)
    const entriesResult = await this.ssm.send(command)

    let parameters = entriesResult.Parameters || []
    return parameters
  }

  private async _getParametersByPath(path: string, nextToken?: string) {
    let input = {
      Path: path,
      Recursive: true,
      WithDecryption: true,
      MaxResults: 1,
      NextToken: nextToken,
    }

    const command = new GetParametersByPathCommand(input)

    const entriesResult = await this.ssm.send(command)
    let parameters = entriesResult.Parameters || []
    if (entriesResult.NextToken) {
      const nextEntries = await this._getParametersByPath(path, entriesResult.NextToken)
      parameters = [...parameters, ...nextEntries]
    }

    return parameters
  }

  private async _listParametersByStage(stage: string) {
    return this._getParametersByPath(RemoteConfigurationPath.namespace(stage, this.config))
  }
}

export namespace RemoteConfigurationPath {
  export function namespace(stage: string, config: Config) {
    return `/${config.get('app.name')}/${stage}/`
  }

  export function santizeKey(key: string) {
    return key
      .split('/')
      .map((v) => kebabCase(v))
      .join('/')
      .replace(/\/\//, '/')
  }

  export function pathFromKey(key: string, stage: string, config: Config) {
    const transformedKey = RemoteConfigurationPath.santizeKey(key)
    return `${namespace(stage, config)}${transformedKey}`
  }

  export function keyFromPath(path: string, stage: string, config: Config) {
    return path.replace(namespace(stage, config), '')
  }

  export function stageFromPath(path: string, config: Config) {
    const appName = config.get('app.name')
    if (!appName) {
      throw new Error(`Unable to determine app name from config.`)
    }

    return path.split('/')[2]
  }
}

export namespace RemoteConfigurationParameter {
  export function entryFromParameter(
    parameter: Parameter,
    config: Config
  ): RemoteConfigurationEntry {
    const stage = RemoteConfigurationPath.stageFromPath(parameter.Name!, config)
    const entry = {
      key: RemoteConfigurationPath.keyFromPath(parameter.Name!, stage, config),
      value: RemoteConfigurationValue.parseConfigValue(parameter.Value, config),
      type: RemoteConfigurationParameter.parseType(parameter.Type),
      description: `Version: ${parameter.Version} - Key: ${parameter.Name} - Last Modified: ${parameter.LastModifiedDate}}`,
    }

    return entry
  }

  export function parseType(type: string | undefined) {
    if (type === 'String') {
      return EntryType.string
    } else if (type === 'SecureString') {
      return EntryType.secureString
    } else if (type === 'StringList') {
      return EntryType.stringList
    }

    throw new Error(`Unknown type: ${type}`)
  }

  export function typeAsParameterType(type: EntryType) {
    if (type === EntryType.string) {
      return 'String'
    } else if (type === EntryType.secureString) {
      return 'SecureString'
    } else if (type === EntryType.stringList) {
      return 'StringList'
    }

    throw new Error(`Unknown type: ${type}`)
  }
}

export namespace RemoteConfigurationValue {
  export function formatEntryValue(value: any, config: Config) {
    if (typeof value === 'string') {
      if (value === '') {
        return config.get('awsSsm.nullValue')
      }
    }

    return value
  }

  export function parseConfigValue(value: any, config: Config) {
    if (value === config.get('awsSsm.nullValue')) {
      return null
    }

    return value
  }
}

export namespace RemoteConfigurationConfigUtils {
  export function configFromParameters(parameters: Parameter[], config: Config) {
    const configs: { [key: string]: RemoteConfigurationConfig } = {}
    parameters.forEach((parameter) => {
      const stage = RemoteConfigurationPath.stageFromPath(parameter.Name!, config)
      const entry = RemoteConfigurationParameter.entryFromParameter(parameter, config)

      if (has(configs, stage)) {
        configs[stage].entries.push(entry)
      } else {
        configs[stage] = { stage, entries: [entry] }
      }
    })

    return Object.values(configs)
  }
}
