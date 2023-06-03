import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { createRemoteConfigService } from '../../lib/config/'
import { EntryType } from '../../lib/config/config'

export class SetCommand extends BaseCommand {
  static description = `
Set configuration entries from multiple stages.`

  static examples = [
    `$ matter config:set -s develop -s local -e foo=bar -e baz=boz
  ... Setting values for stages develop and local`,
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
    preferSecure: flags.boolean({
      required: false,
      description: 'Prefer secure (encrypted) type for values where possible.',
      default: false,
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(SetCommand)

    const configService = createRemoteConfigService(this.cfg!)
    const stages =
      flags.stage && flags.stage.length > 0 ? flags.stage : this.cfg!.get('environments')

    const entries = flags.entry.map((entry) => {
      const [key, value] = entry.split('=')
      return { key, value, type: flags.preferSecure ? EntryType.secureString : EntryType.string }
    })

    await configService.setEntries(entries, stages)
  }
}
