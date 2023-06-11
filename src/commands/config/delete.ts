import { Flags } from '@oclif/core'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { createRemoteConfigService } from '../../lib/config'
import { capitalize } from 'lodash'

export class DeleteCommand extends BaseCommand {
  static description = `Deletes configuration entries across multiple stages.`

  static examples = [
    `<%= config.bin %> <%= command.id %> -s develop -s local -e foo -e baz
 ... Deleting values for stages develop and local`,
  ]

  static flags = {
    ...BaseCommand.flags,
    entry: Flags.string({
      multiple: true,
      required: true,
      char: 'e',
      description: 'Entry/Entries to delete.',
    }),
    stage: Flags.string({
      multiple: true,
      required: true,
      char: 's',
      description: 'Stage(s) (environment).',
    }),
  }

  static args = { ...BaseCommand.args }

  async run() {
    const { flags } = await this.parse(DeleteCommand)
    await this.deleteConfigValues(flags.stage, flags.entry)
  }

  async deleteConfigValues(stages: string[], entries: string[]) {
    const configService = await createRemoteConfigService(this.cfg!)
    const results = await configService.deleteEntries(entries, stages)

    this.debug('results', results)

    this.log(`Deleted Values (App: ${chalk.bold(this.cfg?.get('app.name'))}) `)
    results.forEach((result) => {
      const statuses = ['deleted', 'failed'] as ('deleted' | 'failed')[]

      statuses.forEach((status) => {
        if (result[status].length > 0) {
          const chalkFn = status === 'deleted' ? chalk.green : chalk.red
          this.log(`  Stage: ${chalk.bold(result.stage)} ${chalkFn(capitalize(status))}:`)

          result[status].forEach((key) => {
            this.log(`    - ${chalk.bold(key)}`)
          })
        }
      })
    })
  }
}
