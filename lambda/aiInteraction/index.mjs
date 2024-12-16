// Import the OpenAI library
import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

// Initialize OpenAI client without API key for now
let openai;

export const handler = async (event) => {
  try {
    // Determine the HTTP method (REST or HTTP API)
    const method =
      event.httpMethod || // REST API (v1)
      event.requestContext?.http?.method; // HTTP API (v2)
    if (method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: null,
      };
    }

    if (method !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Method Not Allowed." }),
      };
    }
    // Get the processed text from the event
    const processedText = JSON.parse(event.body).input;

    // Retrieve OpenAI API key from Secrets Manager
    const secretsManagerClient = new SecretsManagerClient({
      region: "us-west-2",
    });

    const secretValueCommand = new GetSecretValueCommand({
      SecretId: "OpenAI",
    });
    const secretResponse = await secretsManagerClient.send(secretValueCommand);
    const openaiApiKey = JSON.parse(secretResponse.SecretString).OPENAI_API_KEY;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Use the OpenAI model to generate tutoring guidance
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful tutor assistant." },
        { role: "user", content: processedText },
      ],
    });

    const aiGuidance = completion.choices[0].message.content;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow all origins
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token", // Allowed headers
      },
      body: JSON.stringify({
        message: "AI guidance generated successfully!",
        aiGuidance,
      }),
    };
  } catch (error) {
    console.error("AI interaction failed:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*", // Include CORS headers in error responses too
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token", // Allowed headers
      },
      body: JSON.stringify({
        message: "AI interaction failed.",
        error: error.message || "Unknown error", // Add a human-readable error message
        stack: error.stack, // Optional: Include stack trace for debugging
      }),
    };
  }
};
