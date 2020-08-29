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

export default async (req, res) => {
  const people = await client.fetch('*[_type == "person"]');
  const sensors = await client.fetch('*[_type == "sensor"]');
  const sensorURL = `https://www.purpleair.com/json?show=${sensors[0].id}`;
  const response = await axios.get(sensorURL);
  const pm25Atmospheric = response.data.results[0].pm2_5_atm * WOOD_SMOKE_REBATE_MAGIC_NUMBER;
  const aqi = convert("pm25", "raw", "usaEpa", pm25Atmospheric);

  res.statusCode = 200;
  people.forEach((person) => {
    console.info(person);
    twilio.messages.create({
      from: TWILIO_NUMBER,
      to: person.mobileNumber,
      body: `ffffuuffu ${aqi}`,
    });
  });
  res.json({ LRAPA: aqi });
};
