import { get, defaultsDeep } from 'lodash'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as chalk from 'chalk'
import findUp from 'findup-sync'

// This is because SSM does not support empty values.
export const NULL_VALUE = `NULL`

export const MATTER_CONFIG_PATH = `.matter`
export const MATTER_CONFIG_FILENAME = `config.yml`
export const MATTER_CONFIG_DEAULT_FILENAME = `matter.yml`

// TODO: Are these sensible defaults?
const RequiredPaths = ['app.name']
const ConfigDefaults = {
  app: {
    // name: '...' < This must be provided.
    org: `mattersupply`,
  },
  providers: {},
  environments: [`develop`, `staging`, `production`],
}

export interface Config extends Object {
  get<T = any>(path: string, defaultValue?: T): T | Config | any
}

export async function getMatterConfig(path?: string | null): Promise<Config | undefined> {
  try {
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
      throw new Error(`Unable to read config file: ${path}`)
    }

    const fileContents = fs.readFileSync(path, 'utf8')
    const data = yaml.safeLoad(fileContents)
    defaultsDeep(data, ConfigDefaults)

    const getter = function <T = any>(this: Config, path: string, defaultValue?: T): T | any {
      const ret = get(this, path, defaultValue)

      if (ret instanceof Object) {
        ret.get = getter
      }

      return ret
    }

    data.get = getter

    // data.get = function <T = any>(path: string, defaultValue?: T): T | any {
    //   return get(data, path, defaultValue)
    // }

    if (!data) {
      return undefined
    }

    validate(data)

    // return data
    return data
  } catch (e) {
    console.error(e)
  }
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
