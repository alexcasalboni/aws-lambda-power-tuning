# How to deploy the AWS Lambda Power Tuning using the CDK for Python

This CDK project deploys *AWS Lambda Power Tuning* using Python.

You can use the project as a standalone or reuse it within your own CDK projects.


## CDK Prerequisites

See [here](../README.md).


## Language specific prerequisites

- [Python 3.6 or later](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)
- [Requirements for CDK with Python](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-python.html)

## Virtualenv setup and requirements 

To manually create a virtualenv on MacOS and Linux:

```bash
$ python -m venv .venv
```

After the init process completes and the virtualenv is created, you can use the following
step to activate your virtualenv.

```bash
$ source .venv/bin/activate
```

If you are on Windows platform, you would activate the virtualenv like this:

```bash
% .venv\Scripts\activate.bat
```

Once the virtualenv is activated, you can install the required dependencies.
```bash
$ pip install -r requirements.txt
```

## Building, testing, and deploying the app
* `pytest`  test this app
* `cdk deploy`  	 deploy this app
