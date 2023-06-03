import { flags } from '@oclif/command'
import { BaseCommand } from '../../command'

import * as chalk from 'chalk'
import { createRemoteConfigService } from '../../lib/config'
import { logConfigurations } from '../../lib/config/print'

export class ListCommand extends BaseCommand {
  static description = `Print configuration values for one or multiple stages.`

  static examples = [
    `$ matter config:describe -s develop
  ... Prints all SSM configuration values`,
    `$ matter config:describe -s common develop
  ... Prints configuration values for stages common and develop`,
  ]

  static flags = {
    ...BaseCommand.flags,
    stage: flags.string({
      multiple: true,
      char: 's',
      description: 'Stage (environment) to print.',
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(ListCommand)

    const configService = createRemoteConfigService(this.cfg!)
    const stages =
      flags.stage && flags.stage.length > 0 ? flags.stage : this.cfg!.get('environments')
    const results = await configService.getAllEntries(stages)

    this.debug('results', results)

    this.log(`Configuration Values (App: ${chalk.bold(this.cfg?.get('app.name'))}) `)

    logConfigurations(results, this.log)
  }
}
