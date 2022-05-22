import { expect, test } from '@oclif/test'
// import nock from 'nock'
// nock.recorder.rec()

describe('config:set', () => {
  describe('aws', () => {
    test
      .stdout()
      .nock('https://ssm.us-west-2.amazonaws.com', (api) =>
        api
          .post('/', {
            Name: '/test/test/testparam',
            Description: '',
            Value: 'new-value',
            Type: 'String',
            Overwrite: true,
          })
          .reply(200, {
            Version: 2,
          })
      )
      .command([
        'config:set',
        '-c',
        'test/commands/config/aws-config.yaml',
        '-e',
        'testparam=new-value',
        '-s',
        'test',
      ])
      .it('Sets the value for test', (ctx) => {
        expect(ctx.stdout).to.contain('Written values for test')
        expect(ctx.stdout).to.contain('testparam: new-value')
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
              testparam: 'new-value',
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
      .nock('https://vault.internal.msco.dev', (api) =>
        api
          .post('/v1/projects/data/test/test/env', { data: { testparam: 'new-value' } })
          .reply(200, {
            request_id: 'cc3f6ab9-ff32-02b5-d010-c3d7707899be',
            lease_id: '',
            renewable: false,
            lease_duration: 0,
            data: {
              created_time: '2022-05-22T01:27:33.758620348Z',
              custom_metadata: null,
              deletion_time: '',
              destroyed: false,
              version: 40,
            },
            wrap_info: null,
            warnings: null,
            auth: null,
          })
      )
      .command([
        'config:set',
        '-c',
        'test/commands/config/vault-config.yaml',
        '-e',
        'testparam=new-value',
        '-s',
        'test',
      ])
      .it('Sets the value for test', (ctx) => {
        expect(ctx.stdout).to.contain('Written values for test')
        expect(ctx.stdout).to.contain('testparam: new-value')
      })
  })
})
