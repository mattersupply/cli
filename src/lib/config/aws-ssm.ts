import { kebabCase, flatten, has } from 'lodash'
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
import { chunkArray, combineEntries } from './utils'

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
      keys.flatMap((key) => pathFromKey(key, stage, this.config))
    )

    const ssmPathParameters = flatten(
      await Promise.all(paths.map(async (path) => this._getParametersByPath(path)))
    )

    // splitting list into chunks of 10 to avoid throttling
    const names = stages.flatMap((stage) => keys.map((key) => pathFromKey(key, stage, this.config)))
    const perChunk = 10
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
    const remoteConfig = configFromParameters(combinedParameters, this.config)

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
          return entryFromParameter(value, this.config)
        }),
      }
    })

    console.log('Entries: ', JSON.stringify(entries, null, 2))

    return entries
  }

  async setEntries(entries: RemoteConfigurationEntry[], stages: string[]) {
    const entriesWithPath = stages.flatMap((stage) =>
      entries.map((entry) => ({
        ...entry,
        key: pathFromKey(entry.key, stage, this.config),
      }))
    )

    await Promise.all(
      entriesWithPath.map(async (entry) => {
        const input = {
          Name: entry.key,
          Value: formatEntryValue(entry.value, this.config),
          Type: formatParameterType(entry.type || EntryType.string),
          Overwrite: true,
        }

        const command = new PutParameterCommand(input)
        await this.ssm.send(command)
      })
    )

    return this.getEntries(
      entries.map((e) => e.key),
      stages
    )
  }

  async deleteEntries(keys: string[], stages: string[]) {
    const names = stages.flatMap((stage) => keys.map((key) => pathFromKey(key, stage, this.config)))

    const chunkedNames = chunkArray(names, 10)
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
        const stage = stageFromPath(path, this.config)
        const key = keyFromPath(path, stage, this.config)

        entries[stage][status].push(key)
      })
    }

    await Promise.all(
      chunkedNames.map(async (chunk) => {
        const input = {
          Names: chunk,
        }
        const command = new DeleteParametersCommand(input)

        const deleteResult = await this.ssm.send(command)
        mapDeletionResult(deleteResult.DeletedParameters, 'deleted')
        mapDeletionResult(deleteResult.InvalidParameters, 'failed')
      })
    )

    return stages.map((stage) => entries[stage])
  }

  private async _getParameters(names: string[]) {
    const input = {
      Names: names,
      WithDecryption: true,
    }

    const command = new GetParametersCommand(input)
    const entriesResult = await this.ssm.send(command)

    const parameters = entriesResult.Parameters || []
    return parameters
  }

  private async _getParametersByPath(path: string, nextToken?: string) {
    const input = {
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
    return this._getParametersByPath(pathNamespace(stage, this.config))
  }
}

function pathNamespace(stage: string, config: Config) {
  return `/${config.get('app.name')}/${stage}/`
}

/**
 * Turn a key name to a SSM key name, i.e. (kebab-case)
 */
function sanitizeKey(key: string) {
  return key
    .split('/')
    .map((v) => kebabCase(v))
    .join('/')
    .replace(/\/\//, '/')
}

/**
 * Turns a key into a namespaced, cleaned up key-path.
 * e.g. key = 'foo/bar_baz' and stage = 'develop' would return '/my-app/develop/foo/bar-baz'
 */
function pathFromKey(key: string, stage: string, config: Config) {
  const transformedKey = sanitizeKey(key)
  return `${pathNamespace(stage, config)}${transformedKey}`
}

/**
 * Parses the key from a SSM key path.
 */
function keyFromPath(path: string, stage: string, config: Config) {
  return path.replace(pathNamespace(stage, config), '')
}

/**
 * Parses the stage from a SSM key path.
 */
function stageFromPath(path: string, config: Config) {
  const appName = config.get('app.name')
  if (!appName) {
    throw new Error(`Unable to determine app name from config.`)
  }

  return path.split('/')[2]
}

/**
 * Transforms a SSM Parameter into a RemoteConfigurationEntry.
 */
function entryFromParameter(parameter: Parameter, config: Config): RemoteConfigurationEntry {
  if (!parameter.Name) {
    throw new Error(`Parameter name is undefined.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const stage = stageFromPath(parameter.Name!, config)
  const entry = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    key: keyFromPath(parameter.Name!, stage, config),
    value: parseConfigValue(parameter.Value, config),
    type: determineType(parameter.Type),
    description: `Version: ${parameter.Version} - Key: ${parameter.Name} - Last Modified: ${parameter.LastModifiedDate}}`,
  }

  return entry
}

/**
 * Tries to determine the type of a SSM Parameter (String, SecureString, StringList)
 */
function determineType(type: string | undefined) {
  if (type === 'String') {
    return EntryType.string
  } else if (type === 'SecureString') {
    return EntryType.secureString
  } else if (type === 'StringList') {
    return EntryType.stringList
  }

  throw new Error(`Unknown type: ${type}`)
}

/**
 * Transforms a EntryType into a SSM Parameter Type (String, SecureString, StringList)
 */
function formatParameterType(type: EntryType) {
  if (type === EntryType.string) {
    return 'String'
  } else if (type === EntryType.secureString) {
    return 'SecureString'
  } else if (type === EntryType.stringList) {
    return 'StringList'
  }

  throw new Error(`Unknown type: ${type}`)
}

/**
 * Formats a value for a SSM Parameter according to the configuration.
 * This is mostly used for NULL values, since AWS SSM does not support null/empty values.
 */
function formatEntryValue(value: string | null | undefined, config: Config) {
  if (typeof value === 'string') {
    if (value === '') {
      return config.get('awsSsm.nullValue')
    }
  } else if (!value) {
    return config.get('awsSsm.nullValue')
  }

  return value
}

/**
 * Parses a value from a SSM Parameter according to the configuration.
 * This is mostly used for NULL values, since AWS SSM does not support null/empty values.
 */
function parseConfigValue(value: string | undefined, config: Config) {
  if (value === config.get('awsSsm.nullValue')) {
    return null
  }

  return value
}

/**
 * Given a set of parameters, returns a RemoteConfigurationConfig.
 * This determines the stage from the parameter path.
 */
function configFromParameters(parameters: Parameter[], config: Config) {
  const configs: { [key: string]: RemoteConfigurationConfig } = {}
  parameters.forEach((parameter) => {
    if (!parameter.Name) {
      throw new Error(`Parameter name is undefined.`)
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stage = stageFromPath(parameter.Name!, config)
    const entry = entryFromParameter(parameter, config)

    if (has(configs, stage)) {
      configs[stage].entries.push(entry)
    } else {
      configs[stage] = { stage, entries: [entry] }
    }
  })

  return Object.values(configs)
}
