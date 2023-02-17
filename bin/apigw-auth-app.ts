#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApiGwAuthStack, CongitoUserPool } from "../lib/apigw-auth-cognito";
import { ApiGwCognitoAuthorizer, CognitoAuthorizer } from "../lib/apigw-cognito-authorizer";

// app
const app = new cdk.App();

// cognito user pool stack
const cognito = new CongitoUserPool(app, "CognitoUserPool", {});

// apigw auth stack
const apiGwAuth = new ApiGwAuthStack(app, "ApiGwAuthStack", {
  userPoolId: cognito.userPoolId,
  appClientId: cognito.appClientId,
});

// wait cognito deployed first
const app1 = apiGwAuth.addDependency(cognito);

// cognito authorizer 
const cognitoAuth = new CognitoAuthorizer(app1, "CognitoAuthorizer", {})

// apigw cognito user pool 
const apigw = new ApiGwCognitoAuthorizer(app1, "ApiGwCognitoAuthorizer", {
  userPool: cognitoAuth.userPool
})

apigw.addDependency(cognitoAuth)
