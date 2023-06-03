import { Flags } from '@oclif/core'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { createRemoteConfigService } from '../../lib/config'
import { logConfigurations } from '../../lib/config/print'
export class GetCommand extends BaseCommand {
  static description = `Get configuration entries from multiple stages.`

  static examples = [
    `<%= config.bin %> <%= command.id %> -s develop -s local -e foo bar
  ... Getting values for stages develop and local`,
  ]

  static flags = {
    ...BaseCommand.flags,
    entry: Flags.string({
      multiple: true,
      required: true,
      char: 'e',
      description: 'Entry/Entries to fetch.',
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
    const { flags } = await this.parse(GetCommand)

    const configService = createRemoteConfigService(this.cfg!)
    const stages =
      flags.stage && flags.stage.length > 0 ? flags.stage : this.cfg!.get('environments')
    const results = await configService.getEntries(flags.entry, stages)

    this.debug('results', results)

    this.log(`Configuration Values (App: ${chalk.bold(this.cfg?.get('app.name'))}) `)
    const logger = (message: string, ...args: any[]) => this.log(message, ...args)
    logConfigurations(results, logger)
  }
}
