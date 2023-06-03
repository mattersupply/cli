import { Command, Flags, Args } from '@oclif/core'
import { Config, getMatterConfig } from './lib/matter-config'
import { ArgOutput, FlagOutput } from '@oclif/core/lib/interfaces/parser'

abstract class BaseCommand extends Command {
  static flags = {
    config: Flags.string({
      description: 'Path to config file.',
      char: 'c',
      default: 'matter.yml',
    }),
  }

  static args: {}

  protected parsedArgs?: ArgOutput
  protected parsedFlags?: FlagOutput
  protected cfg?: Config

  async init() {
    const { args, flags } = await this.parse(this.constructor as any)
    this.parsedArgs = args
    this.parsedFlags = flags

    if (this.parsedFlags.config) {
      this.cfg = await getMatterConfig(this.parsedFlags.config)
    }
  }
}

export { BaseCommand }
