Generate a weekly recap of the TypeScript lessons completed this week for Kyle, using the "TypeScript for Data & Logic" (R4DS/Goldberg Method) pedagogy.

Here are the topics covered this week:
{{topicsList}}

You MUST return ONLY a valid JSON object. Do not include any introductory or concluding conversational text outside the JSON.

The JSON object must have exactly three keys: "prose", "code", and "followup".
Each value must be a string. Ensure code blocks inside the "code" field are wrapped in triple backticks.

Content Guidelines:
1. "prose": **Weekly Recap** (one sentence overview of the topics), followed by **Key Concepts Summary** (1-2 paragraphs consolidating these concepts, focusing on structural typing for data schemas and mapping dplyr data pipelines to JS array operations). Use emojis for a warm, friendly tone.
2. "code": A cohesive code example that combines several of these topics (e.g., modeling a dataset like mtcars or iris and running a multi-step filter/map/reduce pipeline).
3. "followup": **Weekend Challenge** (a brief, fun prompt for Kyle to practice on archMitters in `typescript_playground` by writing types and pipelines from scratch), **Connection to geminiOS**, and the URL: https://www.typescriptlang.org/play
