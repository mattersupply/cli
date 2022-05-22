import { flags } from '@oclif/command'
import chalk from 'chalk'
import { BaseCommand } from '../../command'
import { RemoteConfigurationEntry } from '../../config/aws/utils'
import { getConfigProvider } from '../../config/factory'

export class SetCommand extends BaseCommand {
  static description = `
Set configuration entries from multiple stages.`

  static examples = [
    `$ matter config:set -s develop -s local -e foo=bar -e baz=boz
  Setting Values: mattersupplyco (develop, local)
  Set foo = bar (local)
  Set foo = bar (develop)
  Set baz = boz (local)
  Set baz = boz (develop)`,
  ]

  static flags = {
    ...BaseCommand.flags,
    entry: flags.string({
      multiple: true,
      required: true,
      char: 'e',
      description: 'Entry/Entries to set as `key=value`.',
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
    const { flags } = this.parse(SetCommand)

    const entries = flags.entry.map((entry) => {
      const loc = entry.indexOf('=')
      return {
        key: entry.substring(0, loc).trim(),
        value: entry.substring(loc + 1).trim(),
        type: 'String',
      }
    })

    await this.setConfigValues(flags.stage, entries)
  }

  async setConfigValues(stages: string[], entries: RemoteConfigurationEntry[]) {
    this.log(
      `Setting Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
        stages.join(', ')
      )})`
    )

    if (!this.cfg) {
      throw new Error('Config is required.')
    }

    const configProvider = getConfigProvider(this.cfg, this)
    const values = await configProvider?.setValues(stages, entries)
    if (!values) {
      throw new Error('Could not find values.')
    }

    stages.map((stage) => {
      this.log(`Written values for ${chalk.green(stage)}`)

      const configValues = values[stage] || []
      configValues.map((value) => {
        this.log(`\t${chalk.green.bold(value.key)}: ${chalk.green(value.value)}`)
      })
    })
  }
}
