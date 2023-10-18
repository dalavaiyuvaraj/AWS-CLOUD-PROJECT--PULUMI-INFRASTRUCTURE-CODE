"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");

require('dotenv').config();

// Access environment variables
const region = process.env.region;
const my_availabilityZone = process.env.availabilityZones;
const availabilityZones = my_availabilityZone.split(',');
const numPublicSubnets = parseInt(process.env.numPublicSubnets);
const numPrivateSubnets = parseInt(process.env.numPrivateSubnets);
const VPC_CIDR_prefix = process.env.VPC_CIDR_prefix;
const VPC_name = process.env.VPC_name;
const subnet_public_name = process.env.subnet_public_name;
const subnet_private_name = process.env.subnet_private_name;
const public_route_table = process.env.public_route_table;
const private_route_table = process.env.private_route_table;
const public_subnetconnect = process.env.public_subnetconnect;
const private_subnetconnect = process.env.private_subnetconnect;
const internet_gateway = process.env.internet_gateway;
const public_route = process.env.public_route;
const public_route_cidr_des = process.env.public_route_cidr_des;

// Create a VPC
const main = new aws.ec2.Vpc(VPC_name, {
    cidrBlock: VPC_CIDR_prefix,
    instanceTenancy: "default",
    tags: {
        Name: VPC_name,
    },
});

const publicSubnets = [];
const privateSubnets = [];

// Create public and private subnets
for (let i = 0; i < numPublicSubnets; i++) {
    let x = i+1;
    const subnetName = subnet_public_name + x ;

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

for (let i = 0; i < numPrivateSubnets; i++) {
    let x = i+1;
    const subnetName = subnet_private_name + x;

    const subnet = new aws.ec2.Subnet(subnetName, {
        vpcId: main.id,
        availabilityZone: region + availabilityZones[i % availabilityZones.length], // Rotate AZs
        cidrBlock: `10.0.${numPublicSubnets + i + 1}.0/24`,
        tags: {
            Name: subnetName,
        },
    });

    privateSubnets.push(subnet);
}

// Create route tables
const publicRouteTable = new aws.ec2.RouteTable(public_route_table, {
    vpcId: main.id,
    tags: {
        Name: public_route_table,
    },
});

const privateRouteTable = new aws.ec2.RouteTable(private_route_table, {
    vpcId: main.id,
    tags: {
        Name: private_route_table,
    },
});

const publicRouteTableAssociations = [];
const privateRouteTableAssociations = [];

// Associate public subnets with the public route table
for (let i = 0; i < numPublicSubnets; i++) {
    let x = i+1;
    const association = new aws.ec2.RouteTableAssociation(public_subnetconnect+x, {
        subnetId: publicSubnets[i].id,
        routeTableId: publicRouteTable.id,
    });

    publicRouteTableAssociations.push(association);
}

// Associate private subnets with the private route table
for (let i = 0; i < numPrivateSubnets; i++) {
    let x = i+1;
    const association = new aws.ec2.RouteTableAssociation(private_subnetconnect+x, {
        subnetId: privateSubnets[i].id,
        routeTableId: privateRouteTable.id,
    });

    privateRouteTableAssociations.push(association);
}

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway(internet_gateway, {
    vpcId: main.id,
    tags: {
        Name: internet_gateway,
    },
});

// Create a public route in the public route table
const publicRoute = new aws.ec2.Route(public_route, {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: public_route_cidr_des,
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

        }

    ],

    tags: {

        Name: "appSecurityGroup",

    },

});

const ec2Instance = new aws.ec2.Instance("ec2Instance", {

    instanceType: "t2.micro", // Set the desired instance type

    ami: "ami-01f68517d258955e9", // Replace with your custom AMI ID

    vpcSecurityGroupIds: [appSecurityGroup.id],

    subnetId: publicSubnets[0].id, // Choose one of your public subnets

    vpcId: main.id,

    keyName: "EC2Instance_keypair",

    rootBlockDevice: {

        volumeSize: 25,

        volumeType: "gp2",

    },

    tags: {

        Name: "EC2Instance",

    },

});

