// index.mjs
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
    console.log("Lambda handler started.");
    console.log("Event:", JSON.stringify(event));

    const method = event.httpMethod || event.requestContext?.http?.method;

    if (method === "OPTIONS") {
      console.log("Handling OPTIONS request.");
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
    console.log("Parsed body:", { processedText, sessionId });

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
      prompt: {
        score: null,
        feedback: null,
        promptSummary: null,
      },
      openai: {
        aiGuidance: null,
        confidence: null,
        concerns: null,
      },
      gemini: {
        aiGuidance: null,
        confidence: null,
        concerns: null,
      },
      search: {
        results: [],
      },
    };
    console.log("Initialized aiResults:", aiResults);

    // Fetch session history from DynamoDB (same as before)
    const dynamoDbClient = new DynamoDBClient({ region: "us-west-2" });
    const scanCommand = new ScanCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE,
      FilterExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": { S: sessionId },
      },
    });

    console.log("Scanning DynamoDB for session with ID:", sessionId);
    const sessionResponse = await dynamoDbClient.send(scanCommand);
    const sessionItem = sessionResponse.Items?.[0];
    console.log("DynamoDB session item:", sessionItem);

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
    console.log("Session history:", sessionHistoryList);
    const timestamp = new Date().toISOString();

    // --- Gemini Response ---
    console.log("Generating Gemini response.");
    const geminiResponse = await generateGeminiResponse(
      sessionHistoryList,
      processedText
    );
    aiResults.gemini.aiGuidance = geminiResponse.aiGuidance;
    aiResults.gemini.confidence = geminiResponse.confidence;
    aiResults.gemini.concerns = geminiResponse.concerns;
    console.log("Gemini response:", aiResults.gemini);

    // --- OpenAI Response ---
    console.log("Generating OpenAI response.");
    const openAiResponse = await generateOpenAiResponse(
      sessionHistoryList,
      processedText
    );
    aiResults.openai.aiGuidance = openAiResponse.aiGuidance;
    aiResults.openai.confidence = openAiResponse.confidence;
    aiResults.openai.concerns = openAiResponse.concerns;
    aiResults.prompt.score = openAiResponse.score;
    aiResults.prompt.feedback = openAiResponse.feedback;
    aiResults.prompt.promptSummary = openAiResponse.promptSummary;
    console.log("OpenAI response:", aiResults.openai);

    // --- Google Search Results ---
    console.log("Fetching Google Search results.");
    const googleSearchResults = await googleSearch(processedText);
    console.log("Raw Google Search results:", googleSearchResults);

    // Process and format search results into a string
    const formattedSearchResults = googleSearchResults
      .slice(0, 3)
      .map((result, index) => {
        const sourceMatch = result.link.match(/\/\/(www\.)?([\w\-]+)\./);
        const source = sourceMatch ? sourceMatch[2] : "Unknown source";

        return `Result ${index + 1}:
    Title: ${result.title || "No title available"}
    Link: ${result.link}
    Description: ${result.snippet || "No description available"}
    Source: ${source}`;
      })
      .join("\n\n");

    aiResults.search.results = formattedSearchResults; // Store formatted results for response
    console.log("Formatted Google Search results:", formattedSearchResults);

    // Update history
    const newHistory = [
      ...sessionHistoryList,
      {
        message: processedText,
        sender: "user",
        timestamp,
        score: aiResults.prompt.score,
        feedback: aiResults.prompt.feedback,
        promptSummary: aiResults.prompt.promptSummary,
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
        confidence: aiResults.gemini.confidence,
        concerns: aiResults.gemini.concerns,
        timestamp: new Date().toISOString(),
      },
      {
        message: aiResults.search.results,
        sender: "googleSearch",
        timestamp: new Date().toISOString(),
      },
    ];
    console.log("New history:", newHistory);

    const now = new Date().toISOString();

    // Update session history in DynamoDB
    const updateSessionCommand = new UpdateItemCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE,
      Key: {
        sessionId: { S: sessionId },
        studentId: { S: studentId },
      },
      UpdateExpression: "SET history = :history, modifiedAt = :modifiedAt",
      ExpressionAttributeValues: {
        ":history": { S: JSON.stringify(newHistory) },
        ":modifiedAt": { S: now }, // Add the modifiedAt field
      },
    });

    console.log("Updating DynamoDB session history.");
    await dynamoDbClient.send(updateSessionCommand);
    console.log("DynamoDB session history updated.");

    console.log("Lambda execution successful.");
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
