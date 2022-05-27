interface Result {
  testResults: {
    testFilePath: string;
    testResults: {
      status: string;
      failureMessages: string[];
    }[]
  }[]
}

export class GithubActionsReporter {
  _globalConfig: unknown;
  _options: unknown;

  constructor(globalConfig: unknown, options: unknown) {
    this._globalConfig = globalConfig
    this._options = options
  }

  onRunComplete(_contexts: unknown, results: Result) {
    results.testResults.forEach((testResultItem) => {
      const testFilePath = testResultItem.testFilePath
      testResultItem.testResults.forEach((result) => {
        if (result.status !== 'failed') {
          return
        }
        result.failureMessages.forEach((failureMessages: string) => {
          const newLine = '%0A'
          const message = failureMessages.replace(/\n/g, newLine)
          const captureGroup = message.match(/:([0-9]+):([0-9]+)/)
          if (!captureGroup) {
            console.log('Unable to extract line number from call stack')
            return
          }
          const [, line, col] = captureGroup
          console.log(
            `::error file=${testFilePath},line=${line},col=${col}::${message}`,
          )
        })
      })
    })
  }
};
