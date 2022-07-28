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
