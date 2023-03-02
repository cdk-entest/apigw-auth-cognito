// app. for part 2 which using lambda authorizer 
import * as cdk from "aws-cdk-lib";
import { ApiGwAuthStack, CongitoUserPool } from "../lib/apigw-auth-cognito";

// app: lambda authorizer 
const app = new cdk.App();
// cognito user pool stack
const cognito = new CongitoUserPool(app, "CognitoUserPool", {});
// apigw auth stack
const apiGwAuth = new ApiGwAuthStack(app, "ApiGwAuthStack", {
  userPoolId: cognito.userPoolId,
  appClientId: cognito.appClientId,
});
// wait cognito deployed first
apiGwAuth.addDependency(cognito);

