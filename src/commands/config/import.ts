import { Flags } from '@oclif/core'
import { BaseCommand } from '../../command'

import { createRemoteConfigService } from '../../lib/config'
import { createRemoteConfigFile } from '../../lib/config/config-file'
import { OutputFormat } from '../../lib/config/config'
import { readFileSync } from 'fs'
import { Config } from '../../lib/matter-config'

export class ImportCommand extends BaseCommand {
  static description = `Imports configuration values for one or multiple stages.`

  static examples = [
    `<%= config.bin %> <%= command.id %> -s develop -i env.yaml --format yaml
  ... Imports configuration values from env.yaml for stage develop in YAML format.`,
    `<%= config.bin %> <%= command.id %> -s common develop -i .env
  ... Imports configuration values from .env for stages common and develop in dotenv format.`,
  ]

  static flags = {
    ...BaseCommand.flags,
    format: Flags.string({
      description: 'Import file as dotenv or yaml file.',
      default: OutputFormat.dotenv,
      options: [OutputFormat.yaml, OutputFormat.dotenv],
    }),
    stage: Flags.string({
      multiple: true,
      char: 's',
      description: 'Stage (environment) to import.',
    }),
    input: Flags.string({
      required: true,
      char: 'i',
      description: 'Import file path',
    }),
    preferSecure: Flags.boolean({
      required: false,
      description: 'Prefer secure (encrypted) type for values where possible.',
      default: false,
    }),
  }

  static args = { ...BaseCommand.args }

  async run() {
    const { flags } = await this.parse(ImportCommand)

    if (!this.cfg) {
      this.error('No configuration found.')
    }

    const config = this.cfg as Config
    const stages = flags.stage && flags.stage.length > 0 ? flags.stage : config.get('stages')

    const configService = await createRemoteConfigService(config)

    // TODO: Maybe this should be a utility function to wrap this logic?
    const configFile = createRemoteConfigFile(flags.format, config)
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
