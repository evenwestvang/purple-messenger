import { convert } from "@shootismoke/convert";
const sanityClient = require("@sanity/client");
const axios = require("axios");

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

const WOOD_SMOKE_REBATE_MAGIC_NUMBER = 0.48;

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
  let aqi = convert("pm25", "raw", "usaEpa", atmosphericPM25 * WOOD_SMOKE_REBATE_MAGIC_NUMBER);

  let currentCondition;
  for (let i = 0; i < conditions.length; i++) {
    currentCondition = conditions[i];
    if (aqi < conditions[i].valueBeneath) {
      currentCondition.range = i;
      break;
    }
  }

  const measurements = await client.fetch('*[_type == "measurement"] | order(_createdAt desc)');

  const measurementDoc = {
    _type: "measurement",
    range: currentCondition.range,
    aqi: +aqi,
    pm25: +atmosphericPM25,
  };

  measurements.unshift(measurementDoc);
  truncateData(measurements, 120);
  client.create(measurementDoc);

  const broadcasts = await client.fetch('*[_type == "broadcast"] | order(_createdAt desc)');
  const previousBroadcastAQI = (broadcasts[0] && broadcasts[0].aqi) || 0;
  const previousBroadcastRange = (broadcasts[0] && broadcasts[0].range) || 0;
  const previousBroadcastTime = (broadcasts[0] && broadcasts[0]._createdAt) || 0;
  const minutesSinceBroadcast = (new Date().getTime() - previousBroadcastTime) / 1000 / 60;

  const recentlySent = minutesSinceBroadcast < 5;
  const rangeNotChanged = previousBroadcastRange == currentCondition.range;
  const aqiChangeTooSmall = Math.abs(previousBroadcastAQI - aqi) < 10;

  if (recentlySent || rangeNotChanged || aqiChangeTooSmall) {
    // if (false) {
    res.json({
      status: {
        recentlySent: recentlySent,
        rangeNotChanged: rangeNotChanged,
        aqiChangeTooSmall: aqiChangeTooSmall,
      },
    });
    return;
  }
  truncateData(broadcasts, 2);

  const broadcastMessage = `Qir quality has gone from '${conditions[previousBroadcastRange].name}' (${previousBroadcastAQI}) to '${currentCondition.name}' (${aqi})`;

  client.create({
    _type: "broadcast",
    aqi: +aqi,
    range: +currentCondition.range,
  });

  const chartURL = `https://quickchart.io/chart?backgroundColor=%23ffffff&c=${lineChartURLSpec(measurements)}`;

  console.info(chartURL);
  res.statusCode = 200;
  people.forEach((person) => {
    twilio.messages.create({
      from: TWILIO_NUMBER,
      to: person.mobileNumber,
      body: broadcastMessage,
      mediaUrl: chartURL,
    });
  });

  res.json({ status: "Broadcast", LRAPA_AQI: aqi });
};

function truncateData(objects, count) {
  objects.slice(count).forEach(async function (doc) {
    await client.delete(doc._id);
  });
}

function lineChartURLSpec(measurements) {
  const obj = {
    type: "line",
    data: {
      labels: measurements.map((d) => {
        return "";
      }),
      datasets: [
        {
          label: "LRAPA AQI",
          backgroundColor: "rgb(255, 99, 132)",
          borderColor: "rgb(255, 99, 132)",
          data: measurements
            .map((d) => {
              return d.aqi;
            })
            .reverse(),
          fill: false,
        },
      ],
    },
    options: {
      title: {
        display: true,
        text: `Air quality last ${measurements.length} minutes`,
      },
    },
  };
  return encodeURIComponent(JSON.stringify(obj));
}
