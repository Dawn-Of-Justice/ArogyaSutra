// AWS integrations barrel export
export * as cognito from "./cognito";
export * as s3 from "./s3";
export * as textract from "./textract";
export * as comprehend from "./comprehend";
export * as bedrock from "./bedrock";
export * as healthlake from "./healthlake";
export * as sns from "./sns";
export * as dynamodb from "./dynamodb";
export * as kms from "./kms";

// Startup credential check — logs a clear warning in Amplify CloudWatch if
// APP_AWS_* env vars are missing, instead of a cryptic SDK error later.
if (typeof process !== "undefined" && process.env.NEXT_RUNTIME === "nodejs") {
    const missing: string[] = [];
    if (!process.env.APP_AWS_ACCESS_KEY_ID)     missing.push("APP_AWS_ACCESS_KEY_ID");
    if (!process.env.APP_AWS_SECRET_ACCESS_KEY) missing.push("APP_AWS_SECRET_ACCESS_KEY");
    if (!process.env.KMS_KEY_ID)                missing.push("KMS_KEY_ID");
    if (missing.length > 0) {
        console.error(
            `[ArogyaSutra] ⚠️  Missing environment variables: ${missing.join(", ")}.\n` +
            `  Set them in Amplify Console → Hosting → Environment variables, then redeploy.\n` +
            `  AWS SDK will fall back to the IAM execution role — attach one if you removed the keys.`
        );
    }
}
