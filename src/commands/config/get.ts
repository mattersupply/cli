import { flatMap } from 'lodash'
import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { RemoteConfigurationPath } from '../../remote-config'
import { createSSMConfigManager } from '../../aws'

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
    const ssm = createSSMConfigManager(this.cfg)
    this.log(
      `Fetching Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
        stages.join(', ')
      )})`
    )

    await Promise.all(
      flatMap(stages, async (stage) =>
        entries.map(async (entry: string) => {
          const value = await ssm
            .getParameter({
              Name: RemoteConfigurationPath.pathFromKey(entry, stage, this.cfg),
            })
            .promise()

          this.log(
            `Value ${chalk.green.bold(entry)} = ${chalk.green(value.Parameter?.Value)} (${stage})`
          )
        })
      )
    )
  }
}
