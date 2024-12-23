import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";

export class CognitoStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Reference the existing Students table
    const studentsTable = dynamodb.Table.fromTableName(
      this,
      "ExistingStudentsTable",
      process.env.STUDENTS_TABLE || "Students"
    );

    // Create Lambda function
    const createStudentLambda = new lambda.Function(
      this,
      "CreateStudentFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("lambda/createStudent"),
        handler: "index.handler",
        environment: {
          STUDENTS_TABLE: studentsTable.tableName,
        },
      }
    );

    // Grant the Lambda permission to write to the existing table
    studentsTable.grantWriteData(createStudentLambda);

    // Reference the existing User Pool
    const existingUserPool = cognito.UserPool.fromUserPoolId(
      this,
      "ExistingUserPool",
      "us-west-2_0ANjQ10gp"
    );

    // Add PostConfirmation trigger to the existing User Pool using a Custom Resource
    new cr.AwsCustomResource(this, "UpdateUserPool", {
      onCreate: {
        service: "CognitoIdentityServiceProvider",
        action: "updateUserPool",
        parameters: {
          UserPoolId: existingUserPool.userPoolId,
          LambdaConfig: {
            PostConfirmation: createStudentLambda.functionArn,
          },
          AutoVerifiedAttributes: ["email"], // Explicitly set this to match the requirement
          AttributesRequireVerificationBeforeUpdate: ["email"], // Must align with AutoVerifiedAttributes
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          existingUserPool.userPoolId
        ),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [existingUserPool.userPoolArn],
      }),
    });

    // Grant Cognito permission to invoke the Lambda
    createStudentLambda.addPermission("AllowCognitoInvoke", {
      principal: new iam.ServicePrincipal("cognito-idp.amazonaws.com"),
      sourceArn: existingUserPool.userPoolArn,
    });
  }
}
