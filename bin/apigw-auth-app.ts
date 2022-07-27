#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ApiGwAuthStack, CongitoUserPool } from "../lib/apigw-auth-cognito";

// app
const app = new cdk.App();

// apigw auth stack
new ApiGwAuthStack(app, "ApiGwAuthStack", {});

// cognito user pool stack
new CongitoUserPool(app, "CognitoUserPool", {});
