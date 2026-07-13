Generate Lesson {{lessonNumber}}: {{topic}} for Kyle, based on the pedagogical style, progression, and concepts from Josh Goldberg's book "Learning TypeScript" but strictly taught through the lens of Hadley Wickham's "R for Data Science" (R4DS).

You MUST return ONLY a valid JSON object. Do not include any introductory or concluding conversational text outside the JSON.

The JSON object must have exactly three keys: "prose", "code", and "followup".
Each value must be a string. Ensure code blocks inside the "code" field are wrapped in triple backticks.

Content Guidelines:
1. "prose": 
   - **What you'll learn** (one sentence).
   - **Concept** (1-2 paragraphs explaining the chapter's focus. SKIP basic primitive types filler like explaining what a string, number, or boolean is. Instead, immediately ground the concepts in R data structures: e.g., mapping tabular dataframes to TypeScript object arrays, and comparing JS/TS callback array methods to dplyr operations). No conversational fluff. Include emojis for friendly pacing.
2. "code":
   - Side-by-side or clean comparison code blocks showing:
     * How a data frame structure (like mtcars, iris, diamonds, or penguins) is typically structured/manipulated in R.
     * The exact structural type (interface/type alias) and variable definition in TypeScript representing the same data.
     * The comparison between a dplyr expression (e.g. filter, mutate, select, arrange, summarise) and the native TypeScript equivalent (e.g. .filter(), .map(), .reduce(), .sort()).
3. "followup":
   - **Try it**: A hands-on coding prompt directing Kyle to write structural types, schemas, or array pipeline functions from scratch on nixMitters in `typescript_playground` without copy-pasting, focusing on functional data manipulation (filtering, mapping, reducing) to build muscle memory.
   - **Connection to geminiOS**: A brief description of how this concept applies under the hood to geminiOS configuration or tools.
   - **Playground URL**: https://www.typescriptlang.org/play
