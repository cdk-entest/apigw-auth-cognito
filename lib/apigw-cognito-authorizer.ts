import {
  aws_apigateway,
  aws_cognito,
  aws_lambda,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from 'fs'
import * as path from 'path'

interface ApiGwCognitoAuthProps extends StackProps {
  userPool: string;
}

export class ApiGwCognitoAuthorizer extends Stack {
  constructor(scope: Construct, id: string, props: ApiGwCognitoAuthProps) {
    super(scope, id, props);

    // look up cognito user pool
    const userPool = aws_cognito.UserPool.fromUserPoolArn(
      this,
      "demoUserPool",
      props.userPool
    );

    // create lambda
    const func = new aws_lambda.Function(this, "ApiGwCognitoAuthDemoFunction", {
      functionName: "ApiGwCognitoAuthDemoFunction",
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      code: aws_lambda.Code.fromInline(
        fs.readFileSync(
          path.resolve(
            __dirname, "./../lambda/lambda_hello.py"
          ),
          { encoding: "utf-8" }
        )
      ),
      timeout: Duration.seconds(10),
      memorySize: 512,
      handler: "index.handler",
    });

    // create api gateway
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
  }
}

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
