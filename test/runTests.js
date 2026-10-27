// Entry point of the package.json `test` script: runs the Jest suites under
// test/, passing any extra arguments (e.g. --watch) through to Jest.
require('jest').run(process.argv.slice(2));
