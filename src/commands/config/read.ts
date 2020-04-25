import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { LoadFileTask } from '../../tasks/loadfile'
import { SaveTask } from '../../tasks/save'

export class ExportCommand extends BaseCommand {
  static aliases = ['config:import']

  static description = `
Read configuration from a file as default a dotfile.`

  static examples = [
    `$ matter config:read -s develop -s local -s develop -i .env
    Reading values for environment (local, develop)
    Success reading values for environment develop
    Success reading values for environment local`,
  ]

  static flags = {
    ...BaseCommand.flags,
    stage: flags.string({
      multiple: true,
      required: true,
      char: 's',
      description: 'Stage(s) (environment).',
    }),
    input: flags.string({
      multiple: false,
      required: true,
      char: 'i',
      description: 'Input file `.env.development`.',
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(ExportCommand)

    const loadFileTask = new LoadFileTask()
    const saveTask = new SaveTask(this.cfg!!)

    const path = flags.input
    const stages = flags.stage

    const msg = `Reading values for environment (${stages.join(', ')})`

    this.log(`${chalk.green.bold(msg)}`)
    const that = this

    const tasks = stages.map(function (stage) {
      return loadFileTask.exec(path, 'dotfile')
        .then(values => saveTask.exec(stage, values))
        .then(() => that.log(`${chalk.green.bold(`Success reading values for environment ${stage}`)}`))
        .catch(() => that.log(`${chalk.green.bold(`Error reading values for environment ${stage}`)}`))
    })
    await Promise.all(tasks)
  }
}
