import { kebabCase, flatMap } from 'lodash'
import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { RemoteConfigurationEntry, RemoteConfigurationPath } from '../../remote-config'
import { createSSMConfigManager } from '../../aws'

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
    const transformedValues: RemoteConfigurationEntry[] = entries.map((entry) => {
      // Sanitizing input.
      entry.key = kebabCase(entry.key)
      return entry
    })

    const ssm = createSSMConfigManager(this.cfg)
    this.log(
      `Setting Values: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
        stages.join(', ')
      )})`
    )

    await Promise.all(
      flatMap(stages, async (stage) => {
        return transformedValues.map(async (entry: RemoteConfigurationEntry) => {
          await ssm
            .putParameter({
              Name: RemoteConfigurationPath.pathFromKey(entry.key, stage, this.cfg),
              Description: entry.description || '',
              Value: entry.value,
              Type: entry.type || 'String',
              Overwrite: true,
            })
            .promise()

          this.log(`Set ${chalk.green.bold(entry.key)} = ${chalk.bold(entry.value)} (${stage})`)

          return
        })
      })
    )
  }
}
