"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const vpcCIDRBlock = new pulumi.Config("my_vpc").require("cidrBlock");
const publicRouteTableCIDRBlock = new pulumi.Config("my_publicRouteTable").require("cidrBlock");
const Ami_ID = new pulumi.Config("AMIID").require("AMIID");
const DomainName = new pulumi.Config("DomainName").require("DomainName");
require('dotenv').config();

// Access environment variables

// Create a VPC
const main = new aws.ec2.Vpc("Pulumi_01", {
    cidrBlock: vpcCIDRBlock,
    instanceTenancy: "default",
    tags: {
        Name: "Pulumi_01",
    },
});


// Function for AWS availability zones
const getAvailableAvailabilityZones = async () => {
    const zones = await aws.getAvailabilityZones({ state: "available" });
    const i = Math.min(zones.names.length, 3);
    console.log('zones now: ', i);
    return zones.names.slice(0, i);
};

const publicSubnets = [];
const privateSubnets = [];

// availability zones
const createSubnets = async () => {
    const availabilityZones = await getAvailableAvailabilityZones();
    for (let i = 0; i < availabilityZones.length; i++) {

        // Create public subnet
        const publicSubnet = new aws.ec2.Subnet(`subnet_public_name${i + 1}`, {
            vpcId: main.id,
            availabilityZone: availabilityZones[i],
            cidrBlock: `10.0.${i + 1}.0/24`,
            mapPublicIpOnLaunch: true,
            tags: {
                Name: `subnet_public_name${i + 1}`,
            },
        });
        publicSubnets.push(publicSubnet);

        // Create private subnet
        const privateSubnet = new aws.ec2.Subnet(`subnet_private_name${i + 1}`, {
            vpcId: main.id,
            availabilityZone: availabilityZones[i],
            cidrBlock: `10.0.${availabilityZones.length + i + 1}.0/24`,
            tags: {
                Name: `subnet_private_name${i + 1}`,
            },
        });
        privateSubnets.push(privateSubnet);
    }

// Create route tables
const publicRouteTable = new aws.ec2.RouteTable("public_route_table", {
    vpcId: main.id,
    tags: {
        Name: "public_route_table",
    },
});

const privateRouteTable = new aws.ec2.RouteTable("private_route_table", {
    vpcId: main.id,
    tags: {
        Name: "private_route_table",
    },
});

const publicRouteTableAssociations = [];
const privateRouteTableAssociations = [];

// Associate public subnets with the public route table
for (let i = 0; i < availabilityZones.length; i++) {
    let x = i+1;
    const association = new aws.ec2.RouteTableAssociation("public_subnetconnect"+x, {
        subnetId: publicSubnets[i].id,
        routeTableId: publicRouteTable.id,
    });

    publicRouteTableAssociations.push(association);
}

// Associate private subnets with the private route table
for (let i = 0; i < availabilityZones.length; i++) {
    let x = i+1;
    const association = new aws.ec2.RouteTableAssociation("private_subnetconnect"+x, {
        subnetId: privateSubnets[i].id,
        routeTableId: privateRouteTable.id,
    });

    privateRouteTableAssociations.push(association);
}

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("internet_gateway", {
    vpcId: main.id,
    tags: {
        Name: "internet_gateway",
    },
});





// Create a public route in the public route table
const publicRoute = new aws.ec2.Route("public_route", {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: publicRouteTableCIDRBlock,
    gatewayId: internetGateway.id,
});




const appSecurityGroup = new aws.ec2.SecurityGroup("appSecurityGroup", {

    vpcId: main.id,

    ingress: [

        {

            fromPort: 22,

            toPort: 22,

            protocol: "tcp",

            cidrBlocks: ["0.0.0.0/0"], // Allow SSH from anywhere

        },

        {

            fromPort: 80,

            toPort: 80,

            protocol: "tcp",

            cidrBlocks: ["0.0.0.0/0"], // Allow HTTP from anywhere

        },

        {

            fromPort: 443,

            toPort: 443,

            protocol: "tcp",

            cidrBlocks: ["0.0.0.0/0"], // Allow HTTPS from anywhere

        },

        // Add ingress rule for your application port here

        {

            fromPort: 3000,

            toPort: 3000,

            protocol: "tcp",

            cidrBlocks: ["0.0.0.0/0"],

        },

    ],
    egress: [
        {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
        }
    ],

    tags: {

        Name: "appSecurityGroup",

    },

});


const dbSecurityGroup = new aws.ec2.SecurityGroup("dbSecurityGroup", {

    vpcId: main.id,

    ingress: [

        {

            fromPort: 3306,

            toPort: 3306,

            protocol: "tcp",

            securityGroups: [appSecurityGroup.id], // Allow SSH from anywhere

        },

    ],
    egress: [
        {
            fromPort: 3306,
            toPort: 3306,
            protocol: "tcp",
            securityGroups: [appSecurityGroup.id],
        }
    ],

    tags: {

        Name: "dbSecurityGroup",

    },

});


const dbSubnetGroup = new aws.rds.SubnetGroup("mydbsubnetgroup", {
    subnetIds: [privateSubnets[0].id, privateSubnets[1].id], // Replace with your subnet IDs
    dbSubnetGroupDescription: "My DB Subnet Group",
    tags: {
        Name: "mydbsubnetgroup",
    },
});

// Create an RDS parameter group
const rdsParameterGroup = new aws.rds.ParameterGroup("myRdsParameterGroup", {
    vpcId: main.id,
    family: "mariadb10.6", // Change this to match your database engine and version
    name: "my-rds-parameter-group",
    parameters: [
        {
            name: "character_set_server",
            value: "utf8",
        },
        {
            name: "collation_server",
            value: "utf8_general_ci",
        },
    ],
    tags: {
        Name: "myRdsParameterGroup",
    },
});

const rdsInstance = new aws.rds.Instance("myrdsinstance", {
    dbName: "csye6225",
    identifier: "csye6225",
    allocatedStorage: 20,             // The storage capacity for the RDS instance
    storageType: "gp2",               // General Purpose (SSD)
    engine: "mariadb",                 // The database engine (e.g., MySQL, PostgreSQL, etc.)
    //engineVersion: "5.7",            // Engine version
    instanceClass: "db.t2.micro",    // RDS instance type
    username: "yuvaraj123",             // Database master username
    password: "Yuvarajmy143",     // Database master password
    skipFinalSnapshot: true,         // Do not create a final DB snapshot when the instance is deleted
    publiclyAccessible: false,       // RDS instance is not publicly accessible
    multiAz: false,                  // Multi-AZ deployment (true for high availability)
    vpcSecurityGroupIds: [dbSecurityGroup.id], // Add security group IDs to control access
    dbSubnetGroupName: dbSubnetGroup.id, // Name of the DB subnet group (create one if it doesn't exist)
    parameterGroupName: rdsParameterGroup.name,
});

const rdsHost = rdsInstance.endpoint.apply(endpoint => {
    return endpoint.split(":")[0];
});





const cloudWatchAgentRole = new aws.iam.Role("cloudWatchAgentRole", {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Principal: {
            Service: "ec2.amazonaws.com"
          },
          Effect: "Allow",
        },
      ],
    }),
  });

  const cloudWatchAgentPolicy = new aws.iam.Policy("cloudWatchAgentPolicy", {
    description: "Policy for CloudWatch Agent",
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: [
            "cloudwatch:PutMetricData",
            "ec2:DescribeVolumes",
            "ec2:DescribeTags",
            "logs:PutLogEvents",
            "logs:DescribeLogStreams",
            "logs:DescribeLogGroups",
            "logs:CreateLogStream",
            "logs:CreateLogGroup",
          ],
          Effect: "Allow",
          Resource: "*",
        },
        {
          Action: ["ssm:GetParameter"],
          Effect: "Allow",
          Resource: "arn:aws:ssm:*:*:parameter/AmazonCloudWatch-*",
        },
      ],
    },
  });

const cloudWatchAgentRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
    "cloudWatchAgentRolePolicyAttachment",
    {
      policyArn: cloudWatchAgentPolicy.arn,
      role: cloudWatchAgentRole.name,
    }
  );

const RoleProfile = new aws.iam.InstanceProfile("RoleProfile", {role: cloudWatchAgentRole.name});

  const ec2Instance = new aws.ec2.Instance("ec2Instance", {

    instanceType: "t2.micro", // Set the desired instance type

    ami: Ami_ID, // Replace with your custom AMI ID

    vpcSecurityGroupIds: [appSecurityGroup.id],

    subnetId: publicSubnets[0].id, // Choose one of your public subnets

    vpcId: main.id,

    keyName: "EC2Instance_keypair",

    iamInstanceProfile:RoleProfile,

    rootBlockDevice: {

        volumeSize: 25,

        volumeType: "gp2",

    },
    userData: pulumi.interpolate`#!/bin/bash
    
    # Create the .env file inside the /opt/example folder
    sudo sh -c 'echo "PORT=3000" >> /opt/csye6225/webapp/.env'
    sudo sh -c 'echo "DB_HOST=${rdsHost}" >> /opt/csye6225/webapp/.env'
    sudo sh -c 'echo "DB_PORT=3306" >> /opt/csye6225/webapp/.env'
    sudo sh -c 'echo "DB_DATABASE=${rdsInstance.dbName}" >> /opt/csye6225/webapp/.env'
    sudo sh -c 'echo "DB_USER=${rdsInstance.username}" >> /opt/csye6225/webapp/.env'
    sudo sh -c 'echo "DB_PASSWORD=${rdsInstance.password}" >> /opt/csye6225/webapp/.env'


    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/bin/cloudwatch-config.json \
    -s
    `,

    tags: {

        Name: "EC2Instance",

    },

});
  

// Function to create Route53 DNS A record
const createDnsARecord = async (domainName, ec2Instance) => {
    const hostedZone = await aws.route53.getZone({
        name: domainName,
    });
 
    if (hostedZone) {
        const recordName = domainName;
        const recordType = "A";
        const recordTtl = 60;
        const recordSet = new aws.route53.Record(`dnsARecord-${recordName}`, {
            name: recordName,
            type: recordType,
            zoneId: hostedZone.zoneId,
            records: [ec2Instance.publicIp],
            ttl: recordTtl,
            allowOverwrite: true,
        });
    }
    else
    {
        console.error(`Zone for domain '${domainName}' not found.`);
    }
};
 
// Call the function to create DNS A record
createDnsARecord(DomainName, ec2Instance);


};

createSubnets();

