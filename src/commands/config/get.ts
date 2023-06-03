import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { createRemoteConfigService } from '../../lib/config'
import { logConfigurations } from '../../lib/config/print'
export class GetCommand extends BaseCommand {
  static description = `
Get configuration entries from multiple stages.`

  static examples = [
    `$ matter config:get -s develop -s local -e foo bar
  ... Getting values for stages develop and local`,
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

    const configService = createRemoteConfigService(this.cfg!)
    const stages =
      flags.stage && flags.stage.length > 0 ? flags.stage : this.cfg!.get('environments')
    const results = await configService.getEntries(flags.entry, stages)

    this.debug('results', results)

    this.log(`Configuration Values (App: ${chalk.bold(this.cfg?.get('app.name'))}) `)
    logConfigurations(results, this.log)
  }
}
