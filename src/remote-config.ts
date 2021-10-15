import { merge, defaults, snakeCase, toUpper, kebabCase } from 'lodash'
import { Config, NULL_VALUE } from './config'
import { createSSMConfigManager } from './aws'
import { SSM } from 'aws-sdk'
import { safeDump } from 'js-yaml'

export interface RemoteConfigurationEntry {
  key: string
  value: string
  type?: string
  description?: string
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
  export function dotenv(values: { [key: string]: SSM.Parameter }) {
    let output = ''
    Object.entries(values).map(([key, parameter]) => {
      if (!parameter.Name) {
        return
      }

      const value = parameter.Value
      const keySegments = key.split('/').map((v) => toUpper(snakeCase(v)))

      output += `# Type: ${parameter.Type}, Version: ${parameter.Version}, Key: ${parameter.Name}\n`
      output += `${keySegments.join('__')}=${value}\n`
    })

    return output
  }

  export function yaml(values: { [key: string]: SSM.Parameter }) {
    return safeDump(values)
  }
}

export async function fetchValues(stages: string[], cfg?: Config) {
  const fetchedParameters = await Promise.all(
    stages.map(async (stage) => ({ stage, values: await fetchValuesByStage(stage, cfg) }))
  )

  const parameters = fetchedParameters.reduce<{ [key: string]: any }>((acc, value) => {
    acc[value.stage] = value.values
    return acc
  }, {})

  return parameters
}

export async function fetchValuesByStage(stage: string, cfg?: Config) {
  const namespace = RemoteConfigurationPath.namespace(stage, cfg)
  const ssm = createSSMConfigManager(cfg)

  let parameterValues = await ssm
    .getParametersByPath({
      Path: namespace,
      Recursive: true,
    })
    .promise()
  let nextToken = parameterValues.NextToken
  while (nextToken) {
    const pagedResult = await ssm
      .getParametersByPath({
        Path: namespace,
        Recursive: true,
        NextToken: nextToken,
      })
      .promise()
    nextToken = pagedResult.NextToken
    parameterValues = {
      ...parameterValues,
      Parameters: [...(pagedResult.Parameters || []), ...(parameterValues.Parameters || [])],
    }
  }

  return parameterValues
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
