import { get, defaultsDeep, template } from 'lodash'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as chalk from 'chalk'
import * as findUp from 'findup-sync'

export const MATTER_CONFIG_PATH = `.matter`
export const MATTER_CONFIG_FILENAME = `config.yml`
export const MATTER_CONFIG_DEAULT_FILENAME = `matter.yml`

const templateSettings = {
  interpolate: /\${{[\s]*([a-zA-Z._-]+?)[\s]*}}/g,
}

// TODO: Are these sensible defaults?
const RequiredPaths = ['app.name']
const ConfigDefaults = {
  app: {
    // name: '...' < This must be provided.
    org: `mattersupply`,
  },
  aws: {
    region: `us-east-1`,
    profile: `default`,
  },
  remoteConfig: {
    source: 'awsSsm',
  },
  awsSsm: {
    nullValue: 'NULL',
  },
  stages: [`develop`, `staging`, `production`],
}

export interface Config extends Object {
  get<T = any>(path: string, defaultValue?: T): T | any
}

export async function getMatterConfig(path?: string | null): Promise<Config> {
  if (!path || !fs.existsSync(path)) {
    // Trying to find a config file by:
    // - matter.yml
    // - .config/matter.yml
    // - .matter/config.yml
    // Searching upwards from where we are right now.
    path = findUp([
      MATTER_CONFIG_DEAULT_FILENAME,
      `.config/${MATTER_CONFIG_DEAULT_FILENAME}`,
      `${MATTER_CONFIG_PATH}/${MATTER_CONFIG_FILENAME}`,
    ])
  }

  if (!path) {
    throw new Error(`Unable to read config file`)
  }

  const fileContents = fs.readFileSync(path, 'utf8')
  const templatedFileContents = template(fileContents, templateSettings)({ env: process.env })

  const data = yaml.load(templatedFileContents) as Config
  defaultsDeep(data, ConfigDefaults)

  data.get = function <T = any>(path: string, defaultValue?: T): T | any {
    return get(data, path, defaultValue)
  }

  if (!data) {
    throw new Error(`Unable to read config file`)
  }

  validate(data)
  // return data
  return data
}

export function validate(config: Config) {
  RequiredPaths.map((path) => {
    const value = config.get(path)

    if (!value) {
      console.error(chalk.red.bold('Invalid Configuration:'), `${path} is required`)
      throw new Error(`${path} not found in configuration`)
    }
  })
}
