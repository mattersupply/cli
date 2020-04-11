import { toUpper, snakeCase, defaults } from 'lodash'
import { flags } from '@oclif/command'
import { BaseCommand } from '../../command'

import * as SSM from 'aws-sdk/clients/ssm'
import * as chalk from 'chalk'
import { createSSMConfigManager } from '../../aws'
import { safeDump } from 'js-yaml'
import { RemoteConfigurationPath, fetchValues, descriptionsByKey } from '../../remote-config'

export class DescribeCommand extends BaseCommand {
  static description = `
Print configuration values for one or multiple stages.
When used with multiple environments and a format option, then the objects will be merged in order of appearance.
This allows us to also fetch default values from another environment, or have local overrides.`

  static examples = [
    `$ matter config:describe -s develop
  ... Prints all SSM configuration values`,
    `$ matter config:describe -s fonne develop --format yaml
  ... Prints configuration values for Fonne, merged with Develop in YAML format.`,
    `$ matter config:describe -s fonne develop common build more andmore yetevenmore --format dotenv
  ... Prints configuration values for Fonne, merged with Develop etc. in Dotenv format.`,
  ]

  static flags = {
    ...BaseCommand.flags,
    format: flags.enum({
      description: 'Output parameters as dotenv or yaml file.',
      options: ['yaml', 'dotenv'],
    }),
    stage: flags.string({
      multiple: true,
      required: true,
      char: 's',
      description: 'Stage (environment) to print.',
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(DescribeCommand)

    const fetchedParameters = await Promise.all(
      flags.stage.map(async (stage) => ({ stage, values: await this.fetchValues(stage) }))
    )

    const parameters = fetchedParameters.reduce<{ [key: string]: any }>((acc, value) => {
      acc[value.stage] = value.values
      return acc
    }, {})

    // this.log('information', 'info')
    // this.log('uh oh!', 'error')
    if (flags.format) {
      const merged = this.mergeDescriptions(parameters)
      if (flags.format === 'dotenv') {
        this.printDescriptionAsDotenv(merged)
      } else if (flags.format === 'yaml') {
        this.log(safeDump(merged))
      }
    } else {
      Object.entries(parameters).map(([stage, params]) => {
        this.log(
          `Configuration Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
            stage
          )})`
        )
        this.log(params)
      })
    }
  }

  async fetchValues(stage: string) {
    return fetchValues(stage, this.cfg)
  }

  printDescriptionAsDotenv(values: { [key: string]: SSM.Parameter }) {
    Object.entries(values).map(([key, parameter]) => {
      if (!parameter.Name) {
        return
      }

      const value = parameter.Value
      this.log(`# Type: ${parameter.Type}, Version: ${parameter.Version}, Key: ${parameter.Name}`)
      this.log(`${toUpper(snakeCase(key))}=${value}`)
    })
  }

  descriptionsByKey(parameters: SSM.ParameterList, stage: string) {
    return descriptionsByKey(parameters, stage, this.cfg)
  }

  mergeDescriptions(descriptions: { [key: string]: SSM.GetParametersByPathResult }) {
    // Reduce over all stages
    const keyedDescriptions = Object.keys(descriptions).map((stage) => {
      return this.descriptionsByKey(descriptions[stage].Parameters || [], stage)
    })

    const merged = defaults(keyedDescriptions[0], ...keyedDescriptions)
    return merged
  }
}
