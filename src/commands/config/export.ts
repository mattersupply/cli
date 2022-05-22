import { flags } from '@oclif/command'
import { BaseCommand } from '../../command'

import * as chalk from 'chalk'
import { getConfigProvider } from '../../config/factory'
import { RemoteConfigEntryFormatter } from '../../config/format'
import { writeFileSync } from 'fs'

export class ExportCommand extends BaseCommand {
  static description = `
Export configuration values for one or multiple stages.
When used with multiple environments, then the objects will be merged in order of appearance.
This allows us to also fetch default values from another environment, or have local overrides.`

  static examples = [
    `$ matter config:export -s develop
  ... Export all values for the develop environment, defaults to dotenv format`,
    `$ matter config:describe -s fonne develop --format yaml
  ... Export all values for the fonne and develop environment, in YAML. Overrides values from develop with values from fonne.`,
  ]

  static flags = {
    ...BaseCommand.flags,
    format: flags.enum({
      description: 'Output parameters as dotenv or yaml file.',
      options: ['yaml', 'dotenv'],
      default: 'dotenv',
    }),
    output: flags.string({
      char: 'o',
      description: 'Output filed path',
    }),
    stage: flags.string({
      multiple: true,
      required: true,
      char: 's',
      description: 'Stage(s) (environment) to print.',
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(ExportCommand)

    if (!this.cfg) {
      throw new Error('Config is required.')
    }

    const configProvider = getConfigProvider(this.cfg, this)
    const values = await configProvider?.exportValues(flags.stage)
    if (!values) {
      throw new Error('Could not find values.')
    }

    let exported = ''
    if (flags.format === 'dotenv') {
      exported = RemoteConfigEntryFormatter.dotenv(values)
    } else if (flags.format === 'yaml') {
      exported = RemoteConfigEntryFormatter.yaml(values)
    }

    if (flags.output) {
      writeFileSync(flags.output, Buffer.from(exported))
      this.log(`Wrote values to: ${chalk.green.bold(flags.output)}`)
    } else {
      this.log(exported)
    }

    // if (flags.format || flags.output) {
    //   const format = flags.format || 'dotenv'
    //   let output = ''
    //   const merged = combineValues(parameters, this.cfg)
    //   if (format === 'dotenv') {
    //     output = RemoteConfigurationFormatter.dotenv(merged)
    //   } else if (format === 'yaml') {
    //     output = RemoteConfigurationFormatter.yaml(merged)
    //   }

    //   if (flags.output) {
    //     writeFileSync(flags.output, Buffer.from(output))
    //     this.log(`Wrote values to: ${chalk.green.bold(flags.output)}`)
    //   } else {
    //     this.log(output)
    //   }
    // } else {
    //   Object.entries(parameters).map(([stage, params]) => {
    //     this.log(
    //       `Configuration Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
    //         stage
    //       )})`
    //     )
    //     this.log(params)
    //   })
    // }
  }
}
