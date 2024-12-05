import { Stack, CfnParameter } from "aws-cdk-lib";
import { AiInteractionStack } from "./ai-interaction.mjs";
import { FileUploadStack } from "./file-upload.mjs";
import { DocumentProcessingStack } from "./document-processing.mjs";
import { ApiSetupStack } from "./api-setup.mjs";
import { StorageStack } from "./storage.mjs";

export class CdkAiTutoringStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create the storage stack first
    const storageStack = new StorageStack(this, "StorageStack");

    // Fetch the bucket name from the StorageStack
    const uploadBucketName = storageStack.uploadBucket.bucketName;

    // Create the document processing stack, passing in the bucket name as a parameter
    const documentProcessingStack = new DocumentProcessingStack(
      this,
      "DocumentProcessingStack",
      { uploadBucketName }
    );

    // Create the file upload stack, passing in the document processing function and bucket name
    const fileUploadStack = new FileUploadStack(this, "FileUploadStack", {
      uploadBucketName,
      documentProcessingFunction:
        documentProcessingStack.documentProcessingFunction,
    });

    // Create the AI interaction stack (if needed)
    const aiInteractionStack = new AiInteractionStack(
      this,
      "AiInteractionStack"
    );

    // Create the API setup stack, passing in the necessary Lambda functions
    const apiSetupStack = new ApiSetupStack(this, "ApiSetupStack", {
      fileUploadFunction: fileUploadStack.fileUploadFunction,
      documentProcessingFunction:
        documentProcessingStack.documentProcessingFunction,
      aiInteractionFunction: aiInteractionStack.aiInteractionFunction,
    });
  }
}
