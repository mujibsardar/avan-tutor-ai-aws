import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class ApiSetupStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { fileHandlingFunction, aiInteractionFunction } = props;

    // Set up API Gateway
    const api = new apigateway.RestApi(this, "AvanAiTutoringApi", {
      restApiName: "AI Tutoring Service",
      description: "This service handles file uploads and AI interactions.",
    });

    // /upload endpoint for file handling
    const uploadResource = api.root.addResource("upload");
    uploadResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(fileHandlingFunction)
    );

    // /ai endpoint for AI interaction
    const aiResource = api.root.addResource("ai");
    aiResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(aiInteractionFunction)
    );
  }
}
