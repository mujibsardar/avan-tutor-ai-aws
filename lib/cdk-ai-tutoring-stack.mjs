import * as cdk from "aws-cdk-lib";
import { ApiSetupStack } from "./api-setup.mjs";
import { AiInteractionStack } from "./ai-interaction.mjs";

export class CdkAiTutoringStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create the AI interaction stack
    const aiInteractionStack = new AiInteractionStack(
      this,
      "AiInteractionStack"
    );

    // Create the API setup stack, passing in the necessary Lambda functions
    const apiSetupStack = new ApiSetupStack(this, "ApiSetupStack", {
      aiInteractionFunction: aiInteractionStack.aiInteractionFunction,
    });
  }
}
