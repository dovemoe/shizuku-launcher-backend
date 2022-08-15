const express = require("express");
var cors = require('cors');
var AWS = require('aws-sdk');

const PORT = process.env.PORT || 10001;

const app = express();

const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://aws.32v.shop',
        'https://aws.32v.shop',
    ],
    methods: 'GET,POST'
};

app.use(express.json());
app.use(cors(corsOptions));

app.get("/", function (req, res) {
    res.send("App is working");
});

app.post("/aws-launch-instance", (req, res) => {
    AWS.config = new AWS.Config();
    AWS.config.update(
        {
            accessKeyId: req.body.aki,
            secretAccessKey: req.body.saki,
            region: req.body.region
        }
    );
    var ec2 = new AWS.EC2();
    var imageName = ''
    var imageOwner = ''
    var imageId = ''
    if (req.body.system == 'Debian 10') {
        imageName = 'debian-10-amd64-2022*'
        imageOwner = '136693071363'
    }
    if (req.body.system == 'Debian 11') {
        imageName = 'debian-11-amd64-2022*'
        imageOwner = '136693071363'
    }
    if (req.body.system == 'Ubuntu 20.04') {
        imageName = 'ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-2022*'
        imageOwner = '099720109477'
    }
    if (req.body.system == 'Ubuntu 22.04') {
        imageName = 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-2022*'
        imageOwner = '099720109477'
    }
    if (req.body.system == 'Arch Linux') {
        imageName = '*'
        imageOwner = '647457786197'
    }
    var imageParams = {
        Filters: [
            {
                Name: 'name',
                Values: [
                    imageName
                ]
            },
            {
                Name: 'architecture',
                Values: [
                    'x86_64'
                ]
            }
        ],
        Owners: [
            imageOwner
        ]
    }
    ec2.describeImages(imageParams, function (err, data) {
        if (err) {
            res.status(500).send({
                reason: "An error occurred when launching the instance."
            });
        }
        else {
            imageId = data.Images[0].ImageId
            keyName = String(Date.now())
            var keyParams = {
                KeyName: keyName
            };
            ec2.createKeyPair(keyParams, function (err, data) {
                if (err) {
                    res.status(500).send({
                        reason: "An error occurred when launching the instance."
                    });
                } else {
                    var sgParams = {
                        Description: keyName,
                        GroupName: keyName
                    }
                    ec2.createSecurityGroup(sgParams, function (err, data) {
                        if (err) {
                            res.status(500).send({
                                reason: "An error occurred when launching the instance."
                            });
                        } else {
                            groupId = data.GroupId
                            var asgParams = {
                                GroupId: groupId,
                                IpPermissions: [
                                    {
                                        FromPort: 0,
                                        IpProtocol: "tcp",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All TCP"
                                            }
                                        ],
                                        ToPort: 65535
                                    },
                                    {
                                        FromPort: 0,
                                        IpProtocol: "udp",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All UDP"
                                            }
                                        ],
                                        ToPort: 65535
                                    },
                                    {
                                        FromPort: -1,
                                        IpProtocol: "icmp",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All ICMP"
                                            }
                                        ],
                                        ToPort: -1
                                    },
                                    {
                                        FromPort: -1,
                                        IpProtocol: "icmpv6",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All ICMPV6"
                                            }
                                        ],
                                        ToPort: -1
                                    }
                                ]
                            };
                            ec2.authorizeSecurityGroupIngress(asgParams, function (err, data) {
                                if (err) {
                                    res.status(500).send({
                                        reason: "An error occurred when launching the instance."
                                    });
                                } else {
                                    var userDataRaw = "#!/bin/bash\necho root:" + req.body.password + "|sudo chpasswd root\nsudo rm -rf /etc/ssh/sshd_config\nsudo tee /etc/ssh/sshd_config <<EOF\nClientAliveInterval 120\nSubsystem       sftp    /usr/lib/openssh/sftp-server\nX11Forwarding yes\nPrintMotd no\nChallengeResponseAuthentication no\nPasswordAuthentication yes\nPermitRootLogin yes\nUsePAM yes\nAcceptEnv LANG LC_*\nEOF\nsudo systemctl restart sshd\n"
                                    var userData = btoa(userDataRaw)
                                    var instanceParams = {
                                        ImageId: imageId,
                                        InstanceType: req.body.type,
                                        KeyName: keyName,
                                        MinCount: 1,
                                        MaxCount: 1,
                                        SecurityGroupIds: [
                                            groupId
                                         ],
                                        UserData: userData
                                    };
                                    ec2.runInstances(instanceParams, function (err, data) {
                                        if (err) {
                                            res.status(500).send({
                                                reason: "An error occurred when launching the instance."
                                            });
                                        } else {
                                            res.status(200).send({
                                                instanceId: data.Instances[0].InstanceId
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

app.post("/aws-get-quota", (req, res) => {
    AWS.config = new AWS.Config();
    AWS.config.update(
        {
            accessKeyId: req.body.aki,
            secretAccessKey: req.body.saki,
            region: req.body.region
        }
    );
    var servicequotas = new AWS.ServiceQuotas();
    var params = {
        QuotaCode: 'L-1216C47A',
        ServiceCode: 'ec2'
    };
    servicequotas.getServiceQuota(params, function (err, data) {
        if (err) {
            res.status(500).send({
                reason: "An error occurred when getting your EC2 quota."
            });
        }
        else {
            res.status(200).send({
                quota: data.Quota.Value
            });
        }
    });
});

app.post("/aws-check-instances", (req, res) => {
    AWS.config = new AWS.Config();
    AWS.config.update(
        {
            accessKeyId: req.body.aki,
            secretAccessKey: req.body.saki,
            region: req.body.region
        }
    );
    var ec2 = new AWS.EC2();
    var params = {}
    ec2.describeInstances(params, function(err, data) {
        if (err) {
            res.status(500).send({
                reason: "An error occurred when getting your instances."
            });
        }
        else {
            var processedInstances = []
            data.Reservations.forEach(reservation => {
                reservation.Instances.forEach(instance => {
                    processedInstances.push({id: instance.InstanceId, type: instance.InstanceType, ip: instance.PublicIpAddress, platform: instance.PlatformDetails})
                })
            })
            res.status(200).send({instances: processedInstances});
        }
      });
});

app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});