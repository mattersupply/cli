import { expect, test } from '@oclif/test'

describe('config:get', () => {
  describe('aws', () => {
    test
      .stdout()
      .nock('https://ssm.us-west-2.amazonaws.com', (api) =>
        api.post('/').reply(200, {
          Parameter: {
            ARN: 'arn:aws:ssm:us-west-2:111122223333:parameter/test/test/test-param',
            DataType: 'text',
            LastModifiedDate: 1582657288.8,
            Name: 'test-param',
            Type: 'String',
            Value: 'test-value',
            Version: 3,
          },
        })
      )
      .command([
        'config:get',
        '-c',
        'test/commands/config/aws-config.yaml',
        '-e',
        'test-param',
        '-s',
        'test',
      ])
      .it('Shows the value for test', (ctx) => {
        expect(ctx.stdout).to.contain('Values for test')
        expect(ctx.stdout).to.contain('test-param: test-value')
      })
  })

  describe('vault', () => {
    test
      .stdout()
      .nock('https://vault.internal.msco.dev', (api) =>
        api.get('/v1/projects/data/test/test/env').reply(200, {
          request_id: '4cf1e366-7e9f-c89a-6bdf-e6c8a4ad83c0',
          lease_id: '',
          renewable: false,
          lease_duration: 0,
          data: {
            data: {
              testparam: 'test-value',
            },
            metadata: {
              created_time: '2022-05-21T03:12:28.725183226Z',
              custom_metadata: null,
              deletion_time: '',
              destroyed: false,
              version: 39,
            },
          },
          wrap_info: null,
          warnings: null,
          auth: null,
        })
      )
      .command([
        'config:get',
        '-c',
        'test/commands/config/vault-config.yaml',
        '-e',
        'testparam',
        '-s',
        'test',
      ])
      .it('Shows the value for test', (ctx) => {
        expect(ctx.stdout).to.contain('Values for test')
        expect(ctx.stdout).to.contain('testparam: test-value')
      })
  })
})
