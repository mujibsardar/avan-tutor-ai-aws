import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class ApiSetupStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { aiInteractionFunction } = props;

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
  }
}
