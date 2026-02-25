"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/create-auth/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_sns = require("@aws-sdk/client-sns");
var sns = new import_client_sns.SNSClient({ region: process.env.AWS_REGION });
var handler = async (event) => {
  const step = event.request.session.length;
  if (step === 0) {
    event.response.publicChallengeParameters = {
      type: "CARD_ID"
    };
    event.response.privateChallengeParameters = {
      answer: event.request.userAttributes["custom:card_id"] || event.userName
    };
  } else if (step === 1) {
    event.response.publicChallengeParameters = {
      type: "DOB"
    };
    event.response.privateChallengeParameters = {
      answer: event.request.userAttributes["birthdate"] || ""
    };
  } else if (step === 2) {
    const otp = String(Math.floor(1e5 + Math.random() * 9e5));
    const phone = event.request.userAttributes["phone_number"];
    if (phone) {
      await sns.send(
        new import_client_sns.PublishCommand({
          Message: `Your ArogyaSutra verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
          PhoneNumber: phone,
          MessageAttributes: {
            "AWS.SNS.SMS.SenderID": {
              DataType: "String",
              StringValue: "ArogyaOTP"
            },
            "AWS.SNS.SMS.SMSType": {
              DataType: "String",
              StringValue: "Transactional"
            }
          }
        })
      );
    }
    const masked = phone ? `+${phone.slice(1, 3)}XXXXXX${phone.slice(-4)}` : "****";
    event.response.publicChallengeParameters = {
      type: "OTP",
      maskedPhone: masked
    };
    event.response.privateChallengeParameters = {
      answer: otp
    };
  }
  return event;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
