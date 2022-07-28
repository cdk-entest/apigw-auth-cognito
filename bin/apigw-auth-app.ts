#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ApiGwAuthStack, CongitoUserPool } from "../lib/apigw-auth-cognito";

// app
const app = new cdk.App();

// apigw auth stack
new ApiGwAuthStack(app, "ApiGwAuthStack", {
  userPoolId: "ap-southeast-1_90C96FMkf",
  appClientId: "269b23sqm950h5m4l7q48kfn0k",
});

// cognito user pool stack
new CongitoUserPool(app, "CognitoUserPool", {});
