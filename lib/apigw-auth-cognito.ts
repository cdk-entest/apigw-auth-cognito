import {
  aws_apigateway,
  aws_cognito,
  aws_lambda,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

// better be system parameter or secret manager here
// or import from the cognito stack
interface ApiGwAuthStackProps extends StackProps {
  userPoolId: string;
  appClientId: string;
}

export class ApiGwAuthStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGwAuthStackProps) {
    super(scope, id, props);

    // api gateway
    const api = new aws_apigateway.RestApi(this, "AuthApiDemo", {
      restApiName: "AuthApiDemo",
    });

    // lambda busines backend
    const lambdaBackend = new aws_lambda.Function(this, "LambdaBackend", {
      functionName: "LambdaBackend",
      runtime: aws_lambda.Runtime.PYTHON_3_9,
      code: aws_lambda.Code.fromAsset(path.join(__dirname, "./../lambda")),
      handler: "lambda_backend.handler",
    });

    // lambda authorizer
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

    // authorizer api gateway
    const authorizer = new aws_apigateway.TokenAuthorizer(
      this,
      "JwtTokenAuthLambda",
      {
        handler: lambdaAuthorizer,
        validationRegex:
          "^(Bearer )[a-zA-Z0-9-_]+?.[a-zA-Z0-9-_]+?.([a-zA-Z0-9-_]+)$",
      }
    );

    // lambda integration target
    const apiLambdaIntegration = new aws_apigateway.LambdaIntegration(
      lambdaBackend,
      {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      }
    );

    // apigw add resource
    const bookResource = api.root.addResource("book");

    // resource add method
    bookResource.addMethod("GET", apiLambdaIntegration, { authorizer });
  }
}

export class CongitoUserPool extends Stack {
  public readonly userPoolId: string;
  public readonly appClientId: string;

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

    // outputs
    this.userPoolId = userPool.userPoolId;
    this.appClientId = client.userPoolClientId;
  }
}
