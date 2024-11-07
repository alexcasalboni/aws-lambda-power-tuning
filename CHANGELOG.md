## CHANGELOG (SAR versioning)

From most recent to oldest, with major releases in bold:

* *4.3.6* (2024-11-07): updated dependencies (CVE-2024-41818)
* *4.3.5* (2024-09-16): array-shape input support, JSON logging bugfix, externalized ASL, updated dependencies
* *4.3.4* (2024-02-26): upgrade to Nodejs20, custom state machine prefix, SDKv3 migration, new includeOutputResults input parameter, JSON loggin support
* *4.3.3* (2023-10-30): parametrized currency for visualization URL (USD|CNY)
* *4.3.2* (2023-08-16): new disablePayloadLogs flag, updated documentation
* *4.3.1* (2023-05-09): update dependencies, add VPC Configuration support, use Billed Duration instead Duration from logs, update state machine with ItemSelector
* ***4.3.0*** (2023-03-06): SnapStart support (alias waiter)
* *4.2.3* (2023-03-01): fix layer runtime (nodejs16.x)
* *4.2.2* (2023-02-15): configurable sleep parameter, bump runtime to nodejs16.x, docs updates, GH Actions, and minor bug fixes
* *4.2.1* (2022-08-02): customizable SDK layer name and logs retention value
* ***4.2.0*** (2022-01-03): support S3 payloads
* *4.1.4* (2022-01-03): sorting bugfix and updated dependencies
* *4.1.3* (2021-12-16): support simple strings as event payload
* *4.1.2* (2021-10-12): add x86_64 fallback when Graviton is not supported yet
* *4.1.1* (2021-10-12): fixed connection timeout for long-running functions
* ***4.1.0*** (2021-10-11): support Lambda functions powered by Graviton2
* ***4.0.0*** (2021-08-16): support AWS Lambda states expansion to all functions
* *3.4.2* (2020-12-03): permissions boundary bugfix (Step Functions role)
* *3.4.1* (2020-12-02): permissions boundary support
* ***3.4.0*** (2020-12-01): 1ms billing
* *3.3.3* (2020-07-17): payload logging bugfix for pre-processors
* *3.3.2* (2020-06-17): weighted payloads bugfix (for real)
* *3.3.1* (2020-06-16): weighted payloads bugfix
* ***3.3.0*** (2020-06-10): Pre/Post-processing functions, correct regional pricing, customizable execution timeouts, and other internal improvements
* *3.2.5* (2020-05-19): improved logging for weighted payloads and in case of invocation errors
* *3.2.4* (2020-03-11): dryRun bugfix
* *3.2.3* (2020-02-25): new dryRun input parameter
* *3.2.2* (2020-01-30): upgraded runtime to Node.js 12.x
* *3.2.1* (2020-01-27): improved scripts and SAR template reference
* ***3.2.0*** (2020-01-17): support for weighted payloads
* *3.1.2* (2020-01-17): improved optimal selection when same speed/cost
* *3.1.1* (2019-10-24): customizable least-privilege (lambdaResource CFN param)
* ***3.1.0*** (2019-10-24): $LATEST power reset and optional auto-tuning (new Optimizer step)
* ***3.0.0*** (2019-10-22): dynamic parallelism (powerValues as execution parameter)
* *2.1.3* (2019-10-22): upgraded runtime to Node.js 10.x
* *2.1.2* (2019-10-17): new balanced optimization strategy
* *2.1.1* (2019-10-10): custom domain for visualization URL
* ***2.1.0*** (2019-10-10): average statistics visualization (URL in state machine output)
* ***2.0.0*** (2019-07-28): multiple optimization strategies (cost and speed), new output format with AWS Step Functions and AWS Lambda cost
* *1.3.1* (2019-07-23): retry policies and failed invocations management
* ***1.3.0*** (2019-07-22): implemented error handling
* *1.2.1* (2019-07-22): Node.js refactor and updated IAM permissions (added lambda:UpdateAlias)
* ***1.2.0*** (2019-05-24): updated IAM permissions (least privilege for actions)
* *1.1.1* (2019-05-15): updated docs
* ***1.1.0*** (2019-05-15): cross-region invocation support
* *1.0.1* (2019-05-13): new README for SAR
* ***1.0.0*** (2019-05-13): AWS SAM refactor (published on SAR)
* *0.0.1* (2017-03-27): previous project (serverless framework)