import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class ApiSetupStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { aiInteractionFunction, tutoringSessionsTable } = props;

    // Set up API Gateway
    const api = new apigateway.RestApi(this, "AvanAiTutoringApi", {
      restApiName: "AI Tutoring Service",
      description: "This service handles file uploads and AI interactions.",
    });

    // /ai endpoint for AI interaction
    const aiResponseResource = api.root.addResource("airesponse");
    aiResponseResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(aiInteractionFunction)
    );

    // /sessions endpoint for creating a new tutoring session
    const sessionsResource = api.root.addResource("sessions");
    const createSessionLambda = this.createSessionLambda(tutoringSessionsTable); // Create session lambda function
    sessionsResource.addMethod(
      "POST", // The POST method to create a new session
      new apigateway.LambdaIntegration(createSessionLambda) // Lambda integration for session creation
    );
  }

  // Create a Lambda function to handle session creation
  createSessionLambda(tutoringSessionsTable) {
    const createSessionLambda = new lambda.Function(
      this,
      "CreateSessionFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda/createSession"),
        handler: "index.handler",
        environment: {
          TUTORING_SESSIONS_TABLE: tutoringSessionsTable.tableName,
        },
      }
    );

    // Grant read/write permissions on the DynamoDB table to the Lambda function
    tutoringSessionsTable.grantReadWriteData(createSessionLambda);

    return createSessionLambda;
  }
}
