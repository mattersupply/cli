import { Flags } from '@oclif/core'
import { BaseCommand } from '../../command'

import * as chalk from 'chalk'
import { createRemoteConfigService } from '../../lib/config'
import { logConfigurations } from '../../lib/config/print'

export class ListCommand extends BaseCommand {
  static description = `Print configuration values for one or multiple stages.`

  static examples = [
    `<%= config.bin %> <%= command.id %> -s develop
  ... Prints all SSM configuration values`,
    `<%= config.bin %> <%= command.id %> -s common develop
  ... Prints configuration values for stages common and develop`,
  ]

  static flags = {
    ...BaseCommand.flags,
    stage: Flags.string({
      multiple: true,
      char: 's',
      description: 'Stage (environment) to print.',
    }),
  }

  static args = { ...BaseCommand.args }

  async run() {
    const { flags } = await this.parse(ListCommand)

    const configService = createRemoteConfigService(this.cfg!)
    const stages =
      flags.stage && flags.stage.length > 0 ? flags.stage : this.cfg!.get('environments')
    const results = await configService.getAllEntries(stages)

    this.debug('results', results)

    this.log(`Configuration Values (App: ${chalk.bold(this.cfg?.get('app.name'))}) `)
    const logger = (message: string, ...args: any[]) => this.log(message, ...args)
    logConfigurations(results, logger)
  }
}
