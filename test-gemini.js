const fs = require('fs');

const apiKey = process.env.VITE_GEMINI_API_KEYS ? process.env.VITE_GEMINI_API_KEYS.split(',')[0] : 'TEST';
// I will just print the body to see what it looks like.
const body = {
  contents: [{ parts: [{ text: "Open the clock widget" }] }],
  tools: [
    {
      functionDeclarations: [
        {
          name: "control_widget",
          description: "Opens, closes, or toggles a desktop widget.",
          parameters: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING" },
              widget_id: { type: "STRING" }
            },
            required: ["action", "widget_id"]
          }
        }
      ]
    }
  ]
};

console.log(JSON.stringify(body, null, 2));
