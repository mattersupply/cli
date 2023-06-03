import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SSMClient } from '@aws-sdk/client-ssm'
import { Config } from '../matter-config'

export function credentialsProviderFromConfig(config: Config) {
  const provider = defaultProvider({
    profile: config.get('aws.profile'),
  })

  return provider
}

export function createSSMConfigManager(config: Config) {
  const client = new SSMClient({
    region: config.get('aws.region'),
    credentialDefaultProvider: credentialsProviderFromConfig(config) as (input: any) => any,
  })

  return client
}
