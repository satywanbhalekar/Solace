var solace = require('solclientjs').debug; // Solace logging supported

// Initialize the Solace API before using it
solace.SolclientFactory.init({
    profile: solace.SolclientFactoryProfiles.version10 // For using WebSockets
});

var mq = require('ibmmq');

// IBM MQ Configuration
const queueManager = 'CONN'; // Your Queue Manager name 
var MQC = mq.MQC;

var queueName = 'QUEUE.FOR.QMAX1'; // Your IBM MQ queue name
const channel = 'QMAX1.TO.QMAX2'; // Your IBM MQ channel name
const host = 'localhost'; // Your IBM MQ host
const port = '1414'; // Your IBM MQ port (default for TCP)
const mqUser = 'mqadmin'; // Use the new user
const mqPassword = 'Password123'; // Password for the new user

// Set up MQ connection options
var cno = new mq.MQCNO();
cno.Options = MQC.MQCNO_NONE;

// MQ Queue connection options
var csp = new mq.MQCSP();
csp.UserId = mqUser;
csp.Password = mqPassword;
cno.SecurityParms = csp;

var cd = new mq.MQCD();
cd.ChannelName = channel;
cd.ConnectionName = `${host}(${port})`;
cno.ClientConn = cd;

function storeMessageToMQ(messageText) {
    const messageBuffer = Buffer.from(messageText);

    mq.Connx(queueManager, cno, function(err, conn) {
        if (err) {
            console.error("Error connecting to MQ: ", err);
            return;
        }
        console.log("Connected to MQ");

        var od = new mq.MQOD();
        od.ObjectName = queueName;
        od.ObjectType = MQC.MQOT_Q;

        mq.Open(conn, od, MQC.MQOO_OUTPUT, function(err, hObj) {
            if (err) {
                console.error("Error opening MQ queue: ", err);
                mq.Disc(conn, function() {});
                return;
            }

            var mqMessage = new mq.MQMD();
            var pmo = new mq.MQPMO();
            pmo.Options = MQC.MQPMO_NO_SYNCPOINT;

            // Set message data directly in the mqMessage
            mqMessage.Data = messageBuffer; // Set the buffer as message data

            // Log the parameters to be passed to mq.Put()
            console.log("Putting message to MQ with the following parameters:");
            console.log("Connection:", conn);
            console.log("Handle:", hObj);
            console.log("Message Descriptor:", mqMessage);
            console.log("Put Message Options:", pmo);

            // Put the message into the queue
            mq.Put(hObj, mqMessage, pmo, messageBuffer, function(err) {
                if (err) {
                    console.error("Error putting message to MQ: ", err);
                } else {
                    console.log("Message stored in MQ successfully");
                }
                mq.Close(hObj, 0, function(err) {
                    if (err) {
                        console.error("Error closing MQ queue: ", err);
                    }
                    mq.Disc(conn, function(err) {
                        if (err) {
                            console.error("Error disconnecting from MQ: ", err);
                        }
                    });
                });
            });
        });
    });
}

// Subscriber function for Solace
var TopicSubscriber = function (solaceModule, topicName) {
    'use strict';
    var solace = solaceModule;
    var subscriber = {};
    subscriber.session = null;
    subscriber.topicName = topicName;
    subscriber.subscribed = false;

    // Logger
    subscriber.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    subscriber.log('\n*** Subscriber to topic "' + subscriber.topicName + '" is ready to connect ***');

    // Main function
    subscriber.run = function () {
        subscriber.connect();
    };

    // Establish connection to Solace PubSub+
    subscriber.connect = function () {
        if (subscriber.session !== null) {
            subscriber.log('Already connected and ready to subscribe.');
            return;
        }

        var hostUrl = 'wss://mr-connection-75repwb8ve9.messaging.solace.cloud:443';
        var vpnName = 'My-First-Service';
        var username = 'solace-cloud-client';
        var pass = 'rralru6k9ah2qfjcfhhevl87cj';

        subscriber.log('Connecting to Solace PubSub+ Event Broker using URL: ' + hostUrl);
        subscriber.log('Client username: ' + username);
        subscriber.log('Solace VPN: ' + vpnName);

        try {
            subscriber.session = solace.SolclientFactory.createSession({
                url: hostUrl,
                vpnName: vpnName,
                userName: username,
                password: pass,
            });
        } catch (error) {
            subscriber.log('Error creating session: ' + error.toString());
            return;
        }

        subscriber.session.on(solace.SessionEventCode.UP_NOTICE, function () {
            subscriber.log('=== Successfully connected and ready to subscribe. ===');
            subscriber.subscribe();
        });

        subscriber.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, function (sessionEvent) {
            subscriber.log('Connection failed: ' + sessionEvent.infoStr);
        });

        subscriber.session.on(solace.SessionEventCode.MESSAGE, function (message) {
            var messageText = message.getBinaryAttachment();
            subscriber.log('Received message: "' + messageText + '"');
            storeMessageToMQ(messageText); // Store the message in MQ
        });

        try {
            subscriber.session.connect();
        } catch (error) {
            subscriber.log('Error connecting: ' + error.toString());
        }
    };

    subscriber.subscribe = function () {
        if (subscriber.session !== null) {
            subscriber.log('Subscribing to topic: ' + subscriber.topicName);
            try {
                subscriber.session.subscribe(
                    solace.SolclientFactory.createTopicDestination(subscriber.topicName),
                    true, 
                    subscriber.topicName,
                    10000
                );
            } catch (error) {
                subscriber.log('Subscription error: ' + error.toString());
            }
        } else {
            subscriber.log('Cannot subscribe because not connected to Solace.');
        }
    };

    return subscriber;
};

// Create and run the subscriber
var subscriber = new TopicSubscriber(solace, 'tutorial/queue');
subscriber.run();