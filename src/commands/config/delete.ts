import { flatMap } from 'lodash'
import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { RemoteConfigurationPath } from '../../config/aws/utils'
import { getConfigProvider } from '../../config/factory'

export class DeleteCommand extends BaseCommand {
  static description = `
Deletes configuration entries across multiple stages.`

  static examples = [`$ matter config:delete -s develop -s local -e foo -e baz`]

  static flags = {
    ...BaseCommand.flags,
    entry: flags.string({
      multiple: true,
      required: true,
      char: 'e',
      description: 'Entry/Entries to delete.',
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
    const { flags } = this.parse(DeleteCommand)
    await this.deleteConfigValues(flags.stage, flags.entry)
  }

  async deleteConfigValues(stages: string[], entries: string[]) {
    this.log(
      `Deleting Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
        stages.join(', ')
      )})`
    )

    if (!this.cfg) {
      throw new Error('Config is required.')
    }

    const configProvider = getConfigProvider(this.cfg, this)
    const values = await configProvider?.deleteValues(stages, entries)
    if (!values) {
      throw new Error('Could not delete values.')
    }

    stages.map((stage) => {
      this.log(`Deleted entries for ${chalk.green(stage)}`)

      const configValues = values[stage] || []
      configValues.map((value) => {
        this.log(`\t${chalk.green.bold(value.key)}`)
      })
    })
  }
}
