import { convert } from "@shootismoke/convert";
const sanityClient = require("@sanity/client");
const axios = require("axios");
const WOOD_SMOKE_REBATE_MAGIC_NUMBER = 0.48;

const client = sanityClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: "production",
  token: process.env.SANITY_TOKEN, // or leave blank to be anonymous user
  useCdn: false, // `false` if you want to ensure fresh data
});

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;
const twilio = require("twilio")(ACCOUNT_SID, TWILIO_TOKEN);

const conditions = [
  {
    name: "Excellent",
    valueBeneath: 35,
  },
  {
    name: "Fine",
    valueBeneath: 50,
  },
  {
    name: "OKish",
    valueBeneath: 75,
  },
  {
    name: "Get inside",
    valueBeneath: 100,
  },
  {
    name: "Stay inside",
    valueBeneath: 150,
  },
  {
    name: "Nope. Just Nope.",
    valueBeneath: 200,
  },
];

export default async (req, res) => {
  const people = await client.fetch('*[_type == "person"]');
  const sensors = await client.fetch('*[_type == "sensor"]'); // TODO: average out more

  const sensorURL = `https://www.purpleair.com/json?show=${sensors[0].id}`;
  const sensorResponse = await axios.get(sensorURL);
  const atmosphericPM25 = sensorResponse.data.results[0].pm2_5_atm;
  const aqi = convert("pm25", "raw", "usaEpa", atmosphericPM25 * WOOD_SMOKE_REBATE_MAGIC_NUMBER);

  let currentCondition;
  for (let i = 0; i < conditions.length; i++) {
    currentCondition = conditions[i];
    if (aqi < conditions[i].valueBeneath) {
      currentCondition.range = i;
      break;
    }
  }

  const measurements = await client.fetch('*[_type == "measurement"] | order(_createdAt desc)[0...10]');
  const minutesSincePreviousMeasurement = (new Date().getTime() - new Date((measurements[0] && measurements[0]._createdAt) || 0).getTime()) / 1000 / 60;

  if (minutesSincePreviousMeasurement < 1) {
    res.json({ status: "Throttled" });
    return;
  }

  client.create({
    _type: "measurement",
    range: currentCondition.range,
    aqi: +aqi,
    pm25: +atmosphericPM25,
  });

  const broadcasts = await client.fetch('*[_type == "broadcast"] | order(_createdAt desc)');
  const previousBroadcastAQI = (broadcasts[0] && broadcasts[0].aqi) || 0;
  const previousBroadcastRange = (broadcasts[0] && broadcasts[0].range) || 0;
  const previousBroadcastTime = (broadcasts[0] && broadcasts[0]._createdAt) || 0;
  const minutesSinceBroadcast = (new Date().getTime() - previousBroadcastTime) / 1000 / 60;

  if (minutesSinceBroadcast < 5 || previousBroadcastRange == currentCondition.range || Math.abs(previousBroadcastAQI - aqi) < 10) {
    res.json({ status: "No change" });
    return;
  }

  const broadcastMessage = `We just went from gone from ${conditions[previousBroadcastRange].name}(${previousBroadcastAQI}) to ${currentCondition.name}(${aqi})`;
  console.info(previousBroadcastRange, currentCondition.range);

  client.create({
    _type: "broadcast",
    aqi: +aqi,
    range: +currentCondition.range,
  });

  res.statusCode = 200;
  people.forEach((person) => {
    console.info("person", person);
    twilio.messages.create({
      from: TWILIO_NUMBER,
      to: person.mobileNumber,
      body: broadcastMessage,
    });
  });
  // https://quickchart.io/chart?bkg=white&c={type:%27bar%27,data:{labels:[2012,2013,2014,2015,2016],datasets:[{label:%27Users%27,data:[100,60,50,180,120]}]}}

  res.json({ status: "Broadcast", LRAPA_AQI: aqi });
};
