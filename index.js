"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

const vpcCIDRBlock = new pulumi.Config("my_vpc").require("cidrBlock");
const publicRouteTableCIDRBlock = new pulumi.Config("my_publicRouteTable").require("cidrBlock");
const numOfSubnet = new pulumi.Config("numOfSubnets").require("number");
const region = new pulumi.Config("aws").require("region");
const configValue = new pulumi.Config("availabilityZones").require("zones");
const availabilityZones = configValue.split(',');
const numOfSubnets = parseInt(numOfSubnet);
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

const publicSubnets = [];
const privateSubnets = [];

// Create public and private subnets
for (let i = 0; i < numOfSubnets; i++) {
    let x = i+1;
    const subnetName = "subnet_public_name" + x ;

    const subnet = new aws.ec2.Subnet(subnetName, {
        vpcId: main.id,
        availabilityZone: region + availabilityZones[i % availabilityZones.length], // Rotate AZs
        cidrBlock: `10.0.${i + 1}.0/24`,
        mapPublicIpOnLaunch: true,
        tags: {
            Name: subnetName,
        },
    });

    publicSubnets.push(subnet);
}

for (let i = 0; i < numOfSubnets; i++) {
    let x = i+1;
    const subnetName = "subnet_private_name" + x;

    const subnet = new aws.ec2.Subnet(subnetName, {
        vpcId: main.id,
        availabilityZone: region + availabilityZones[i % availabilityZones.length], // Rotate AZs
        cidrBlock: `10.0.${numOfSubnets + i + 1}.0/24`,
        tags: {
            Name: subnetName,
        },
    });

    privateSubnets.push(subnet);
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
for (let i = 0; i < numOfSubnets; i++) {
    let x = i+1;
    const association = new aws.ec2.RouteTableAssociation("public_subnetconnect"+x, {
        subnetId: publicSubnets[i].id,
        routeTableId: publicRouteTable.id,
    });

    publicRouteTableAssociations.push(association);
}

// Associate private subnets with the private route table
for (let i = 0; i < numOfSubnets; i++) {
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

const rdsInstance = new aws.rds.Instance("myrdsinstance", {
    dbName: "csye6225",
    identifier: "csye6225",
    allocatedStorage: 20,             // The storage capacity for the RDS instance
    storageType: "gp2",               // General Purpose (SSD)
    engine: "mysql",                 // The database engine (e.g., MySQL, PostgreSQL, etc.)
    //engineVersion: "5.7",            // Engine version
    instanceClass: "db.t2.micro",    // RDS instance type
    username: "csye6225",             // Database master username
    password: "Yuvarajmy#143",     // Database master password
    skipFinalSnapshot: true,         // Do not create a final DB snapshot when the instance is deleted
    publiclyAccessible: false,       // RDS instance is not publicly accessible
    multiAz: false,                  // Multi-AZ deployment (true for high availability)
    vpcSecurityGroupIds: [dbSecurityGroup.id], // Add security group IDs to control access
    dbSubnetGroupName: dbSubnetGroup.id, // Name of the DB subnet group (create one if it doesn't exist)
    parameterGroupName: "csye6225",
});

const rdsHost = rdsInstance.endpoint.apply(endpoint => {
    return endpoint.split(":")[0];
});



const ec2Instance = new aws.ec2.Instance("ec2Instance", {

    instanceType: "t2.micro", // Set the desired instance type

    ami: "ami-04ad682997a4552f5", // Replace with your custom AMI ID

    vpcSecurityGroupIds: [appSecurityGroup.id],

    subnetId: publicSubnets[0].id, // Choose one of your public subnets

    vpcId: main.id,

    keyName: "EC2Instance_keypair",

    rootBlockDevice: {

        volumeSize: 25,

        volumeType: "gp2",

    },
    userData: pulumi.interpolate`#!/bin/bash
    
    # Create the .env file inside the /opt/example folder
    echo "PORT=3000" >> /opt/webapp/.env
    echo "DB_HOST=${rdsHost}" >> /opt/webapp/.env
    echo "DB_PORT=3306" >> /opt/webapp/.env
    echo "DB_DATABASE=csye6225" >> /opt/webapp/.env
    echo "DB_USER=admin" >> /opt/webapp/.env
    echo "DB_PASSWORD=Admin@143" >> /opt/webapp/.env
    
    # Add the MySQL commands
    sudo mysql -u csye6225 -h ${rdsHost} -p"Yuvarajmy#143" -e "CREATE USER 'admin'@'%' IDENTIFIED BY 'Admin@143';"
    sudo mysql -u csye6225 -h ${rdsHost} -p"Yuvarajmy#143" -e "GRANT ALL PRIVILEGES ON csye6225.* TO 'admin'@'%' WITH GRANT OPTION;"
    sudo mysql -u csye6225 -h ${rdsHost} -p"Yuvarajmy#143" -e "FLUSH PRIVILEGES;"

    #Creating a systemd file
    sudo echo "[Unit]
    Description=Webapp Service
    After=network.target

    [Service]
    Type=simple
    User=csye6225
    Group=csye6225
    WorkingDirectory=/opt/webapp
    ExecStart=/usr/bin/node /opt/webapp/index.js
    Restart=always
    RestartSec=3
    TimeoutSec=60

    [Install]
    WantedBy=multi-user.target" > /etc/systemd/system/webapp.service

    # Reload systemd and start the webapp service
    sudo systemctl daemon-reload
    sudo systemctl start webapp.service
    sudo systemctl enable webapp.service`,

    tags: {

        Name: "EC2Instance",

    },

});

