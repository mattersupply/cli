import { ConfigProvider, RemoteConfigEntry } from '../provider'
import { Config } from '../../config-file'
import {
  combineValues,
  createSSMConfigManager,
  descriptionsByKey,
  RemoteConfigurationFormatter,
  RemoteConfigurationPath,
  RemoteConfigurationValue,
} from './utils'
import { flatMap } from 'lodash'
import Command from '@oclif/command'

export class AwsConfigProvider extends ConfigProvider {
  public ssm: any

  constructor(public cfg: Config, public command: Command) {
    super()
    this.ssm = createSSMConfigManager(this.cfg)
  }

  async getValues(
    stages: string[],
    keys: string[]
  ): Promise<{ [stage: string]: RemoteConfigEntry[] }> {
    const entries = await Promise.all(
      flatMap(stages, (stage) =>
        keys.map(async (key) => {
          const value = await this.ssm
            .getParameter({
              Name: RemoteConfigurationPath.pathFromKey(key, stage, this.cfg, true),
            })
            .promise()

          const parsedValue = RemoteConfigurationValue.parseConfigValue(
            value.Parameter?.Value,
            this.cfg
          )

          return {
            stage,
            key,
            value: parsedValue,
          }
        })
      )
    )

    const entriesByStage = Object.assign(
      {},
      ...stages.map((stage) => ({ [stage]: entries.filter((entry) => entry.stage === stage) }))
    )

    return entriesByStage
  }

  async setValues(
    stages: string[],
    entries: RemoteConfigEntry[]
  ): Promise<{ [stage: string]: RemoteConfigEntry[] }> {
    const transformedValues: RemoteConfigEntry[] = entries.map((entry) => {
      // Sanitizing input.
      entry.key = RemoteConfigurationPath.pathFromKey(entry.key)
      entry.value = RemoteConfigurationValue.formatEntryValue(entry.value)

      return entry
    })

    const writtenEntries = await Promise.all(
      flatMap(stages, (stage) => {
        return transformedValues.map(async (entry: RemoteConfigEntry) => {
          await this.ssm
            .putParameter({
              Name: RemoteConfigurationPath.pathFromKey(entry.key, stage, this.cfg, true),
              Description: entry.description || '',
              Value: entry.value,
              Type: entry.type || 'String',
              Overwrite: true,
            })
            .promise()

          return { ...entry, stage }
        })
      })
    )

    const entriesByStage = Object.assign(
      {},
      ...stages.map((stage) => ({
        [stage]: writtenEntries.filter((entry) => entry.stage === stage),
      }))
    )

    return entriesByStage
  }

  async exportValues(stages: string[]): Promise<RemoteConfigEntry[]> {
    const parameters = await this.fetchValues(stages, this.cfg)
    const combinedEntries = combineValues(parameters, this.cfg)

    return RemoteConfigurationFormatter.entries(combinedEntries)
  }

  async describeValues(
    stages: string[],
    raw: boolean
  ): Promise<{ [stage: string]: RemoteConfigEntry[] | any[] }> {
    const parameters = await this.fetchValues(stages, this.cfg)
    const entries = Object.assign(
      {},
      ...stages.map((stage) => ({
        [stage]: descriptionsByKey(parameters[stage].Parameters, stage, this.cfg),
      }))
    )

    if (raw) {
      return entries
    }

    return Object.assign(
      {},
      ...stages.map((stage) => ({
        [stage]: RemoteConfigurationFormatter.entries(entries[stage]),
      }))
    )
  }

  async deleteValues(
    stages: string[],
    keys: string[]
  ): Promise<{ [key: string]: Pick<RemoteConfigEntry, 'key'>[] }> {
    const deletedEntries = await Promise.all(
      flatMap(stages, (stage) =>
        keys.map(async (key: string) => {
          await this.ssm
            .deleteParameter({
              Name: RemoteConfigurationPath.pathFromKey(key, stage, this.cfg, true),
            })
            .promise()

          return {
            key,
            stage,
          }
        })
      )
    )

    const entriesByStage = Object.assign(
      {},
      ...stages.map((stage) => ({
        [stage]: deletedEntries.filter((entry) => entry.stage === stage),
      }))
    )

    return entriesByStage
  }

  private async fetchValues(stages: string[], cfg?: Config) {
    const fetchedParameters = await Promise.all(
      stages.map(async (stage) => ({ stage, values: await this.fetchValuesByStage(stage, cfg) }))
    )

    const parameters = fetchedParameters.reduce<{ [key: string]: any }>((acc, value) => {
      acc[value.stage] = value.values
      return acc
    }, {})

    return parameters
  }

  private async fetchValuesByStage(stage: string, cfg?: Config) {
    const namespace = RemoteConfigurationPath.namespace(stage, cfg)

    let parameterValues = this.ssm
      .getParametersByPath({
        Path: namespace,
        Recursive: true,
      })
      .promise()
    let nextToken = parameterValues.NextToken
    while (nextToken) {
      const pagedResult = this.ssm
        .getParametersByPath({
          Path: namespace,
          Recursive: true,
          NextToken: nextToken,
        })
        .promise()
      nextToken = pagedResult.NextToken
      parameterValues = {
        ...parameterValues,
        Parameters: [...(pagedResult.Parameters || []), ...(parameterValues.Parameters || [])],
      }
    }

    return parameterValues
  }
}
