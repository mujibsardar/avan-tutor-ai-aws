import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB clients
const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("PostConfirmation event received:", JSON.stringify(event));

  try {
    // Extract user attributes from the event
    const { sub, email } = event.request?.userAttributes || {};
    console.log("Extracted user attributes:", { sub, email });

    // Validate required attributes
    if (!sub || !email) {
      console.error("Missing 'sub' or 'email'.");
      throw new Error(
        "Missing required user attributes: 'sub' and/or 'email'."
      );
    }

    // Define the student object to save in DynamoDB
    const newStudent = {
      studentId: sub, // Unique Cognito identifier
      email,
      createdAt: new Date().toISOString(),
    };
    console.log("New student object:", newStudent);

    // Prepare and execute DynamoDB PutCommand
    const command = new PutCommand({
      TableName: process.env.STUDENTS_TABLE,
      Item: newStudent,
    });
    console.log("DynamoDB command prepared:", JSON.stringify(command));

    const result = await dynamoDB.send(command);
    console.log("DynamoDB result:", result);
  } catch (error) {
    console.error("Error creating student:", error);
    // Cognito flow will still proceed; error handling should log details
  }

  // Return the event object back to Cognito
  console.log("Returning event back to Cognito:", JSON.stringify(event));
  return event;
};
