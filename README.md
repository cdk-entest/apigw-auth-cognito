---
title: API Gateway Auth with Cognito JWT and Lamba
description: API Gateway Auth with Cognito JWT and Lamba
author: haimtran
publishedDate: 07/27/2022
date: 2022-07-27
---

## Introduction

There are different ways to control access to API Gateway. This note shows two methods

- Part 1. Using cognito userpool and builtin api gw token validation
- Part 2. Using a lambda authorizer

## Part 1. Cognito Authorizer

![1](https://user-images.githubusercontent.com/20411077/221124798-65ff9e7e-68f2-4526-b9dc-c3351e1d77bf.png)

According to the [docs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html), both IdToken and AccessToken can be used to control access to API Gateway. In case of access token, it should be created from hosted ui [here](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-define-resource-servers.html)

create a cognito user pool

```ts
export class CognitoAuthorizer extends Stack {
  public readonly userPool: string;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const pool = new aws_cognito.UserPool(this, "UserPoolDemo", {
      userPoolName: "UserPoolDemo",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const client = pool.addClient("WebClient", {
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
        custom: true,
        userSrp: true,
      },
      userPoolClientName: "WebClient",
    });
    this.userPool = pool.userPoolArn;
  }
}
```

integrate the cognito user pool with a api gateway method

```ts
const apigw = new aws_apigateway.RestApi(this, "ApiGwCognitoDemo", {
  restApiName: "pollyapi",
  deploy: false,
});

const book = apigw.root.addResource("book");
book.addMethod(
  "GET",
  new aws_apigateway.LambdaIntegration(func, {
    proxy: true,
  }),
  {
    authorizationType: aws_apigateway.AuthorizationType.COGNITO,
    authorizer: new aws_apigateway.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    ),
  }
);
```

![2](https://user-images.githubusercontent.com/20411077/221124870-ae9a8645-1091-49bb-a445-afd67226a1a1.png)

- Option 1. Use the IdToken

Use this SDK function to get the IdToken

```py
resp = client.admin_initiate_auth(
        UserPoolId=CONFIG["USER_POOL_ID"],
        ClientId=CONFIG["APP_CLIENT_ID"],
        AuthFlow='ADMIN_NO_SRP_AUTH',
        AuthParameters={
            "USERNAME": CONFIG["USER_NAME"],
            "PASSWORD": CONFIG["PASSWORD"]
        }
    )
```

Put the IdToken into the Authorization header

```py
 response = requests.get(
        url=CONFIG["API_URL"],
        headers={"Authorization": f'Bearer {CONFIG["ACCESS_TOKEN"]}'}
    )
```

- Option 2. Use the access token

Have to setup Cognito hosted UI, cognito resource server, and API Gateway Auth Scope. Get the access token from the hosted UI, then insert the token into request Authorization header

```py
 response = requests.get(
        url=CONFIG["API_URL"],
        headers={"Authorization": f'Bearer {CONFIG["ACCESS_TOKEN"]}'}
    )
```

# Part 2. Lambda Authorizer

[GitHub](https://github.com/entest-hai/apigw-auth-cognito) this uses cognito and lambda to do api authentication and deply by using CDK. Basic concepts:

1. ID providers: [Auth0](https://auth0.com/docs/customize/integrations/aws/aws-api-gateway-custom-authorizers), [cognito](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html), [oicd provider](https://github.com/aws-samples/openbanking-brazilian-auth-samples)
2. Api gateway auth methods: iam, token based (jwt, oauth2), request based, cognito
3. Reference projects: [api-gateway-auth](https://github.com/aws-samples/api-gateway-auth)[openbanking-brazilian-auth-samples](https://github.com/aws-samples/openbanking-brazilian-auth-samples)

![aws_devops-apigw-auth drawio(5)](https://user-images.githubusercontent.com/20411077/181422942-f1ab2bc6-ea90-4696-b6c4-f1e521d026b0.png)

[Details Here](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)

1. User request/get a jwt token from cognito
2. Cognito response a jwt token to the user
3. User send a request with the jwt in the header to apigw
4. Apigw call a lambda auth to [validate the jwt token](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
5. The lamba auth validate and return a temporary iam policy
6. Given the iam policy user request can access things

### Cognito User Pool Stack

```tsx
export class CongitoUserPool extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // cognito user pool
    const userPool = new aws_cognito.UserPool(this, "UserPoolApiAuthDemo", {
      userPoolName: "UserPoolForApiAuthDemo",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
    });

    // add a client
    const client = userPool.addClient("apigw-auth-demo", {
      authFlows: {
        userPassword: true,
        adminUserPassword: true,
        userSrp: true,
        custom: true,
      },
      userPoolClientName: "ApiAuthClient",
    });

    // app client id
    const clientId = client.userPoolClientId;
  }
}
```

pass userPoolId and appClientId from cognito stack to apigw stack in /bin/apigw-auth-app.ts

```tsx
#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApiGwAuthStack, CongitoUserPool } from "../lib/apigw-auth-cognito";

// app
const app = new cdk.App();

// cognito user pool stack
const cognito = new CongitoUserPool(app, "CognitoUserPool", {});

// apigw auth stack
new ApiGwAuthStack(app, "ApiGwAuthStack", {
  userPoolId: cognito.userPoolId,
  appClientId: cognito.appClientId,
});
```

### ApiGw Auth Stack

create an api gateway

```tsx
const api = new aws_apigateway.RestApi(this, "AuthApiDemo", {
  restApiName: "AuthApiDemo",
});
```

create a lambda backend for bussiness logic

```tsx
const lambdaBackend = new aws_lambda.Function(this, "LambdaBackend", {
  functionName: "LambdaBackend",
  runtime: aws_lambda.Runtime.PYTHON_3_9,
  code: aws_lambda.Code.fromAsset(path.join(__dirname, "./../lambda")),
  handler: "lambda_backend.handler",
});
```

create a lambda authorizer

```tsx
const lambdaAuthorizer = new aws_lambda.Function(this, "LambdaAuth", {
  functionName: "LambdaAuth",
  runtime: aws_lambda.Runtime.NODEJS_16_X,
  code: aws_lambda.Code.fromAsset(path.join(__dirname, "./../lambda")),
  handler: "lambda_auth.handler",
  environment: {
    ACCOUNT_ID: this.account,
    API_ID: api.restApiId,
    USER_POOL_ID: props.userPoolId,
    APP_CLIENT_POOL_ID: props.appClientId,
  },
});
```

create an token based authorizer gateway

```tsx
const authorizer = new aws_apigateway.TokenAuthorizer(
  this,
  "JwtTokenAuthLambda",
  {
    handler: lambdaAuthorizer,
    validationRegex:
      "^(Bearer )[a-zA-Z0-9-_]+?.[a-zA-Z0-9-_]+?.([a-zA-Z0-9-_]+)$",
  }
);
```

create a lambda integration target for apigw

```tsx
const apiLambdaIntegration = new aws_apigateway.LambdaIntegration(
  lambdaBackend,
  {
    requestTemplates: { "application/json": '{ "statusCode": "200" }' },
  }
);
```

create a api resource

```tsx
const bookResource = api.root.addResource("book");
```

create a method with authorizer

```tsx
bookResource.addMethod("GET", apiLambdaIntegration, { authorizer });
```

### The Lamba Authorizer

This function has two tasks: 1) verify the cognito jwt token 2) generate iam policy.

use aws-jwt-verify lib to verify the cognito jwt token

```js
import { CognitoJwtVerifier } from "aws-jwt-verify";
```

validate function

```js
async function verifyAccessToken(accessToken) {
  // verifier that expects valid access tokens:
  const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.USER_POOL_ID,
    tokenUse: "access",
    clientId: process.env.APP_CLIENT_ID,
  });
  // decoded token
  let decodedToken;
  try {
    decodedToken = await verifier.verify(accessToken);
    console.log("Token is valid. Payload:", decodedToken);
  } catch {
    decodedToken = {};
    console.log("Token not valid!");
  }
  return decodedToken;
}
```

generate iam policy function

```js
function generateIAMPolicy(scopeClaims) {
  // Declare empty policy statements array
  const policyStatements = [];
  // Iterate over API Permissions
  for (let i = 0; i < apiPermissions.length; i++) {
    // Check if token scopes exist in API Permission
    if (scopeClaims.indexOf(apiPermissions[i].scope) > -1) {
      // User token has appropriate scope, add API permission to policy statements
      policyStatements.push(
        generatePolicyStatement(
          apiPermissions[i].arn,
          apiPermissions[i].stage,
          apiPermissions[i].httpVerb,
          apiPermissions[i].resource,
          "Allow"
        )
      );
    }
  }
  // Check if no policy statements are generated, if so, create default deny all policy statement
  if (policyStatements.length === 0) {
    return defaultDenyAllPolicy;
  } else {
    return generatePolicy("user", policyStatements);
  }
}
```

and lambda handler

```js
export const handler = async (event, context) => {
  // Declare Policy
  let iamPolicy = null;
  // Capture raw token and trim 'Bearer ' string, if present
  const token = event.authorizationToken.replace("Bearer ", "");
  console.log("JWT Token", token);
  // Validate token
  await verifyAccessToken(token)
    .then((data) => {
      // Retrieve token scopes
      console.log("Decoded and Verified JWT Token", JSON.stringify(data));
      // For testing purposes using a ID token without scopes. If you have an access token with scopes,
      // uncomment 'data.claims.scp' and pass the array of scopes present in the scp attribute instead.
      const scopeClaims = ["email"]; // data.claims.scp;
      // Generate IAM Policy
      iamPolicy = generateIAMPolicy(scopeClaims);
    })
    .catch((err) => {
      console.log(err);
      iamPolicy = defaultDenyAllPolicy;
    });
  console.log("IAM Policy", JSON.stringify(iamPolicy));
  return iamPolicy;
};
```

## Testing with Boto3

create a config.json to locally store things for testing. when deploy, can store these in system parameters or secrete maanger, lambda environments, cdk stack references.

```json
{
  "USER_POOL_ID": "",
  "APP_CLIENT_ID": "",
  "USER_EMAIL": "",
  "USER_NAME": "",
  "PASSWORD": "",
  "API_URL": "",
  "token": ""
}
```

test api auth in python using requests

```py
def test_auth_api():
    """
    test auth api using request and jwt token
    """
    # send request with token
    response = requests.get(
        url=CONFIG["API_URL"],
        headers={"Authorization": f'Bearer {CONFIG["token"]}'}
    )
    print(response)
    print(response.json())

```

curl option

```bash
curl -X GET https://$APIID.execute-api.$REGION.amazonaws.com/prod/book -H "Authorization: Bearer $TOKEN"
```

## Project Structure

```
apigw-auth-cognito
--bin
  |--apigw-cognito-auth-app.ts
  |--apigw-lambda-auth-app.ts
--lambda
  |--lambda_hello.py
  |--lambda_auth.js
  |--lamda_backend.py
  |--package.json
--lib
  |--apigw-auth-cognito.ts
  |--apigw-cognito-authorizer.ts
--test
  |--index.html
  |--profile.html
  |--config.js
  |--test_auth.py
```

Basically, need to note a few things

- test_auth.py for testing using SDK
- index.html and profile.html for testing using browser
- it is possible to run html locally or CloudFront

## CDK Synth and Deploy Backend

Before synth and deploy, please ensure to install depedencies. Below steps will do this.

- install dependencies for cdk
- install dependencies for lambda

clone this project

```bash
git clone https://github.com/entest-hai/apigw-auth-cognito
```

go to root project directory

```bash
cd apigw-auth-cognito
```

install dependencies for cdk

```bash
npm install package.json
```

install dependencies for lambda auth (aws-jwt-verify). then cdk will deploy depdencies for this lambda by zipping and uploading.

```bash
cdk lambda
```

and

```
npm install package.json
```

Now synth and deploy. When running cdk synth the below command in cdk.json will be executed to synthesize the apigw-cognito-auth-app into cloudformation template.

```json
"app": "npx ts-node --prefer-ts-exts bin/apigw-cognito-auth-app.ts",
```

To synthesize the lambda authorizer app, thre are two options

- option 1. modify the cdk.json

```json
"app": "npx ts-node --prefer-ts-exts bin/apigw-cognito-auth-app.ts",
```

- option 2. type below custom command right in the terminal to build the lambda authroizer app A

```bash
cdk --app 'npx ts-node --prefer-ts-exts bin/apigw-lambda-auth-app.ts' synth
```
