import { flags } from '@oclif/command'
import { BaseCommand } from '../../command'
import * as dotenv from 'dotenv'

import * as chalk from 'chalk'
import { getConfigProvider } from '../../config/factory'
import { DotenvFormatter, RemoteConfigEntryFormatter } from '../../config/format'
import { readFileSync } from 'fs'

export class ExportCommand extends BaseCommand {
  static description = `
Import configuration values for one or multiple stages.`

  static examples = [
    `$ matter config:import -s develop -i .env
  ... Imports and sets all values from .env to develop environment`,
  ]

  static flags = {
    ...BaseCommand.flags,
    // format: flags.enum({
    //   description: 'Output parameters as dotenv or yaml file.',
    //   options: ['yaml', 'dotenv'],
    //   default: 'dotenv',
    // }),
    input: flags.string({
      char: 'i',
      required: true,
      description: 'Input file path',
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
    const fileBuffer = readFileSync(flags.input!)
    const values = dotenv.parse(fileBuffer)

    const entries = DotenvFormatter.entries(values)

    const writtenValues = await configProvider?.setValues(flags.stage, entries)
    if (!writtenValues) {
      throw new Error('Could not write values.')
    }

    flags.stage.map((stage) => {
      this.log(`Written values for ${chalk.green(stage)}`)

      const configValues = writtenValues[stage] || []
      configValues.map((value) => {
        this.log(`\t${chalk.green.bold(value.key)}: ${chalk.green(value.value)}`)
      })
    })

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
