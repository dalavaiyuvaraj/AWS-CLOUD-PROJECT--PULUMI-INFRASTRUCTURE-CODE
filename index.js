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

