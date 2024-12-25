// Import necessary libraries
import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

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
      console.log("[ERROR] sessionId is missing in the request body.");
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "sessionId is required." }),
      };
    }

    console.log(`[INFO] Received sessionId: ${sessionId}`);
    console.log(`[INFO] Processed Text: ${processedText}`);

    // Retrieve OpenAI API key from Secrets Manager
    const secretsManagerClient = new SecretsManagerClient({
      region: "us-west-2",
    });
    const secretValueCommand = new GetSecretValueCommand({
      SecretId: "OpenAI",
    });
    const secretResponse = await secretsManagerClient.send(secretValueCommand);
    const openaiApiKey = JSON.parse(secretResponse.SecretString).OPENAI_API_KEY;
    console.log("[INFO] Successfully retrieved OpenAI API key.");

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Fetch session history from DynamoDB
    const dynamoDbClient = new DynamoDBClient({ region: "us-west-2" });
    const scanCommand = new ScanCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE, // Replace with your DynamoDB table name
      FilterExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": { S: sessionId },
      },
    });

    console.log("[INFO] Fetching session data from DynamoDB...");
    const sessionResponse = await dynamoDbClient.send(scanCommand);
    const sessionItem = sessionResponse.Items?.[0]; // Assuming the sessionId is unique

    if (!sessionItem) {
      console.log("[ERROR] Session not found in DynamoDB.");
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Session not found." }),
      };
    }

    console.log(
      `[INFO] Session Item from DynamoDB: ${JSON.stringify(
        sessionItem,
        null,
        2
      )}`
    );

    // Extract session history and studentId from the session data
    const studentId = sessionItem.studentId?.S;
    const sessionHistoryString = sessionItem.history?.S || "[]"; // Ensure history is an empty array if not found

    // Parse the session history (which is stored as a string)
    const sessionHistoryList = JSON.parse(sessionHistoryString);

    console.log(
      `[INFO] Current Session Data: ${JSON.stringify(
        sessionHistoryList,
        null,
        2
      )}`
    );

    // Add the new user prompt to the history
    const timestamp = new Date().toISOString();
    const updatedHistory = [
      ...sessionHistoryList,
      { message: processedText, sender: "user", timestamp },
    ];

    console.log(
      `[INFO] Updated History Before AI Response: ${JSON.stringify(
        updatedHistory,
        null,
        2
      )}`
    );

    // Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful tutor assistant." },
        ...updatedHistory.map(({ message, sender }) => ({
          role: sender === "user" ? "user" : "assistant",
          content: message,
        })),
      ],
    });

    const aiGuidance = completion.choices[0].message.content;
    console.log(`[INFO] AI Response: ${aiGuidance}`);

    // Add the AI response to the history
    const newHistory = [
      ...updatedHistory,
      {
        message: aiGuidance,
        sender: "ai",
        timestamp: new Date().toISOString(),
      },
    ];

    console.log(
      `[INFO] Updated History After AI Response: ${JSON.stringify(
        newHistory,
        null,
        2
      )}`
    );

    // Update session history in DynamoDB
    const updateSessionCommand = new UpdateItemCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE, // Replace with your DynamoDB table name
      Key: {
        sessionId: { S: sessionId }, // Partition key
        studentId: { S: studentId }, // Sort key (ensure you have this value)
      },
      UpdateExpression: "SET history = :history",
      ExpressionAttributeValues: {
        ":history": { S: JSON.stringify(newHistory) },
      },
    });

    console.log("[INFO] Updating session history in DynamoDB...");
    await dynamoDbClient.send(updateSessionCommand);
    console.log("[INFO] Session history updated successfully.");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        message: "AI guidance generated successfully!",
        aiGuidance,
        updatedHistory: newHistory,
      }),
    };
  } catch (error) {
    console.error("[ERROR] AI interaction failed:", error);
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
