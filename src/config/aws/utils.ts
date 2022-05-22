import { merge, defaults, snakeCase, toUpper, kebabCase } from 'lodash'
import { Config, NULL_VALUE } from '../../config-file'
import { SSM } from 'aws-sdk'
import * as AWS from 'aws-sdk'

export interface RemoteConfigurationEntry {
  key: string
  value: string
  type?: string
  description?: string
}

export function createSSMConfigManager(config?: Config) {
  const credentials = new AWS.SharedIniFileCredentials({
    profile: config?.get('providers.aws.profile'),
  })
  if (credentials.accessKeyId) {
    AWS.config.credentials = credentials
  }

  return new SSM({ region: config?.get('providers.aws.region') })
}

export namespace RemoteConfigurationPath {
  export function namespace(stage?: string, config?: Config) {
    return `/${config ? `${config?.get('app.name')}/` : ''}${stage ? `${stage}/` : ''}`
  }

  export function pathFromKey(
    key: string,
    stage?: string,
    config?: Config,
    addNamespace: boolean = false
  ) {
    const transformedKey = key
      .split('/')
      .map((v) => kebabCase(v))
      .join('/')
      .replace(/\/\//, '/')
    return `${addNamespace ? namespace(stage, config) : ''}${transformedKey}`
  }

  export function keyFromPath(path: string, stage: string, config?: Config) {
    return path.replace(namespace(stage, config), '')
  }
}

export namespace RemoteConfigurationValue {
  export function formatEntryValue(value: any, config?: Config) {
    if (typeof value === 'string') {
      if (value === '') {
        return NULL_VALUE
      }
    }

    return value
  }

  export function parseConfigValue(value: any, config?: Config) {
    if (value === NULL_VALUE) {
      return ''
    }

    return value
  }
}

export namespace RemoteConfigurationFormatter {
  export function entries(values: { [key: string]: SSM.Parameter }) {
    return Object.entries(values).map(([key, parameter]) => ({
      key,
      value: parameter.Value || '',
      description: `Type: ${parameter.Type}, Version: ${parameter.Version}, Key: ${parameter.Name}\n`,
      type: parameter.Type,
    }))
  }
}

export function combineValues(
  valuesByStage: {
    [key: string]: SSM.GetParametersByPathResult
  },
  cfg?: Config
) {
  // Reduce over all stages
  const keyedDescriptions = Object.keys(valuesByStage).map((stage) => {
    return descriptionsByKey(valuesByStage[stage].Parameters || [], stage, cfg)
  })

  const merged = defaults(keyedDescriptions[0], ...keyedDescriptions)
  return merged
}

export function descriptionsByKey(parameters: SSM.ParameterList, stage: string, cfg?: Config) {
  return parameters?.reduce<{ [key: string]: SSM.Parameter }>((parameters, param) => {
    if (!param.Name) {
      throw new Error(`Parameter without a name found.`)
    }

    param.Value = RemoteConfigurationValue.parseConfigValue(param.Value)

    parameters[RemoteConfigurationPath.keyFromPath(param.Name, stage, cfg)] = param
    return parameters
  }, {})
}
