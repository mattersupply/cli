import { Flags } from '@oclif/core'
import { BaseCommand } from '../../command'

import { createRemoteConfigService } from '../../lib/config'
import { createRemoteConfigFile } from '../../lib/config/config-file'
import { OutputFormat } from '../../lib/config/config'

export class ExportCommand extends BaseCommand {
  static description = `Exports configuration values for one or multiple stages.`

  static examples = [
    `<%= config.bin %> <%= command.id %> -s develop
  ... Exports merged configuration values in dotenv format`,
    `<%= config.bin %> <%= command.id %> -s develop -e foo bar
  ... Exports merged configuration values in dotenv format, filtering for foo and bar`,
    `<%= config.bin %> <%= command.id %> -s common develop --format yaml
  ... Exports merged configuration values for stages common and develop in YAML format.`,
    `<%= config.bin %> <%= command.id %> -s common develop --format yaml --output config.yml
  ... Exports merged configuration values for stages common and develop in YAML format to config.yml`,
  ]

  static flags = {
    ...BaseCommand.flags,
    entry: Flags.string({
      multiple: true,
      char: 'e',
      description: 'Entry/Entries to fetch.',
    }),
    format: Flags.string({
      description: 'Output parameters as dotenv or yaml file.',
      default: OutputFormat.dotenv,
      options: [OutputFormat.yaml, OutputFormat.dotenv],
    }),
    stage: Flags.string({
      multiple: true,
      char: 's',
      description: 'Stage (environment) to print.',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path',
    }),
    description: Flags.boolean({
      char: 'd',
      description: 'Add description to output file',
      default: false,
    }),
  }

  static args = { ...BaseCommand.args }

  async run() {
    const { flags } = await this.parse(ExportCommand)

    const configService = createRemoteConfigService(this.cfg!)
    const stages =
      flags.stage && flags.stage.length > 0 ? flags.stage : this.cfg!.get('environments')

    let combinedEntries = []
    if (flags.entry && flags.entry.length > 0) {
      combinedEntries = await configService.getCombinedEntries(flags.entry, stages)
    } else {
      combinedEntries = await configService.getAllCombinedEntries(stages)
    }

    // TODO: Maybe this should be a utility function to wrap this logic?
    const configFile = createRemoteConfigFile(flags.format, this.cfg!)
    configFile.setShowDescription(flags.description)
    configFile.setShowType(false)
    configFile.loadEntries(combinedEntries)
    this.debug(combinedEntries)

    if (flags.output) {
      configFile.write(flags.output)
    } else {
      const output = configFile.toBuffer()
      this.log(output.toString())
    }
  }
}
