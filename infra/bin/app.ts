#!/usr/bin/env node
// ============================================================
// ArogyaSutra CDK App Entry Point
// Usage:
//   cd infra
//   npx cdk synth      # Preview the CloudFormation template
//   npx cdk deploy      # Deploy to AWS
//   npx cdk destroy     # Tear down (data retained by policy)
// ============================================================

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ArogyaSutraStack } from "../lib/arogyasutra-stack";

const app = new cdk.App();

new ArogyaSutraStack(app, "ArogyaSutraStack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || "ap-south-1",
    },
    description: "ArogyaSutra PHR Platform — Zero-Knowledge encrypted health records",
    tags: {
        Project: "ArogyaSutra",
        Environment: "production",
        ManagedBy: "CDK",
    },
});

app.synth();
