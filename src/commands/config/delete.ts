import { flatMap } from 'lodash'
import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { RemoteConfigurationPath } from '../../remote-config'
import { createSSMConfigManager } from '../../aws'

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
    const ssm = createSSMConfigManager(this.cfg)
    this.log(
      `Deleting Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
        stages.join(', ')
      )})`
    )

    await Promise.all(
      flatMap(stages, async (stage) =>
        entries.map(async (entry: string) => {
          await ssm
            .deleteParameter({
              Name: RemoteConfigurationPath.pathFromKey(entry, stage, this.cfg, true),
            })
            .promise()

          this.log(`Deleted ${chalk.green.bold(entry)} (${stage})`)
        })
      )
    )
  }
}
