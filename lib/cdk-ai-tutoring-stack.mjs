import * as cdk from "aws-cdk-lib";
import { FileHandlingStack } from "./file-handling.mjs";
import { ApiSetupStack } from "./api-setup.mjs";
import { StorageStack } from "./storage.mjs";
import { AiInteractionStack } from "./ai-interaction.mjs";

export class CdkAiTutoringStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create the storage stack
    const storageStack = new StorageStack(this, "StorageStack");

    // Fetch the bucket name from the StorageStack
    const uploadBucketName = storageStack.uploadBucket.bucketName;

    // Create the new file handling stack
    const fileHandlingStack = new FileHandlingStack(this, "FileHandlingStack", {
      uploadBucketName,
    });

    // Create the AI interaction stack
    const aiInteractionStack = new AiInteractionStack(
      this,
      "AiInteractionStack"
    );

    // Create the API setup stack, passing in the necessary Lambda functions
    const apiSetupStack = new ApiSetupStack(this, "ApiSetupStack", {
      fileHandlingFunction: fileHandlingStack.fileHandlingFunction,
      aiInteractionFunction: aiInteractionStack.aiInteractionFunction,
    });
  }
}
