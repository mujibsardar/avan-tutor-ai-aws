import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// Initialize the DynamoDB client and document client
const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token",
};

// Helper function to get HTTP method
const getMethod = (event) => {
  return event.httpMethod || event.requestContext?.http?.method;
};

export const handler = async (event) => {
  const method = getMethod(event);

  // Handle preflight request (OPTIONS)
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: null,
    };
  }

  // Extract query parameters
  const studentId = event.queryStringParameters?.studentId;

  if (!studentId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Student ID is required." }),
    };
  }

  try {
    // Scan the DynamoDB table for sessions based on studentId
    const command = new ScanCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE, // Ensure correct table name
      FilterExpression: "studentId = :studentId", // Filter by studentId
      ExpressionAttributeValues: {
        ":studentId": studentId, // Use the studentId from query parameters
      },
    });

    const result = await dynamoDB.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ sessions: result.Items }),
    };
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Error fetching sessions." }),
    };
  }
};
