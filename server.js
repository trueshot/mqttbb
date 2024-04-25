const bb = require("./lib/barebones");
<<<<<<< Updated upstream
const { executeAll, JsonSubscription, QoS, Echo, sendOne } = require("./lib/pubsub");
=======
const { PubSub } = require("./lib/pubsub");
const iotsdk = require("aws-iot-device-sdk-v2");
const mqtt = iotsdk.mqtt;
// messages
//   ----flockee says: hello I just booted (announce)
//   server says here is a template
//   server says here is a tag
//   ----flockee says button pushed
//   ----flockee says here is a heartbeat
/*
class AnnouncePingBack extends PubSub {
  constructor() {
    super("ZebraTail/announce");
  }
>>>>>>> Stashed changes

  async sub(payload, topic, dup, qos, retain) {
    console.log(
      `Publish received. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`,
    );
    let json;
    try {
      json = await payload;
      const msg = JSON.parse(json);
      console.log(`payload:`, msg);


connection.publish(msg.thingName + "/direct", "node server is up", mqtt.QoS.AtLeastOnce);

    } catch (x) {
      console.error("payload error:", x, `\n${json}`);
    }
  }
}
*/
const args = {
  topic: "ZebraTail/chat",
  message: "por qué no los dos",
  count: 2,
};

function main(argv) {
   console.log('flag')
   const connection = await bb.connect();
   console.log('flag1')

<<<<<<< Updated upstream
  // Bare minimum single message
  //   console.log(await sendOne(connection, argv.topic, argv.message));
  // More complicated multi-message object
  //   await new Echo(argv.topic, argv.message, argv.count).execute(connection);
  // Any number of subscription callbacks, started async
  const subs = executeAll(connection, [
    new JsonSubscription(args.topic,  // any number, but just one here
      (json, topic, dup, qos, retain) => {
        console.log(topic, dup, qos, retain, json);
      }),
  ]).catch(x => {
    console.error(x);
  });

  // Simple publish to a single topic; await to preserve order
  await connection.publish(args.topic, args, QoS.AtLeastOnce);  // JSON payload
  await connection.publish(args.topic, args.message, QoS.AtLeastOnce);  // not JSON

  await subs;  // wait for stuff to happen until reject, then...
  await bb.disconnect(connection);  // ...tear everything down
=======
//   connection.publish(topic, message, mqtt.QoS.AtLeastOnce);
   connection.publish("ZebraTail-54_D5_00/direct", "node server is up", mqtt.QoS.AtLeastOnce);
   console.log('flag3')
  // Bare minimum single message, or more complicated multi-message object
  // console.log(await sendOne(connection, argv.topic, argv.message));
  // await new Echo(argv.topic, argv.message, argv.count).execute(connection);
  //await new AnnouncePingBack().execute(connection);

  //await bb.disconnect(connection);
>>>>>>> Stashed changes
}
setTimeout(function() {
   console.log('flag 4')
   main(args);
},5000)