import { toUpper, snakeCase, defaults } from 'lodash'
import { flags } from '@oclif/command'
import { BaseCommand } from '../../command'

import * as chalk from 'chalk'
import { fetchValues, combineValues, RemoteConfigurationFormatter } from '../../remote-config'
import { writeFileSync } from 'fs'

export class DescribeCommand extends BaseCommand {
  static aliases = ['config:print']

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
    output: flags.string({
      char: 'o',
      description: 'Output filed path',
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(DescribeCommand)

    const parameters = await fetchValues(flags.stage, this.cfg)

    // this.log('information', 'info')
    // this.log('uh oh!', 'error')
    if (flags.format || flags.output) {
      const format = flags.format || 'dotenv'
      let output = ''
      const merged = combineValues(parameters, this.cfg)
      if (format === 'dotenv') {
        output = RemoteConfigurationFormatter.dotenv(merged)
      } else if (format === 'yaml') {
        output = RemoteConfigurationFormatter.yaml(merged)
      }

      if (flags.output) {
        writeFileSync(flags.output, Buffer.from(output))
        this.log(`Wrote values to: ${chalk.green.bold(flags.output)}`)
      } else {
        this.log(output)
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
}
