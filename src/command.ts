import { Command, flags } from '@oclif/command'
import { args, Input, OutputArgs, OutputFlags } from '@oclif/parser'
import { Config, getMatterConfig } from './config'

abstract class BaseCommand extends Command {
  static flags = {
    config: flags.string({
      description: 'Path to config file.',
      char: 'c',
      default: 'matter.yml',
    }),
  }

  static args: args.IArg[] = []

  protected parsedArgs?: OutputArgs<any>
  protected parsedFlags?: OutputFlags<typeof BaseCommand.flags>
  protected cfg?: Config

  async init() {
    const { args, flags } = this.parse(this.constructor as Input<typeof BaseCommand.flags>)
    this.parsedArgs = args
    this.parsedFlags = flags

    if (this.parsedFlags.config) {
      this.cfg = await getMatterConfig(this.parsedFlags.config)
    }
  }
}

export { BaseCommand }
