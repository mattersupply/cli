import { flags } from '@oclif/command'
import chalk from 'chalk'
import { BaseCommand } from '../../command'
import { getConfigProvider } from '../../config/factory'

export class GetCommand extends BaseCommand {
  static description = `
Get configuration entries from multiple stages.`

  static examples = [
    `$ matter config:get -s develop -s local -e foo=bar -e baz=boz
  Fetching Values: mattersupplyco (develop, local)
  Value baz = boz (develop)
  Value foo = bar (local)
  Value baz = boz (local)
  Value foo = bar (develop)`,
  ]

  static flags = {
    ...BaseCommand.flags,
    entry: flags.string({
      multiple: true,
      required: true,
      char: 'e',
      description: 'Entry/Entries to fetch.',
    }),
    stage: flags.string({
      multiple: true,
      required: true,
      char: 's',
      description: 'Stage(s) (environment).',
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(GetCommand)
    await this.getConfigValues(flags.stage, flags.entry)
  }

  async getConfigValues(stages: string[], entries: string[]) {
    this.log(
      `Fetching Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
        stages.join(', ')
      )})`
    )

    if (!this.cfg) {
      throw new Error('Config is required.')
    }
    this.log(process.cwd())

    const configProvider = getConfigProvider(this.cfg, this)
    const values = await configProvider?.getValues(stages, entries)
    if (!values) {
      throw new Error('Could not find values.')
    }

    stages.map((stage) => {
      this.log(`Values for ${chalk.green(stage)}`)

      const configValues = values[stage] || []
      configValues.map((value) => {
        if (value.value === undefined || value.value === null) {
          this.log(`\t${chalk.yellow.bold(value.key)}: ${chalk.yellow(value.value)}`)
        } else {
          this.log(`\t${chalk.green.bold(value.key)}: ${chalk.green(value.value)}`)
        }
      })
    })
  }
}
