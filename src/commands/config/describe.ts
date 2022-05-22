import { flags } from '@oclif/command'
import { BaseCommand } from '../../command'

import * as chalk from 'chalk'
import { getConfigProvider } from '../../config/factory'

export class DescribeCommand extends BaseCommand {
  static aliases = ['config:print']

  static description = `
Print configuration values for one or multiple stages.
Can be used with --raw to show the values as they're stored by the provider`

  static examples = [
    `$ matter config:describe -s develop
  ... Prints all configuration values for the develop environment`,
    `$ matter config:describe -s fonne develop --raw
  ... Prints all configuration values for the fonne and develop environment in their stored format`,
  ]

  static flags = {
    ...BaseCommand.flags,
    // format: flags.enum({
    //   description: 'Output parameters as dotenv or yaml file.',
    //   options: ['yaml', 'dotenv'],
    // }),
    // output: flags.string({
    //   char: 'o',
    //   description: 'Output filed path',
    // }),
    raw: flags.boolean({
      description: 'Raw output as the values are stored by the provider (if available).',
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
    const { flags } = this.parse(DescribeCommand)

    if (!this.cfg) {
      throw new Error('Config is required.')
    }

    const configProvider = getConfigProvider(this.cfg, this)
    const values = await configProvider?.describeValues(flags.stage, flags.raw)
    if (!values) {
      throw new Error('Could not find values.')
    }

    if (flags.raw) {
      Object.entries(values).map(([stage, params]) => {
        this.log(
          `Configuration Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
            stage
          )})`
        )
        this.log(JSON.stringify(params, null, 2))
      })
    } else {
      flags.stage.map((stage) => {
        this.log(`Values for ${chalk.green(stage)}`)
        const stageValues = values[stage]
        stageValues.map((stageValue) =>
          this.log(`\t${chalk.green.bold(stageValue.key)}: ${chalk.green(stageValue.value)}`)
        )
      })
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
