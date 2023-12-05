# iac-pulumi
AWS Infrastructure as Code (IaC) with Pulumi
This Pulumi code creates a VPC with multiple public and private subnets across multiple availability zones. It also provisions internet gateways and route tables to enable the subnets to communicate with each other and the internet.

Prerequisites
Install Pulumi: Follow the official installation instructions to set up Pulumi for your preferred programming language.
AWS Credentials: Ensure you have valid AWS credentials configured for the account where you plan to deploy the infrastructure.
Usage
Clone the Repository: Clone this repository and navigate to the root directory.
Initialize Pulumi: Run pulumi new <language> to initialize the Pulumi project in your chosen language (e.g., TypeScript, Python, etc.).
Preview Changes: Execute pulumi preview to see the proposed infrastructure changes.
Apply Changes: Run pulumi up to create the infrastructure based on the Pulumi code.
Clean up
To delete the infrastructure provisioned by this code:

Navigate to the root directory of your Pulumi project.
Run pulumi destroy to remove the created resources.

Certificate Import

Command to import the Certificate aws acm import-certificate --certificate file://certificate.crt --certificate-chain file://CertificateChain.pem --private-key file://Private.key
