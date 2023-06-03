import { flags } from '@oclif/command'
import { BaseCommand } from '../../command'

import { createRemoteConfigService } from '../../lib/config'
import { createRemoteConfigFile } from '../../lib/config/config-file'
import { combineEntries } from '../../lib/config/utils'
import { OutputFormat } from '../../lib/config/config'
import { readFileSync } from 'fs'

export class ImportCommand extends BaseCommand {
  static description = `Exports configuration values for one or multiple stages.`

  static examples = [
    `$ matter config:import -s develop -i env.yaml --format yaml
  ... Imports configuration values from env.yaml for stage develop in YAML format.`,
    `$ matter config:import -s common develop -i .env
  ... Imports configuration values from .env for stages common and develop in dotenv format.`,
  ]

  static flags = {
    ...BaseCommand.flags,
    format: flags.enum({
      description: 'Import file as dotenv or yaml file.',
      default: OutputFormat.dotenv,
      options: [OutputFormat.yaml, OutputFormat.dotenv],
    }),
    stage: flags.string({
      multiple: true,
      char: 's',
      description: 'Stage (environment) to import.',
    }),
    input: flags.string({
      required: true,
      char: 'i',
      description: 'Import file path',
    }),
    preferSecure: flags.boolean({
      required: false,
      description: 'Prefer secure (encrypted) type for values where possible.',
      default: false,
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(ImportCommand)

    const configService = createRemoteConfigService(this.cfg!)
    const stages =
      flags.stage && flags.stage.length > 0 ? flags.stage : this.cfg!.get('environments')

    // TODO: Maybe this should be a utility function to wrap this logic?
    const configFile = createRemoteConfigFile(flags.format, this.cfg!)
    const inputFileContents = readFileSync(flags.input)
    configFile.loadBuffer(inputFileContents)
    configFile.setUseSecureEntries(flags.preferSecure)

    const entries = configFile.toEntries()

    if (!entries) {
      this.error('No entries found in import file.')
    }

    await configService.setEntries(entries, stages)
  }
}
