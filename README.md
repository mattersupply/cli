# @mattersupply/cli

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@mattersupply/cli.svg)](https://npmjs.org/package/@mattersupply/cli)
[![Downloads/week](https://img.shields.io/npm/dw/@mattersupply/cli.svg)](https://npmjs.org/package/@mattersupply/cli)
[![License](https://img.shields.io/npm/l/@mattersupply/cli.svg)](https://github.com/mattersupply/cli/blob/master/package.json)

## Matter Supply CLI

The Matter Supply CLI is a tool that is used for Matter Supply Projects to:

- Manage Environment Configurations via AWS SSM: `matter config`
- ... more.

At the core is a configuration structure for every project. Every project should have a `matter.yml` file.
If your config file is somewhere else, you can always set the path via `matter -c path/to/config.yml`.

<!-- toc -->
* [@mattersupply/cli](#mattersupplycli)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @mattersupply/cli
$ matter COMMAND
running command...
$ matter (--version)
@mattersupply/cli/1.0.0 linux-x64 node-v16.20.0
$ matter --help [COMMAND]
USAGE
  $ matter COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`matter help [COMMANDS]`](#matter-help-commands)

## `matter help [COMMANDS]`

Display help for matter.

```
USAGE
  $ matter help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for matter.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.9/src/commands/help.ts)_
<!-- commandsstop -->
