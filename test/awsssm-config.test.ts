import { assert } from 'chai'
import * as nock from 'nock'
import { AWSSSMRemoteConfigurationService } from '../src/lib/config/aws-ssm'
import { getMatterConfig } from '../src/lib/matter-config'

describe('AWS SSM Config Provider', () => {
  it('', async function () {
    // nock.recorder.rec()

    process.env.AWS_ACCESS_KEY_ID = 'test'
    process.env.AWS_SECRET_ACCESS_KEY = 'testier'
    process.env.AWS_DEFAULT_REGION = 'us-west-2'

    const config = await getMatterConfig('./test/assets/config/aws-ssm.yml')

    const stage = 'test-stage'
    // const configService = new AWSSSMRemoteConfigurationService(config!)

    nock('https://ssm.us-west-2.amazonaws.com:443', { encodedQueryParams: true })
      .post('/', {
        Path: '/my-app/test-stage/',
        Recursive: true,
        WithDecryption: true,
        MaxResults: 10,
      })
      .reply(200, {
        Parameters: [
          {
            ARN: 'arn:aws:ssm:us-west-2:123:parameter/my-app/test-stage/another-test-key',
            DataType: 'text',
            LastModifiedDate: 1686031893.607,
            Name: '/my-app/test-stage/another-test-key',
            Type: 'String',
            Value: 'another-test-value',
            Version: 1,
          },
          {
            ARN: 'arn:aws:ssm:us-west-2:123:parameter/my-app/test-stage/test-key',
            DataType: 'text',
            LastModifiedDate: 1686031893.62,
            Name: '/my-app/test-stage/test-key',
            Type: 'String',
            Value: 'test-value',
            Version: 1,
          },
        ],
      })

    // await configService.getAllEntries([stage])
  })
})
