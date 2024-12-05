import { Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";

export class DocumentProcessingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { uploadBucketName } = props; // Get the bucket name passed as parameter

    // Define the IAM role for the Lambda function
    const documentProcessingRole = new iam.Role(
      this,
      "DocumentProcessingRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }
    );

    // Attach a managed policy for S3 read access to this role
    documentProcessingRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`arn:aws:s3:::${uploadBucketName}/uploads/*`], // Adjust the bucket path as needed
      })
    );

    // Define the Lambda function for processing documents
    this.documentProcessingFunction = new lambda.Function(
      this,
      "DocumentProcessingFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda/documentProcessing"),
        handler: "index.handler",
        environment: {
          UPLOAD_BUCKET_NAME: uploadBucketName, // Use the passed bucket name
        },
        role: documentProcessingRole,
      }
    );
  }
}
