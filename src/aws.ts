import * as SSM from 'aws-sdk/clients/ssm'
import * as AWS from 'aws-sdk'
import { Config } from './config'

export function createSSMConfigManager(config?: Config) {
  const credentials = new AWS.SharedIniFileCredentials({ profile: config?.get('aws.profile') })
  if (credentials.accessKeyId) {
    AWS.config.credentials = credentials
  }

  return new SSM({ region: config?.get('aws.region') })
}
