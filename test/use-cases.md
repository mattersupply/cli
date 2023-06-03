./bin/dev config:list -c test/assets/test-matter.yml
./bin/dev config:list -c test/assets/test-matter.yml -s my-stage my-other-stage

./bin/dev config:set -c test/assets/test-matter.yml -s my-stage my-other-stage -e test-key=test-value another-test-key=another-test-value
./bin/dev config:set -c test/assets/test-matter.yml -s my-stage my-other-stage -e test/nested/key=nested-value

./bin/dev config:delete -c test/assets/test-matter.yml -s my-stage -e test-key

./bin/dev config:get -c test/assets/test-matter.yml -s my-stage my-other-stage -e test-key another-test-key test/nested/key

./bin/dev config:set -c test/assets/test-matter.yml -s my-stage -e override-key=my-stage-value
./bin/dev config:set -c test/assets/test-matter.yml -s my-other-stage -e override-key=my-other-stage-value
./bin/dev config:export -c test/assets/test-matter.yml -s my-stage my-other-stage
./bin/dev config:export -c test/assets/test-matter.yml -s my-other-stage my-stage -e override-key

./bin/dev config:export -c test/assets/test-matter.yml -s my-other-stage my-stage --format yaml

./bin/dev config:export -c test/assets/test-matter.yml -s my-other-stage my-stage --format yaml -o /tmp/out.yaml
./bin/dev config:export -c test/assets/test-matter.yml -s my-other-stage my-stage --format dotenv -o /tmp/out.dotenv

./bin/dev config:import -c test/assets/test-matter.yml -s my-other-stage my-stage -i test/assets/test-out.env
./bin/dev config:import -c test/assets/test-matter.yml -s my-other-stage my-stage --format yaml -i test/assets/test-out.yml

./bin/dev config:delete -c test/assets/test-matter.yml -s my-other-stage my-stage -e test-key another-test-key test/nested/key override-key imported/nested/key imported/nested/yaml-key
