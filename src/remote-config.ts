import { merge, snakeCase, toUpper, kebabCase } from 'lodash'
import { Config } from './config'
import { createSSMConfigManager } from './aws'
import { SSM } from 'aws-sdk'

export interface RemoteConfigurationEntry {
  key: string
  value: string
  type?: string
  description?: string
}

export namespace RemoteConfigurationPath {
  export function namespace(stage: string, config?: Config) {
    return `/${config?.get('app.name')}/${stage}/`
  }

  export function pathFromKey(key: string, stage: string, config?: Config) {
    return `${namespace(stage, config)}${kebabCase(key)}`
  }

  export function keyFromPath(path: string, stage: string, config?: Config) {
    return path.replace(namespace(stage, config), '')
  }

  export function dotenvKeyFromPath(path: string, stage: string, config?: Config) {
    const key = keyFromPath(path, stage, config)
    return toUpper(snakeCase(key))
  }
}

export async function fetchValues(stage: string, cfg?: Config) {
  const namespace = RemoteConfigurationPath.namespace(stage, cfg)
  const ssm = createSSMConfigManager(cfg)

  let parameterValues = await ssm
    .getParametersByPath({
      Path: namespace,
    })
    .promise()
  let nextToken = parameterValues.NextToken
  while (nextToken) {
    const pagedResult = await ssm
      .getParametersByPath({
        Path: namespace,
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

export function descriptionsByKey(parameters: SSM.ParameterList, stage: string, cfg?: Config) {
  return parameters?.reduce<{ [key: string]: SSM.Parameter }>((parameters, param) => {
    if (!param.Name) {
      throw new Error(`Parameter without a name found.`)
    }

    parameters[RemoteConfigurationPath.keyFromPath(param.Name, stage, cfg)] = param
    return parameters
  }, {})
}
