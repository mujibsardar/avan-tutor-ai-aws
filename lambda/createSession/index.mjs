import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// Initialize the DynamoDB client and document client
const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

// CORS headers (to be reused)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allow all origins, or specify specific domains for tighter control
  "Access-Control-Allow-Methods": "POST, OPTIONS", // Allow methods
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

  // Parse the body for studentId and sessionName
  let studentId, sessionName;
  try {
    const body = JSON.parse(event.body);
    studentId = body.studentId;
    sessionName = body.sessionName;
  } catch (error) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Invalid request body." }),
    };
  }

  // Validate input
  if (!studentId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Student ID is required." }),
    };
  }

  if (!sessionName) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Session name is required." }),
    };
  }

  // Generate a unique sessionId (e.g., timestamp-based)
  const sessionId = `session-${Date.now()}`;

  // Define the new session object
  const newSession = {
    sessionId,
    studentId,
    sessionName,
    uploadedFiles: [],
    history: [],
    createdAt: new Date().toISOString(),
  };

  try {
    // Create a new PutCommand
    const command = new PutCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE, // Table name from environment variable
      Item: newSession,
    });

    // Store the new session in DynamoDB using the document client
    await dynamoDB.send(command);

    // Return success response
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(newSession),
    };
  } catch (error) {
    console.error("Error creating session:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Error creating session." }),
    };
  }
};
