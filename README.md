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
$ matter (-v|--version|version)
@mattersupply/cli/1.0.0-alpha.5 darwin-x64 node-v12.14.1
$ matter --help [COMMAND]
USAGE
  $ matter COMMAND
...
```
<!-- usagestop -->

## Notion

This is an internal tool, so make sure you track as much information as you can here:

https://www.notion.so/mattersupply/CLI-ec537e40999d47ef9b5a5d7c32cf48c6

# Commands

<!-- commands -->
* [`matter config:compare`](#matter-configcompare)
* [`matter config:delete`](#matter-configdelete)
* [`matter config:describe`](#matter-configdescribe)
* [`matter config:get`](#matter-configget)
* [`matter config:set`](#matter-configset)
* [`matter help [COMMAND]`](#matter-help-command)

## `matter config:compare`

Compare Configuration values and types for multiple stages.

```
USAGE
  $ matter config:compare

OPTIONS
  -c, --config=config  [default: matter.yml] Path to config file.
  -s, --stage=stage    (required) Stage(s) (environment) to compare.

DESCRIPTION
  Compare Configuration values and types for multiple stages.
  Useful when you're comparing your configuration against someone else's or prior to promoting from one stage to 
  another, ensuring you have all necessary values.

EXAMPLE
  $ matter config:compare -s develop local
     Validating Configurations: mattersupplyco (develop, local)
     Missing Values:
       local: apollo-key
       local: serverless-access-key
       develop: graphmatter-gateway
     All present types match in configurations: develop, local
```

_See code: [src/commands/config/compare.ts](https://github.com/mattersupply/cli/blob/v1.0.0-alpha.5/src/commands/config/compare.ts)_

## `matter config:delete`

Deletes configuration entries across multiple stages.

```
USAGE
  $ matter config:delete

OPTIONS
  -c, --config=config  [default: matter.yml] Path to config file.
  -e, --entry=entry    (required) Entry/Entries to delete.
  -s, --stage=stage    (required) Stage(s) (environment).

DESCRIPTION
  Deletes configuration entries across multiple stages.

EXAMPLE
  $ matter config:delete -s develop -s local -e foo -e baz
     Deleting Values: mattersupplyco (develop, local)
     Deleted baz (develop)
     Deleted foo (develop)
     Deleted baz (local)
     Deleted foo (local)
```

_See code: [src/commands/config/delete.ts](https://github.com/mattersupply/cli/blob/v1.0.0-alpha.5/src/commands/config/delete.ts)_

## `matter config:describe`

Print configuration values for one or multiple stages.

```
USAGE
  $ matter config:describe

OPTIONS
  -c, --config=config     [default: matter.yml] Path to config file.
  -s, --stage=stage       (required) Stage (environment) to print.
  --format=(yaml|dotenv)  Output parameters as dotenv or yaml file.

DESCRIPTION
  Print configuration values for one or multiple stages.
  When used with multiple environments and a format option, then the objects will be merged in order of appearance.
  This allows us to also fetch default values from another environment, or have local overrides.

EXAMPLES
  $ matter config:describe -s develop
     ... Prints all SSM configuration values
  $ matter config:describe -s fonne develop --format yaml
     ... Prints configuration values for Fonne, merged with Develop in YAML format.
  $ matter config:describe -s fonne develop common build more andmore yetevenmore --format dotenv
     ... Prints configuration values for Fonne, merged with Develop etc. in Dotenv format.
```

_See code: [src/commands/config/describe.ts](https://github.com/mattersupply/cli/blob/v1.0.0-alpha.5/src/commands/config/describe.ts)_

## `matter config:get`

Get configuration entries from multiple stages.

```
USAGE
  $ matter config:get

OPTIONS
  -c, --config=config  [default: matter.yml] Path to config file.
  -e, --entry=entry    (required) Entry/Entries to fetch.
  -s, --stage=stage    (required) Stage(s) (environment).

DESCRIPTION
  Get configuration entries from multiple stages.

EXAMPLE
  $ matter config:get -s develop -s local -e foo=bar -e baz=boz
     Fetching Values: mattersupplyco (develop, local)
     Value baz = boz (develop)
     Value foo = bar (local)
     Value baz = boz (local)
     Value foo = bar (develop)
```

_See code: [src/commands/config/get.ts](https://github.com/mattersupply/cli/blob/v1.0.0-alpha.5/src/commands/config/get.ts)_

## `matter config:set`

Set configuration entries from multiple stages.

```
USAGE
  $ matter config:set

OPTIONS
  -c, --config=config  [default: matter.yml] Path to config file.
  -e, --entry=entry    (required) Entry/Entries to set as `key=value`.
  -s, --stage=stage    (required) Stage(s) (environment).

DESCRIPTION
  Set configuration entries from multiple stages.

EXAMPLE
  $ matter config:set -s develop -s local -e foo=bar -e baz=boz
     Setting Values: mattersupplyco (develop, local)
     Set foo = bar (local)
     Set foo = bar (develop)
     Set baz = boz (local)
     Set baz = boz (develop)
```

_See code: [src/commands/config/set.ts](https://github.com/mattersupply/cli/blob/v1.0.0-alpha.5/src/commands/config/set.ts)_

## `matter help [COMMAND]`

display help for matter

```
USAGE
  $ matter help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.3/src/commands/help.ts)_
<!-- commandsstop -->
