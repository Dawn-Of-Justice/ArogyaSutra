"use strict";
// ============================================================
// VerifyAuthChallenge Lambda
// Verifies the user's response to each challenge step:
//   Step 1: Card ID match
//   Step 2: DOB match
//   Step 3: OTP match
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const handler = async (event) => {
    const expected = event.request.privateChallengeParameters?.answer || "";
    const provided = event.request.challengeAnswer || "";
    // Case-insensitive comparison (for Card ID format variations)
    event.response.answerCorrect =
        provided.trim().toLowerCase() === expected.trim().toLowerCase();
    return event;
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9sYW1iZGEvdmVyaWZ5LWF1dGgvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLCtEQUErRDtBQUMvRCw2QkFBNkI7QUFDN0IsdURBQXVEO0FBQ3ZELDBCQUEwQjtBQUMxQixzQkFBc0I7QUFDdEIsc0JBQXNCO0FBQ3RCLCtEQUErRDs7O0FBSXhELE1BQU0sT0FBTyxHQUFHLEtBQUssRUFDeEIsS0FBOEMsRUFDRSxFQUFFO0lBQ2xELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsMEJBQTBCLEVBQUUsTUFBTSxJQUFJLEVBQUUsQ0FBQztJQUN4RSxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLGVBQWUsSUFBSSxFQUFFLENBQUM7SUFFckQsOERBQThEO0lBQzlELEtBQUssQ0FBQyxRQUFRLENBQUMsYUFBYTtRQUN4QixRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEtBQUssUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBRXBFLE9BQU8sS0FBSyxDQUFDO0FBQ2pCLENBQUMsQ0FBQztBQVhXLFFBQUEsT0FBTyxXQVdsQiIsInNvdXJjZXNDb250ZW50IjpbIi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBWZXJpZnlBdXRoQ2hhbGxlbmdlIExhbWJkYVxyXG4vLyBWZXJpZmllcyB0aGUgdXNlcidzIHJlc3BvbnNlIHRvIGVhY2ggY2hhbGxlbmdlIHN0ZXA6XHJcbi8vICAgU3RlcCAxOiBDYXJkIElEIG1hdGNoXHJcbi8vICAgU3RlcCAyOiBET0IgbWF0Y2hcclxuLy8gICBTdGVwIDM6IE9UUCBtYXRjaFxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmltcG9ydCB0eXBlIHsgVmVyaWZ5QXV0aENoYWxsZW5nZVJlc3BvbnNlVHJpZ2dlckV2ZW50IH0gZnJvbSBcImF3cy1sYW1iZGFcIjtcclxuXHJcbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKFxyXG4gICAgZXZlbnQ6IFZlcmlmeUF1dGhDaGFsbGVuZ2VSZXNwb25zZVRyaWdnZXJFdmVudFxyXG4pOiBQcm9taXNlPFZlcmlmeUF1dGhDaGFsbGVuZ2VSZXNwb25zZVRyaWdnZXJFdmVudD4gPT4ge1xyXG4gICAgY29uc3QgZXhwZWN0ZWQgPSBldmVudC5yZXF1ZXN0LnByaXZhdGVDaGFsbGVuZ2VQYXJhbWV0ZXJzPy5hbnN3ZXIgfHwgXCJcIjtcclxuICAgIGNvbnN0IHByb3ZpZGVkID0gZXZlbnQucmVxdWVzdC5jaGFsbGVuZ2VBbnN3ZXIgfHwgXCJcIjtcclxuXHJcbiAgICAvLyBDYXNlLWluc2Vuc2l0aXZlIGNvbXBhcmlzb24gKGZvciBDYXJkIElEIGZvcm1hdCB2YXJpYXRpb25zKVxyXG4gICAgZXZlbnQucmVzcG9uc2UuYW5zd2VyQ29ycmVjdCA9XHJcbiAgICAgICAgcHJvdmlkZWQudHJpbSgpLnRvTG93ZXJDYXNlKCkgPT09IGV4cGVjdGVkLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAgIHJldHVybiBldmVudDtcclxufTtcclxuIl19