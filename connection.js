const mq = require('ibmmq');

const queueManager = 'CONN'; // Your Queue Manager name
const channel = 'QMAX1.TO.QMAX2'; // Your sender channel
const host = 'localhost'; // Your IBM MQ host
const port = '1414'; // Your IBM MQ port (default for TCP)
const mqUser = 'mqadmin'; // Use the new user
const mqPassword = 'Password123'; // Password for the new user
const queueName = 'QUEUE.FOR.QMAX1'; // Replace with your actual queue name




// Set up MQ connection options
const MQC = mq.MQC; // Import the MQ constants
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

// Test connection to IBM MQ
mq.Connx(queueManager, cno, function(err, conn) {
    if (err) {
        console.error("Error connecting to MQ: ", err);
    } else {
        console.log("Connected to MQ successfully");

        // Create a message to send
        const msg = "Hello, IBM MQ!";
        const mqmd = new mq.MQMD();
        const pmo = new mq.MQPMO();
        pmo.Options = MQC.MQPMO_NO_SYNCPOINT; // Send without syncpoint

        // Create an MQOD object for the queue
        const mqod = new mq.MQOD();
        mqod.ObjectType = MQC.MQOT_Q; // Specify that we are opening a queue
        mqod.ObjectName = queueName; // Set the queue name

        // Open the queue for output
        mq.Open(conn, mqod, MQC.MQOO_OUTPUT, function(err, hObj) {
            if (err) {
                console.error("Error opening queue: ", err);
            } else {
                // Send the message
                mq.Put(hObj, mqmd, pmo, msg, function(err) {
                    if (err) {
                        console.error("Error sending message: ", err);
                    } else {
                        console.log("Message sent successfully");
                    }
                    // Close the queue
                    mq.Close(hObj, 0, function(err) {
                        if (err) {
                            console.error("Error closing queue: ", err);
                        }
                    });
                });
            }
        });

        // Disconnect from the queue manager
        mq.Disc(conn, function(err) {
            if (err) {
                console.error("Error disconnecting from MQ: ", err);
            }
        });
    }
});
