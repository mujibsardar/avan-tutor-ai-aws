import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

// Initialize the DynamoDB client and document client
const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

// CORS headers (to be reused)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allow all origins, or specify specific domains for tighter control
  "Access-Control-Allow-Methods": "DELETE, OPTIONS", // Allow methods
  "Access-Control-Allow-Headers":
    "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token", // Allowed headers
};

// Helper function to handle HTTP method detection (REST or HTTP API)
const getMethod = (event) => {
  return (
    event.httpMethod || // REST API (v1)
    event.requestContext?.http?.method // HTTP API (v2)
  );
};

export const handler = async (event) => {
  const method = getMethod(event);

  // Handle preflight request (OPTIONS)
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: null, // No body needed for preflight
    };
  }

  // Extract session ID from path parameters
  const sessionId = event.pathParameters?.["session-id"];
  const userId = event.pathParameters?.["user-id"];

  if (!sessionId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Session ID is required." }),
    };
  }

  try {
    // Create a DeleteCommand
    const command = new DeleteCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE, // Table name from environment variable
      Key: { sessionId, studentId: userId }, // Primary key (partition key and sort key)
    });

    // Delete the session from DynamoDB using the document client
    await dynamoDB.send(command);

    // Return success response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Session ${sessionId} deleted successfully.`,
      }),
    };
  } catch (error) {
    console.error("Error deleting session:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Error deleting session." }),
    };
  }
};
