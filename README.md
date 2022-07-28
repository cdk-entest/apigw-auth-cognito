# API Gateway Authentication with Cognito JWT and Lamba Authorizer

1. There are several IP providers, here using cognito
2. API gateway provider different auth methods
   - IAM
   - Token based (JWT, OAuth2)
   - Request based
   - Cognito

## Architecture

![custom-auth-workflow](https://user-images.githubusercontent.com/20411077/181411172-022c8cd9-ea30-433e-a5fc-ec8c9622bf90.png)


[Details Here](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)

1. User request/get a jwt token from cognito
2. User send a request with the jwt in the header to apigw
3. Apigw call a lambda auth to [validate the jwt token](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
4. The lamba auth validate and return a temporary iam policy
5. Given the iam policy user request can access thingsz

## Cognito User Pool Stack

```bash
manually by aws console
```

take note userPoolId and appClientId which needes for the ApiGw Auth Stack and local testing.

```js
// apigw auth stack
new ApiGwAuthStack(app, "ApiGwAuthStack", {
  userPoolId: "",
  appClientId: "",
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
function generatePolicy(principalId, policyStatements) {
  // Generate a fully formed IAM policy
  const authResponse = {};
  authResponse.principalId = principalId;
  const policyDocument = {};
  policyDocument.Version = "2012-10-17";
  policyDocument.Statement = policyStatements;
  authResponse.policyDocument = policyDocument;
  return authResponse;
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

## CDK Build and Deploy

synth

```bash
cdk --app 'npx ts-node --prefer-ts-exts bin/apigw-auth-app.ts' synth
```

deploy

```bash
cdk --app 'npx ts-node --prefer-ts-exts bin/apigw-auth-app.ts' deploy
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
