import { Stack, Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class AiInteractionStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Reference the existing Tutoring Sessions table
    const tutoringSessionsTable = dynamodb.Table.fromTableName(
      this,
      "ExistingTutoringSessionsTable",
      process.env.TUTORING_SESSIONS_TABLE || "TutoringSessions"
    );

    // Define the IAM role for the Lambda function
    const aiInteractionRole = new iam.Role(this, "AiInteractionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // Add Secrets Manager permission to retrieve the OpenAI API key
    aiInteractionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          "arn:aws:secretsmanager:us-west-2:135808947685:secret:OpenAI-mjyYXu",
        ],
      })
    );

    // Define the Lambda function for AI interaction
    const aiInteractionFunction = new lambda.Function(
      this,
      "AiInteractionFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda/aiInteraction"),
        handler: "index.handler",
        role: aiInteractionRole,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: {
          TUTORING_SESSIONS_TABLE: tutoringSessionsTable.tableName,
        },
      }
    );

    // Grant the Lambda function permission to access the Tutoring Sessions table
    tutoringSessionsTable.grantReadWriteData(aiInteractionFunction);

    // Export the Lambda function for use in other stacks
    this.aiInteractionFunction = aiInteractionFunction;
  }
}
