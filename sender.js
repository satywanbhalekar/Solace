const solace = require('solclientjs').debug; // Solace logging supported
const mq = require('ibmmq');

// Solace API initialization
solace.SolclientFactory.init({
    profile: solace.SolclientFactoryProfiles.version10 // For WebSocket connections
});

// IBM MQ Configuration
const queueManager = 'CONN'; // IBM MQ Queue Manager
const queueName = 'QUEUE.FOR.QMAX1'; // IBM MQ Queue Name
const channel = 'QMAX1.TO.QMAX2'; // IBM MQ Channel
const host = 'localhost'; // IBM MQ Host
const port = '1414'; // IBM MQ Port
const mqUser = 'mqadmin'; // MQ User
const mqPassword = 'Password123'; // MQ Password
const MQC = mq.MQC;

// Solace Configuration
const solaceHostUrl = 'wss://mr-connection-75repwb8ve9.messaging.solace.cloud:443';
const solaceVpn = 'My-First-Service';
const solaceUsername = 'solace-cloud-client';
const solacePassword = 'rralru6k9ah2qfjcfhhevl87cj';
const solaceTopicName = 'tutorial/queue';

// Set up MQ connection options
const cno = new mq.MQCNO();
cno.Options = MQC.MQCNO_NONE;

const csp = new mq.MQCSP();
csp.UserId = mqUser;
csp.Password = mqPassword;
cno.SecurityParms = csp;

const cd = new mq.MQCD();
cd.ChannelName = channel;
cd.ConnectionName = `${host}(${port})`;
cno.ClientConn = cd;

// Function to connect to IBM MQ and read messages from the queue
function sendMessageFromMQToSolace() {
    mq.Connx(queueManager, cno, function (err, conn) {
        if (err) {
            console.error('Error connecting to MQ:', err);
            return;
        }
        console.log('Connected to MQ');

        const od = new mq.MQOD();
        od.ObjectName = queueName;
        od.ObjectType = MQC.MQOT_Q;

        mq.Open(conn, od, MQC.MQOO_INPUT_AS_Q_DEF, function (err, hObj) {
            if (err) {
                console.error('Error opening MQ queue:', err);
                mq.Disc(conn, function () { });
                return;
            }
            console.log('MQ Queue opened successfully.');

            // Start getting messages from the queue
            getMessagesFromMQ(hObj, conn);
        });
    });
}

// Function to get messages from the MQ queue and send them to Solace
function getMessagesFromMQ(hObj, conn) {
    const md = new mq.MQMD();  // MQ Message Descriptor
    const gmo = new mq.MQGMO();  // MQ Get Message Options
    gmo.Options = MQC.MQGMO_NO_SYNCPOINT | MQC.MQGMO_WAIT;
    gmo.WaitInterval = 3000; // Wait for 3 seconds

    mq.Get(hObj, md, gmo, function (err, message) {
        if (err) {
            if (err.mqrc === MQC.MQRC_NO_MSG_AVAILABLE) {
                console.log("No more messages available.");
            } else {
                console.error('Error getting message from MQ:', err);
            }
        } else {
            const messageText = message.toString();
            console.log('Message received from MQ:', messageText);

            // Send the message to Solace
            publishMessageToSolace(messageText, conn, hObj);
        }

        // Continue to get messages
        getMessagesFromMQ(hObj, conn);
    });
}

// Function to send the message to Solace
function publishMessageToSolace(messageText, conn, hObj) {
    const solaceSession = solace.SolclientFactory.createSession({
        url: solaceHostUrl,
        vpnName: solaceVpn,
        userName: solaceUsername,
        password: solacePassword
    });

    solaceSession.on(solace.SessionEventCode.UP_NOTICE, function () {
        console.log("Solace connection established.");
        const message = solace.SolclientFactory.createMessage();
        message.setDestination(solace.SolclientFactory.createTopicDestination(solaceTopicName));
        message.setBinaryAttachment(messageText);

        solaceSession.send(message);
        console.log("Message sent to Solace: " + messageText);

        solaceSession.disconnect();
    });

    solaceSession.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, function (sessionEvent) {
        console.error("Solace connection failed:", sessionEvent.infoStr);
    });

    solaceSession.on(solace.SessionEventCode.DISCONNECTED, function () {
        console.log("Disconnected from Solace.");
    });

    solaceSession.connect();
}

// Run the sender
sendMessageFromMQToSolace();
