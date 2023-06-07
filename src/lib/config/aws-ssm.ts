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

  constructor(config: Config, ssm: SSMClient) {
    this.config = config
    this.ssm = ssm
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
    const paths = stages.flatMap((stage) => keys.flatMap((key) => this.pathFromKey(key, stage)))

    const ssmPathParameters = flatten(
      await Promise.all(paths.map(async (path) => this.getParametersByPath(path)))
    )

    // splitting list into chunks of 10 to avoid throttling
    const names = stages.flatMap((stage) => keys.map((key) => this.pathFromKey(key, stage)))
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
      await Promise.all(chunkedNames.map(async (chunk) => await this.getParameters(chunk)))
    )

    const combinedParameters = [...ssmNameParameters, ...ssmPathParameters]
    const remoteConfig = this.configFromParameters(combinedParameters)

    return remoteConfig
  }

  async getAllEntries(stages: string[]) {
    const ssmParameters = await Promise.all(
      stages.map(async (stage) => ({
        stage: stage,
        values: await this.listParametersByStage(stage),
      }))
    )

    const entries = ssmParameters.map((parameterSet) => {
      return {
        stage: parameterSet.stage,
        entries: parameterSet.values.map((value) => {
          return this.entryFromParameter(value)
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
        key: this.pathFromKey(entry.key, stage),
      }))
    )

    await Promise.all(
      entriesWithPath.map(async (entry) => {
        const input = {
          Name: entry.key,
          Value: this.formatEntryValue(entry.value),
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
    const names = stages.flatMap((stage) => keys.map((key) => this.pathFromKey(key, stage)))

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
        const stage = this.stageFromPath(path)
        const key = this.keyFromPath(path, stage)

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

  private async getParameters(names: string[]) {
    const input = {
      Names: names,
      WithDecryption: true,
    }

    const command = new GetParametersCommand(input)
    const entriesResult = await this.ssm.send(command)

    const parameters = entriesResult.Parameters || []
    return parameters
  }

  private async getParametersByPath(path: string, nextToken?: string) {
    const input = {
      Path: path,
      Recursive: true,
      WithDecryption: true,
      MaxResults: 10,
      NextToken: nextToken,
    }

    const command = new GetParametersByPathCommand(input)

    const entriesResult = await this.ssm.send(command)
    let parameters = entriesResult.Parameters || []
    if (entriesResult.NextToken) {
      const nextEntries = await this.getParametersByPath(path, entriesResult.NextToken)
      parameters = [...parameters, ...nextEntries]
    }

    return parameters
  }

  private async listParametersByStage(stage: string) {
    return this.getParametersByPath(this.pathNamespace(stage))
  }

  protected getConfigValue<T>(key: string, defaultValue?: T): T | string {
    return this.config.get(`remoteConfig.awsSsm.${key}`, defaultValue)
  }

  /**
   * Given a set of parameters, returns a RemoteConfigurationConfig.
   * This determines the stage from the parameter path.
   */
  protected configFromParameters(parameters: Parameter[]) {
    const configs: { [key: string]: RemoteConfigurationConfig } = {}
    parameters.forEach((parameter) => {
      if (!parameter.Name) {
        throw new Error(`Parameter name is undefined.`)
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stage = this.stageFromPath(parameter.Name!)
      const entry = this.entryFromParameter(parameter)

      if (has(configs, stage)) {
        configs[stage].entries.push(entry)
      } else {
        configs[stage] = { stage, entries: [entry] }
      }
    })

    return Object.values(configs)
  }

  /**
   * Parses the stage from a SSM key path.
   */
  protected stageFromPath(path: string) {
    const appName = this.config.get('app.name')
    if (!appName) {
      throw new Error(`Unable to determine app name from config.`)
    }

    return path.split('/')[2]
  }

  /**
   * Transforms a SSM Parameter into a RemoteConfigurationEntry.
   */
  protected entryFromParameter(parameter: Parameter): RemoteConfigurationEntry {
    if (!parameter.Name) {
      throw new Error(`Parameter name is undefined.`)
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stage = this.stageFromPath(parameter.Name!)
    const entry = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      key: this.keyFromPath(parameter.Name!, stage),
      value: this.parseConfigValue(parameter.Value),
      type: determineType(parameter.Type),
      description: `Version: ${parameter.Version} - Key: ${parameter.Name} - Last Modified: ${parameter.LastModifiedDate}}`,
    }

    return entry
  }

  /**
   * Formats a value for a SSM Parameter according to the configuration.
   * This is mostly used for NULL values, since AWS SSM does not support null/empty values.
   */
  protected formatEntryValue(value: string | null | undefined) {
    const nullValue = this.getConfigValue<string>('nullValue')
    if (typeof value === 'string') {
      if (value === '') {
        return nullValue
      }
    } else if (!value) {
      return nullValue
    }

    return value
  }

  /**
   * Parses a value from a SSM Parameter according to the configuration.
   * This is mostly used for NULL values, since AWS SSM does not support null/empty values.
   */
  protected parseConfigValue(value: string | undefined) {
    const nullValue = this.getConfigValue('nullValue')
    if (value === nullValue) {
      return null
    }

    return value
  }

  protected pathNamespace(stage: string) {
    return `/${this.config.get('app.name')}/${stage}/`
  }

  /**
   * Turns a key into a namespaced, cleaned up key-path.
   * e.g. key = 'foo/bar_baz' and stage = 'develop' would return '/my-app/develop/foo/bar-baz'
   */
  protected pathFromKey(key: string, stage: string) {
    const transformedKey = sanitizeKey(key)
    return `${this.pathNamespace(stage)}${transformedKey}`
  }

  /**
   * Parses the key from a SSM key path.
   */
  protected keyFromPath(path: string, stage: string) {
    return path.replace(this.pathNamespace(stage), '')
  }
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
