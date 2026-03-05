#!/usr/bin/env node
"use strict";
// ============================================================
// ArogyaSutra CDK App Entry Point
// Usage:
//   cd infra
//   npx cdk synth      # Preview the CloudFormation template
//   npx cdk deploy      # Deploy to AWS
//   npx cdk destroy     # Tear down (data retained by policy)
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const arogyasutra_stack_1 = require("../lib/arogyasutra-stack");
const app = new cdk.App();
new arogyasutra_stack_1.ArogyaSutraStack(app, "ArogyaSutraStack", {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2FwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLCtEQUErRDtBQUMvRCxrQ0FBa0M7QUFDbEMsU0FBUztBQUNULGFBQWE7QUFDYiw2REFBNkQ7QUFDN0Qsd0NBQXdDO0FBQ3hDLDhEQUE4RDtBQUM5RCwrREFBK0Q7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRS9ELHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsZ0VBQTREO0FBRTVELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLElBQUksb0NBQWdCLENBQUMsR0FBRyxFQUFFLGtCQUFrQixFQUFFO0lBQzFDLEdBQUcsRUFBRTtRQUNELE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxZQUFZO0tBQ3pEO0lBQ0QsV0FBVyxFQUFFLG9FQUFvRTtJQUNqRixJQUFJLEVBQUU7UUFDRixPQUFPLEVBQUUsYUFBYTtRQUN0QixXQUFXLEVBQUUsWUFBWTtRQUN6QixTQUFTLEVBQUUsS0FBSztLQUNuQjtDQUNKLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vIEFyb2d5YVN1dHJhIENESyBBcHAgRW50cnkgUG9pbnRcclxuLy8gVXNhZ2U6XHJcbi8vICAgY2QgaW5mcmFcclxuLy8gICBucHggY2RrIHN5bnRoICAgICAgIyBQcmV2aWV3IHRoZSBDbG91ZEZvcm1hdGlvbiB0ZW1wbGF0ZVxyXG4vLyAgIG5weCBjZGsgZGVwbG95ICAgICAgIyBEZXBsb3kgdG8gQVdTXHJcbi8vICAgbnB4IGNkayBkZXN0cm95ICAgICAjIFRlYXIgZG93biAoZGF0YSByZXRhaW5lZCBieSBwb2xpY3kpXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuaW1wb3J0IFwic291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyXCI7XHJcbmltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQXJvZ3lhU3V0cmFTdGFjayB9IGZyb20gXCIuLi9saWIvYXJvZ3lhc3V0cmEtc3RhY2tcIjtcclxuXHJcbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XHJcblxyXG5uZXcgQXJvZ3lhU3V0cmFTdGFjayhhcHAsIFwiQXJvZ3lhU3V0cmFTdGFja1wiLCB7XHJcbiAgICBlbnY6IHtcclxuICAgICAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8IFwiYXAtc291dGgtMVwiLFxyXG4gICAgfSxcclxuICAgIGRlc2NyaXB0aW9uOiBcIkFyb2d5YVN1dHJhIFBIUiBQbGF0Zm9ybSDigJQgWmVyby1Lbm93bGVkZ2UgZW5jcnlwdGVkIGhlYWx0aCByZWNvcmRzXCIsXHJcbiAgICB0YWdzOiB7XHJcbiAgICAgICAgUHJvamVjdDogXCJBcm9neWFTdXRyYVwiLFxyXG4gICAgICAgIEVudmlyb25tZW50OiBcInByb2R1Y3Rpb25cIixcclxuICAgICAgICBNYW5hZ2VkQnk6IFwiQ0RLXCIsXHJcbiAgICB9LFxyXG59KTtcclxuXHJcbmFwcC5zeW50aCgpO1xyXG4iXX0=