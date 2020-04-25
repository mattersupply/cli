import * as SSM from 'aws-sdk/clients/ssm'
import * as AWS from 'aws-sdk'
import { Config } from '../config'
import { Pair } from './ini'
import { RemoteConfigurationPath } from '../remote-config'
import { kebabCase } from 'lodash'

export class SaveTask {

  private readonly config: Config
  private readonly ssm: SSM

  constructor(config: Config) {
    this.config = config
    const credentials = new AWS.SharedIniFileCredentials({ profile: config.get('aws.profile') })
    AWS.config.credentials = credentials
    this.ssm = new SSM({ region: config.get('aws.region') })
  }

  async taskFor(stage:string, value: Pair) {
    return this.ssm
      .putParameter({
        Name: RemoteConfigurationPath.pathFromKey(kebabCase(value.key), stage, this.config),
        Value: value.value,
        Type: 'String',
        Overwrite: true,
      })
      .promise()
  }

  async exec(stage: string, values: Pair[]): Promise<any> {
    const tasks = values.map(value => this.taskFor(stage, value))
    return Promise.all(tasks)
  }
}
