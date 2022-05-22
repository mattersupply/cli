# Testing

Testing this can be a bit of a pain in the but due to a lot of network related calls etc.

We're using OCLIF's built-in fancy-test to make this work, using `nock` to mock all API calls. While developing, it can be hard to understand what API calls libraries actually make. This can be simplified using `nock.recorder.rec()` which will show all the calls and responses necessary to mock a command.

Ideally we'd DI all the external libraries so the calls could be mocked, but that's hard given how the OCLIF loads commands.
