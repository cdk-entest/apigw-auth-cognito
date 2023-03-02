// app1. for part 1 which using cognito authorizer with apigw builtin token validation 
import * as cdk from "aws-cdk-lib";
import { ApiGwCognitoAuthorizer, CognitoAuthorizer } from "../lib/apigw-cognito-authorizer";


// app: cognito authorizer and apigw with builtin token validation 
const app = new cdk.App()
// cognito authorizer 
const cognitoAuth = new CognitoAuthorizer(app, "CognitoAuthorizer", {})
// apigw cognito user pool 
const apigw = new ApiGwCognitoAuthorizer(app, "ApiGwCognitoAuthorizer", {
  userPool: cognitoAuth.userPool
})
apigw.addDependency(cognitoAuth)


