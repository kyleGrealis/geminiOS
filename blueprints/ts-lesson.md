Generate Lesson {{lessonNumber}}: {{topic}} for Kyle.

You MUST return ONLY a valid JSON object. Do not include any introductory or concluding conversational text outside the JSON.

The JSON object must have exactly three keys: "prose", "code", and "followup".
Each value must be a string. Ensure code blocks inside the "code" field are wrapped in triple backticks.

Content Guidelines:
1. "prose": **What you'll learn** (one sentence), followed by **Concept** (1-2 paragraphs bridging TypeScript and R). No conversational fluff. Include emojis for friendly pacing.
2. "code": Code examples with ```ts or ```R blocks.
3. "followup": **Try it** instruction, **Connection to GeminiOS**, and the URL: https://www.typescriptlang.org/play
