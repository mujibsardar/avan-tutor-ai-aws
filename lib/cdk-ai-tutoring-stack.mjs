import * as cdk from "aws-cdk-lib";
import { ApiSetupStack } from "./api-setup-stack.mjs";
import { AiInteractionStack } from "./ai-interaction-stack.mjs";
import { CognitoStack } from "./cognito-stack.mjs"; // Import the new CognitoStack
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class CdkAiTutoringStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create the AI Interaction stack
    const aiInteractionStack = new AiInteractionStack(
      this,
      "AiInteractionStack"
    );

    // Create the DynamoDB table for tutoring sessions
    const tableName = process.env.TUTORING_SESSIONS_TABLE || "TutoringSessions"; // Default name if env variable is not set
    const tutoringSessionsTable = new dynamodb.Table(this, "TutoringSessions", {
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING }, // sessionId as the primary key
      sortKey: { name: "studentId", type: dynamodb.AttributeType.STRING }, // studentId as the sort key (optional, useful for querying)
      tableName: tableName, // Use the table name from the environment variable
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Change to RETAIN for production
    });

    // Create the API Setup stack
    const apiSetupStack = new ApiSetupStack(this, "ApiSetupStack", {
      aiInteractionFunction: aiInteractionStack.aiInteractionFunction,
      tutoringSessionsTable: tutoringSessionsTable, // Pass the DynamoDB table to the API setup
    });

    // Create the Cognito Stack for user pool and triggers
    const cognitoStack = new CognitoStack(this, "CognitoStack", {
      studentsTable: tutoringSessionsTable, // Optionally pass a reference to an existing table
    });
  }
}
