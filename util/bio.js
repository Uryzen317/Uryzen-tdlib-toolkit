import jalaliMoment from "jalali-moment";
import hijriMoment from "moment-hijri";
import axios from "axios";
import cron from "node-cron";

import { Api } from "telegram";

import { logger } from "./helper.js";
import { weatherCodes, tempIcons } from "./constants.js";

export async function updateBio(client, bioData) {
  const rawText = `${getTimeIcon() + getTime().time} ${
    bioData.weatherIcon + bioData.weather
  } ${bioData.tempIcon + bioData.temp}°C ⛪️${bioData.miladiDate} 🕋${
    bioData.hijriDate
  } 🏠${bioData.jalaliDate}`;

  const addition = process.env.BIO_ADDITION;

  try {
    // 🕐12:06:52 🌦Cloudy ❄️24°C ⛪️22/04/03 🕋23/03/07 🏠02/03/01 💻 uryzen317.ir
    await client.invoke(
      new Api.account.UpdateProfile({
        about: rawText + " " + addition,
      })
    );

    logger("bio updated.", "bio");
  } catch (err) {
    logger(err.message, "retrying the short text", "bio");

    // retry with a shorter text
    // 🕐12:06:52 🌦Cloudy ❄️24°C ⛪️22/04/03 🕋23/03/07 🏠02/03/01
    await client.invoke(
      new Api.account.UpdateProfile({
        about: rawText,
      })
    );
  }
}

export function getDateJalali(year, month, day) {
  return jalaliMoment(`${year}/${month}/${day}`, "YYYY/MM/DD")
    .locale("fa")
    .format("YYYY/MM/DD")
    .split("")
    .filter((char, index) => (index != 0 && index != 1 ? char : undefined))
    .join("");
}

export function getDateHijri(year, month, day) {
  return hijriMoment(`${year}/${month}/${day - 1}`, "YYYY/MM/DD")
    .locale("en")
    .format("iYYYY/iM/iD")
    .split("")
    .filter((char, index) => (index != 0 && index != 1 ? char : undefined))
    .join("");
}

export async function updateBioData() {
  // time stuff
  let date = new Date();
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let miladiDate = `${year.toString()[2] + year.toString()[3]}/${month}/${day}`;
  let jalaliDate = getDateJalali(year, month, day);
  let hijriDate = getDateHijri(year, month, day);

  // weather stuff
  let weatherData = await getWeather();
  Object.assign(weatherData, getWeatherIcon(weatherData.getWeathercode));

  return {
    miladiDate,
    jalaliDate,
    hijriDate,
    temp: weatherData.temperature.toFixed(0),
    tempIcon: getTempIcon(weatherData.temperature),
    weather: weatherData.description,
    weatherIcon: weatherData.icon,
  };
}

export function getTime() {
  let date = new Date();
  let hour = date.getHours().toString();
  let minute = date.getMinutes().toString();
  let seconds = date.getSeconds().toString();

  seconds = seconds.length == 2 ? seconds : `0${seconds}`;
  minute = minute.length == 2 ? minute : `0${minute}`;
  hour = hour.length == 2 ? hour : `0${hour}`;

  return {
    time: `${hour}:${minute}:${seconds}`,
    hour: parseInt(hour),
    minute: parseInt(minute),
    second: parseInt(seconds),
  };
}

export function getTimeIcon() {
  let time = getTime();
  let fullClocks = [
    "🕛",
    "🕐",
    "🕑",
    "🕒",
    "🕓",
    "🕔",
    "🕕",
    "🕖",
    "🕗",
    "🕘",
    "🕙",
    "🕚",
  ];
  let halfClocks = [
    "🕧",
    "🕜",
    "🕝",
    "🕞",
    "🕟",
    "🕠",
    "🕡",
    "🕢",
    "🕣",
    "🕤",
    "🕥",
    "🕦",
  ];

  time.hour = parseInt(time.hour);
  time.hour = time.hour > 11 ? time.hour - 12 : time.hour;

  if (parseInt(time.minute) < 30) {
    // time is full
    return fullClocks[time.hour] || fullClocks[0];
  } else {
    // time is half
    return halfClocks[time.hour] || halfClocks[0];
  }
}

export async function getWeather() {
  let weather;
  await axios
    .get(
      "https://api.open-meteo.com/v1/forecast?latitude=30.2981&longitude=56.42&current_weather=true"
    )
    .then((response) => {
      weather = response.data ? response.data?.current_weather : false;
      if (!response.data) logger(response.error, "weather");
    })
    .catch((err) => {
      weather = false;
      logger(err.message, "weather");
    });

  return weather;
}

export function getWeatherIcon(weatherCode) {
  let index = 0;
  Object.keys(weatherCodes).map((wc, i) => {
    wc == weatherCode ? (index = i) : null;
  });
  return weatherCodes[Object.keys(weatherCodes)[index]];
}

export function getTempIcon(temp) {
  temp = parseInt(temp);
  if (temp <= 8) return tempIcons[0]; // cold, snow icon
  if (temp > 8 && temp <= 15) return tempIcons[1]; // moderate, green thing icon
  if (temp > 15) return tempIcons[2]; // hot, fire icon
}

export async function startBioCrons(client) {
  let bioData = await updateBioData();
  await updateBio(client, bioData);

  // handle bio updates
  cron.schedule("*/20 * * * * *", async () => {
    await updateBio(client, bioData);
  });

  // update weather data, time , temprature and ...
  cron.schedule("*/60 * * * * *", async () => {
    bioData = await updateBioData();
  });
}
