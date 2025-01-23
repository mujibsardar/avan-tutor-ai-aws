# Avan Tutor AI - AI-Powered Learning Platform

## Overview

This project demonstrates my ability to build a serverless AI-powered learning platform on AWS using infrastructure as code principles. Avan Tutor AI provides personalized tutoring and educational assistance using Large Language Models (LLMs). The backend consists of a set of AWS Lambda functions orchestrated using AWS CDK (Cloud Development Kit), enabling seamless integration with DynamoDB for session management and user data.

## Key Technologies and Skills Demonstrated:

*   **Serverless Architecture:** Designed and implemented a fully serverless backend using AWS Lambda functions, demonstrating expertise in event-driven architectures and scalability.
*   **AWS CDK (Cloud Development Kit):** Orchestrated the entire infrastructure using AWS CDK, showcasing proficiency in infrastructure as code (IaC) and automated deployments. Key CDK skills include:
    *   Defining and deploying Lambda functions.
    *   Configuring API Gateway endpoints.
    *   Provisioning DynamoDB tables.
    *   Setting up IAM roles and permissions.
    *   Integrating with Cognito for user authentication.
*   **AWS Lambda:** Implemented several Lambda functions to handle different aspects of the application:
    *   `aiInteractionFunction`: Manages the core AI interaction logic, integrating with LLMs (such as Gemini and OpenAI) and Google Search.
    *   `createSessionLambda`: Creates new tutoring sessions in DynamoDB.
    *   `fetchSessionsLambda`: Retrieves tutoring sessions based on student ID.
    *   `deleteSessionLambda`: Deletes tutoring sessions.
    *   `createStudentLambda`: Creates student entries in DynamoDB upon user sign-up via Cognito.
*   **DynamoDB:** Utilized DynamoDB to store tutoring sessions, student data, and session history, demonstrating experience with NoSQL databases and schema design.
*   **Cognito:** Integrated with AWS Cognito to handle user authentication and authorization, securing the application and managing user identities.
*   **LLM Integration:** Integrated with multiple LLMs (Gemini and OpenAI) via API calls to provide a richer tutoring experience. This includes prompt engineering, response processing, and error handling.
*   **API Gateway:** Configured API Gateway endpoints to expose the Lambda functions as RESTful APIs, enabling the frontend to interact with the backend.
*   **JavaScript/Node.js:** Proficient in JavaScript and Node.js, utilizing these languages for Lambda function development and API integration.
*   **AWS SDK for JavaScript:** Used the AWS SDK for JavaScript (`@aws-sdk/*` packages) to interact with AWS services, including DynamoDB and Secrets Manager.

## Key Highlights:

*   **Multi-LLM Integration:** Implemented a sophisticated system to integrate with both Gemini and OpenAI, allowing the application to leverage the strengths of each model.
*   **Session Management:** Designed and implemented a robust session management system using DynamoDB, allowing for persistent storage of session history and student data.
*   **Automated Deployment:** Created a fully automated deployment pipeline using AWS CDK, enabling rapid and reliable deployments of the application.
*   **Secure Architecture:** Implemented security best practices, including IAM roles with least privilege and integration with Cognito for user authentication.

## Author:

*   **Avan Sardar** - A cloud-focused full-stack developer with a developing passion for AI, serverless technologies and bringing great ideas to life with technology and people. 

## Contact:

Feel free to contact me at [**avansardar@outlook.com**] for any questions or discussions related to this project.
