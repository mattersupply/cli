import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { createRemoteConfigService } from '../../lib/config'
import { capitalize } from 'lodash'

export class DeleteCommand extends BaseCommand {
  static description = `
Deletes configuration entries across multiple stages.`

  static examples = [
    `$ matter config:delete -s develop -s local -e foo -e baz
  Deleting Values: mattersupplyco (develop, local)
  Deleted baz (develop)
  Deleted foo (develop)
  Deleted baz (local)
  Deleted foo (local)`,
  ]

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
    const configService = createRemoteConfigService(this.cfg!)
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
