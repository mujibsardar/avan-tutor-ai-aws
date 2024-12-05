import { Stack } from "aws-cdk-lib";
import apigateway from "aws-cdk-lib/aws-apigateway";

export class ApiSetupStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const {
      fileUploadFunction,
      documentProcessingFunction,
      aiInteractionFunction,
    } = props;

    // Set up API Gateway
    const api = new apigateway.RestApi(this, "AiTutoringApi", {
      restApiName: "AI Tutoring Service",
      description:
        "This service handles document uploads, processing, and AI interactions.",
    });

    // /upload endpoint for file uploads
    const uploadResource = api.root.addResource("upload");
    uploadResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(fileUploadFunction)
    );

    // /process endpoint for document processing
    const processResource = api.root.addResource("process");
    processResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(documentProcessingFunction)
    );

    // /ai endpoint for AI interaction
    const aiResource = api.root.addResource("ai");
    aiResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(aiInteractionFunction)
    );
  }
}
