import Command from '@oclif/command'
import { Config } from '../config-file'
import { AwsConfigProvider } from './aws/provider'
import { ConfigProvider } from './provider'
import { VaultConfigProvider } from './vault/provider'

export function getConfigProvider(cfg: Config, command: Command): ConfigProvider | undefined {
  const configProviderKey = cfg.get('config.provider')
  if (!configProviderKey) {
    command.error('Please specify a config provider in your configuration file.')
  }

  if (configProviderKey === 'aws') {
    return new AwsConfigProvider(cfg, command)
  } else if (configProviderKey === 'vault') {
    return new VaultConfigProvider(cfg, command)
  }
}
