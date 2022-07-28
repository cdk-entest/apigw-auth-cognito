# API Gateway Auth with Cognito JWT and Lamba Auth

1. There are several IP providers
   - [Auth0](https://auth0.com/docs/customize/integrations/aws/aws-api-gateway-custom-authorizers)
   - [Cognito](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html)
   - [OICD Provider](https://github.com/aws-samples/openbanking-brazilian-auth-samples)
2. API gateway provider different auth methods
   - IAM
   - Token based (JWT, OAuth2)
   - Request based
   - Cognito
3. AWS sample projects

   - [api-gateway-auth](https://github.com/aws-samples/api-gateway-auth) **yaml**
   - [openbanking-brazilian-auth-samples](https://github.com/aws-samples/openbanking-brazilian-auth-samples) **OICD Provider**

Different from the sample projects this.

- Using CDK
- Using Cognito
- [GitHub](https://github.com/entest-hai/apigw-auth-cognito)

## Architecture

![aws_devops-apigw-auth drawio(3)](https://user-images.githubusercontent.com/20411077/181419284-88cdc3e3-134e-42b8-a8ff-f7b67a6d17c7.png)

[Details Here](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)

1. User request/get a jwt token from cognito
2. Cognito response a jwt token to the user
3. User send a request with the jwt in the header to apigw
4. Apigw call a lambda auth to [validate the jwt token](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
5. The lamba auth validate and return a temporary iam policy
6. Given the iam policy user request can access things

## Cognito User Pool Stack

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

## ApiGw Auth Stack

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

## The Lamba Authorizer

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

## How to build and deploy with CDK?

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

cdk synth

```bash
cdk --app 'npx ts-node --prefer-ts-exts bin/apigw-auth-app.ts' synth
```

deploy

```bash
cdk --app 'npx ts-node --prefer-ts-exts bin/apigw-auth-app.ts' deploy --all
```
