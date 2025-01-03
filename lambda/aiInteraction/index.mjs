import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { generateGeminiResponse } from "./helpers/geminiHelper.js";
import { googleSearch } from "./helpers/googleSearchHelper.js";
import { generateOpenAiResponse } from "./helpers/openaiHelper.js";

export const handler = async (event) => {
  try {
    const method = event.httpMethod || event.requestContext?.http?.method;

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
      console.log("Invalid method:", method);
      return {
        statusCode: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Method Not Allowed." }),
      };
    }

    // Parse request body
    const { input: processedText, sessionId } = JSON.parse(event.body);

    if (!sessionId) {
      console.log("Session ID missing.");
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "sessionId is required." }),
      };
    }

    // Initialize results object to store all ai responses and search results
    const aiResults = {
      openai: {
        aiGuidance: null,
        score: null,
        feedback: null,
        confidence: null,
        concerns: null,
        promptSummary: null,
      },
      gemini: {
        aiGuidance: null,
      },
      search: {
        results: [],
      },
    };

    // Fetch session history from DynamoDB (same as before)
    const dynamoDbClient = new DynamoDBClient({ region: "us-west-2" });
    const scanCommand = new ScanCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE,
      FilterExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": { S: sessionId },
      },
    });

    const sessionResponse = await dynamoDbClient.send(scanCommand);
    const sessionItem = sessionResponse.Items?.[0];

    if (!sessionItem) {
      console.log("Session not found.");
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Session not found." }),
      };
    }

    const studentId = sessionItem.studentId?.S;
    const sessionHistoryString = sessionItem.history?.S || "[]";
    const sessionHistoryList = JSON.parse(sessionHistoryString);
    const timestamp = new Date().toISOString();

    // --- Gemini Response ---
    aiResults.gemini.aiGuidance = await generateGeminiResponse(
      sessionHistoryList,
      processedText
    );

    // --- OpenAI Response ---
    const openAiResponse = await generateOpenAiResponse(
      sessionHistoryList,
      processedText
    );
    aiResults.openai = openAiResponse;

    // --- Google Search Results ---
    aiResults.search.results = await googleSearch(processedText);

    // Update history
    const newHistory = [
      ...sessionHistoryList,
      {
        message: processedText,
        sender: "user",
        timestamp,
        score: aiResults.openai.score,
        feedback: aiResults.openai.feedback,
        promptSummary: aiResults.openai.promptSummary,
      },
      {
        message: aiResults.openai.aiGuidance,
        sender: "openai",
        confidence: aiResults.openai.confidence,
        concerns: aiResults.openai.concerns,
        timestamp: new Date().toISOString(),
      },
      {
        message: aiResults.gemini.aiGuidance,
        sender: "gemini",
        timestamp: new Date().toISOString(),
      },
    ];

    // Update session history in DynamoDB
    const updateSessionCommand = new UpdateItemCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE,
      Key: {
        sessionId: { S: sessionId },
        studentId: { S: studentId },
      },
      UpdateExpression: "SET history = :history",
      ExpressionAttributeValues: {
        ":history": { S: JSON.stringify(newHistory) },
      },
    });

    await dynamoDbClient.send(updateSessionCommand);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        message: "AI guidance and search results generated successfully!",
        aiResults,
        updatedHistory: newHistory,
      }),
    };
  } catch (error) {
    console.error("[ERROR] AI interaction failed:", error);
    console.error("Error Details:", JSON.stringify(error, null, 2));
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        message: "AI interaction failed.",
        error: error.message || "Unknown error",
        stack: error.stack,
      }),
    };
  }
};
