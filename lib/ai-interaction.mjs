import { Stack, Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";

export class AiInteractionStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

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
    this.aiInteractionFunction = new lambda.Function(
      this,
      "AiInteractionFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda/aiInteraction"),
        handler: "index.handler",
        role: aiInteractionRole,
        memorySize: 256,  // Increase memory allocation
        timeout: Duration.seconds(10),  // Use Duration directly
      }
    );
  }
}
