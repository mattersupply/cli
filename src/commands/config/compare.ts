import { flatMap, uniq } from 'lodash'
import { flags } from '@oclif/command'
import * as chalk from 'chalk'
import { BaseCommand } from '../../command'
import { fetchValues, descriptionsByKey } from '../../remote-config'
import { createSSMConfigManager } from '../../aws'
import { SSM } from 'aws-sdk'

export class CompareCommand extends BaseCommand {
  static description = `
Compare Configuration values and types for multiple stages.
Useful when you're comparing your configuration against someone else's or prior to promoting from one stage to another, ensuring you have all necessary values.
`

  static examples = [
    `$ matter config:compare -s develop local
  Validating Configurations: mattersupplyco (develop, local)
  Missing Values:
    local: apollo-key
    local: serverless-access-key
    develop: graphmatter-gateway
  All present types match in configurations: develop, local
`,
  ]

  static flags = {
    ...BaseCommand.flags,
    stage: flags.string({
      multiple: true,
      required: true,
      char: 's',
      description: 'Stage(s) (environment) to compare.',
    }),
  }

  static args = [...BaseCommand.args]

  async run() {
    const { flags } = this.parse(CompareCommand)
    await this.validateConfigurations(flags.stage)
  }

  async validateConfigurations(stages: string[] = []) {
    if (stages.length === 0) {
      stages = this.cfg?.get('environments') || []
    }

    const ssm = createSSMConfigManager(this.cfg)

    this.log(
      `Validating Configurations: ${chalk.green.bold(this.cfg?.get('app.name'))} (${chalk.green(
        stages.join(', ')
      )})`
    )

    const configurationsByStage: { [key: string]: { [key: string]: SSM.Parameter } } = {}
    const configurations = await Promise.all(
      stages.map(async (stage) => {
        const values = await fetchValues(stage, this.cfg)
        const parameterList = values.Parameters
        if (parameterList) {
          const keyed = descriptionsByKey(parameterList, stage, this.cfg)
          configurationsByStage[stage] = keyed
          return keyed
        }

        return {}
      })
    )

    const allKeys = uniq(flatMap(configurations.map((c: { [key: string]: any }) => Object.keys(c))))

    const mismatchingTypes: {
      stage: string
      key: string
      type: string
      expectedType: string
    }[] = []
    const missingValues: { stage: string; key: string }[] = []

    // Validating that all values exist in all objects and that the types match.
    allKeys.map((key) => {
      let type: string | null = null
      stages.map((stage) => {
        const entry = configurationsByStage[stage][key]
        if (!entry) {
          // Entry doesn't exist for this environment
          missingValues.push({ stage, key })
        } else if (type && entry.Type !== type) {
          // Entry exists in this environment but the type of another environment differs.
          mismatchingTypes.push({ stage, key, expectedType: type, type: entry.Type || 'String' })
        } else if (type === null) {
          // If the type is null, we need to set it for the first time, to compare to other environments.
          type = entry.Type || 'String'
        }
      })

      type = null
    })

    if (missingValues.length > 0) {
      this.log(chalk.red.bold(`Missing Values:`))
      missingValues.map((v) => {
        this.log(chalk.red(`  ${v.stage}: ${chalk.bold(v.key)}`))
      })
    } else {
      this.log(
        chalk.green(`All values present in configurations: ${chalk.bold(stages.join(', '))}`)
      )
    }

    if (mismatchingTypes.length > 0) {
      this.log(chalk.red.bold(`Mismatching Types:`))
      mismatchingTypes.map((v) => {
        this.log(
          chalk.red(
            `  ${v.stage}: ${chalk.bold(v.key)}: Expected ${chalk.bold(
              v.expectedType
            )}, found ${chalk.bold(v.type)}`
          )
        )
      })
    } else {
      this.log(
        chalk.green(`All present types match in configurations: ${chalk.bold(stages.join(', '))}`)
      )
    }

    if (missingValues.length > 0) {
      process.exit(1)
    }

    if (mismatchingTypes.length > 0) {
      process.exit(1)
    }
  }
}
