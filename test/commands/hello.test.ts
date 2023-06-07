import { expect, test } from '@oclif/test'
import { assert } from 'chai'
import * as sinon from 'sinon'

describe('Config', () => {
  describe('AWS SSM', () => {
    // test
    //   .stdout()
    //   .nock('https://ssm.us-west-2.amazonaws.com', (api) =>
    //     api.post('/').reply(200, {
    //       Parameter: {
    //         ARN: 'arn:aws:ssm:us-west-2:111122223333:parameter/test/test/test-param',
    //         DataType: 'text',
    //         LastModifiedDate: 1582657288.8,
    //         Name: 'test-param',
    //         Type: 'String',
    //         Value: 'test-value',
    //         Version: 3,
    //       },
    //     })
    //   )
    //   .command(['config:get'])
    //   .it('gets the specified values', (ctx) => {
    //     expect(ctx.stdout).to.contain('hello world')
    //   })
  })
})
