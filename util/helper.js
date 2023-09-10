import dotenv from "dotenv";
import input from "input";
import cron from "node-cron";
import chalk from "chalk";
import pkg from "telegram";

const { TelegramClient, Api } = pkg;
import { StringSession } from "telegram/sessions/index.js";

import { animateables } from "./constants.js";
import { startBioCrons } from "./bio.js";
import { initDownloadModule } from "./downloader.js";
import { configDownloadServer } from "./downloader.js";
import { initAvatarModule } from "./avatar.js";

// setting up client
export async function init() {
  logger("setting up client.", "general");
  dotenv.config();

  // client auth
  const client = new TelegramClient(
    new StringSession(process.env.STRING_SESSION), // string session
    parseInt(process.env.API_ID), // api_id
    process.env.API_HASH, // api_hash
    {
      connectionRetries: parseInt(process.env.CONNECTION_RETRIES),
    }
  );

  await client.start({
    phoneNumber: process.env.PHONE_NUMBER,
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  logger("client is connected.", "general");
  logger("Your string sesstion : ", "general");
  logger(client.session.save(), "general");

  // get self id
  let selfId = await getSelfId(client);

  // configuring download server
  process.env.CONFIG_SERVER && (await configDownloadServer());

  // start bio module
  await startBioCrons(client);

  // init donwload module
  await initDownloadModule();

  // init avatar module
  await initAvatarModule(client);

  return { client, selfId };
}

// managing logging process
export function logger(data, type = "general") {
  const time =
    new Date().getHours() +
    ":" +
    new Date().getMinutes() +
    ":" +
    new Date().getSeconds();

  switch (type) {
    // general logs are blue
    case "general": {
      console.log(chalk.blue(`[${type}] | ${time} | ${data}`));
      break;
    }
    // eliminate logs are green
    case "eliminate": {
      console.log(chalk.green(`[${type}] | ${time} | ${data}`));
      break;
    }
    // animate logs are magenta
    case "animate": {
      console.log(chalk.magenta(`[${type}] | ${time} | ${data}`));
      break;
    }
    // bio logs are yellow
    case "bio": {
      console.log(chalk.yellow(`[${type}] | ${time} | ${data}`));
      break;
    }
    // weather logs are red bright
    case "weather": {
      console.log(chalk.redBright(`[${type}] | ${time} | ${data}`));
      break;
    }
    // smart text logs are gray
    case "smart": {
      console.log(chalk.gray(`[${type}] | ${time} | ${data}`));
      break;
    }
    // donwload logs are cyan
    case "download": {
      console.log(chalk.cyan(`[${type}] | ${time} | ${data}`));
      break;
    }
    // avatar logs are Blue bright
    case "avatar": {
      console.log(chalk.blueBright(`[${type}] | ${time} | ${data}`));
      break;
    }
    // send logs are green bright
    case "send": {
      console.log(chalk.greenBright(`[${type}] | ${time} | ${data}`));
      break;
    }
  }
}

// message elimination handling
export function handleEliminate(client, event, senderId) {
  logger("eliminate command in process.", "eliminate");

  let { message, id } = event.message;
  let chatId = event.isPrivate
    ? event.message.peerId.userId.value
    : event.message.peerId.channelId.value;

  // parse the message text, time and rate
  message = message.split("\n");
  let commandsCount = message[0].split(" ");
  let time = commandsCount.length > 1 ? parseInt(commandsCount[1]) : 1;
  let rate = commandsCount.length > 2 ? parseInt(commandsCount[2]) : 1;
  message.shift();
  message = message.length ? message.join("\n") : "there's no data.";

  logger(
    `message will be eliminated in : ${time} second(s) by rate of ${rate} update(s) per second.`,
    "eliminate"
  );

  // core cron
  let schedule = cron.schedule("* * * * * *", async () => {
    let repeater;
    logger("elimination cron clock.", "eliminate");

    // check if time is remained
    if (time > 0) {
      // controlling rate of sending message
      for (let counter = 0; counter < rate; counter++) {
        let milisecondTimer =
          rate == 1 ? "00" : (59 - (59 / rate) * counter).toFixed(0);
        repeater = setTimeout(async () => {
          try {
            await client.invoke(
              new Api.messages.EditMessage({
                peer: chatId,
                id: id,
                noWebpage: true,
                message: `${message}\n\n\nmessage will be eliminated in ${time}.${milisecondTimer} second(s).`,
              })
            );
          } catch (err) {
            // unmatched message id error | rate limition time out error
            clearTimeout(repeater);
            logger(
              "message edition process failed, trying again ...",
              "eliminate"
            );
          }
        }, (1000 / rate) * counter);
      }
      time--;
    } else {
      // remove the message
      await client.deleteMessages(chatId, [id], {
        revoke: true,
      });
      logger("end of cron cycle. message deletion done.", "eliminate");
      schedule.stop();
      clearTimeout(repeater);
    }
  });
}

// check if message is animateable
export async function handleAnimate(client, event) {
  let { message, id } = event.message;
  let chatId = event.isPrivate
    ? event.message.peerId.userId.value
    : event.message.peerId.channelId.value;
  logger("start of animating process", "animate");

  // get the command
  let commandsCount = message.split("\n")[0].split(" ");
  let type = commandsCount.length > 1 ? parseInt(commandsCount[1]) : 0;
  let rate = commandsCount.length > 2 ? parseInt(commandsCount[2]) : 1;

  animateClock(type, client, chatId, id, rate);
}

// actual message animation handler
export function animateClock(type = 0, client, chatId, id, rate) {
  for (let i = 0; i < animateables[type].length; i++) {
    setTimeout(async () => {
      try {
        await client.invoke(
          new Api.messages.EditMessage({
            peer: chatId,
            id: id,
            noWebpage: true,
            message: `${animateables[type][i]}`,
          })
        );
        logger("animation tick.", "animate");

        // stack overflow
        if (i == animateables[type].length - 1) {
          animateClock(type, client, chatId, id, rate);
          logger("animate function self recall.", "animate");
        }
      } catch (err) {
        // unmatched message id error | rate limition time out error
        logger("message edition process failed, trying again ...", "animate");
        // console.log(err);
      }
    }, rate * 1000 * i);
  }
}

// handle smart text update handling
export function handleSmartText(client, event) {
  let { message, id } = event.message;
  let chatId = event.isPrivate
    ? event.message.peerId.userId.value
    : event.message.peerId.channelId.value;
  logger("start of smart text handling process", "smart");

  // get the command
  let commandsCount = message.split("\n")[0].split(" ");
  let rate = commandsCount.length > 1 ? parseInt(commandsCount[1]) : 1;

  // remove the first line of the message (the /smart part)
  message = message.split("\n");
  message.shift();
  message = message.join("\n");

  // check if text is event really smart
  if (smartTextUpdateTracker(message) === message) {
    logger("the smart text isn't smart!", "smart");
    return;
  }

  // handle the animation
  let retryCount = 0;
  let timer = setInterval(async () => {
    message = smartTextUpdateTracker(message);
    try {
      await client.invoke(
        new Api.messages.EditMessage({
          peer: chatId,
          id: id,
          noWebpage: true,
          message: `${message}`,
        })
      );
      logger("smart text update tick.", "smart");
    } catch (err) {
      // error handling text
      retryCount++;
      logger(
        "error while updating smart text, retrying [" +
          retryCount +
          "]. : " +
          err.message,
        "smart"
      );
      if (retryCount > 3) {
        clearInterval(timer);
      }
    }
  }, rate * 1000);
}

// calculate next character in an smart text
export function smartTextUpdateTracker(text) {
  let tracker = [];
  text = [...text];

  text.map((t, index) => {
    for (let sequence = 0; sequence < animateables.length; sequence++) {
      for (
        let section = 0;
        section < animateables[sequence].length;
        section++
      ) {
        let currentChar = animateables[sequence][section];
        if (t == currentChar) {
          // found a character
          tracker.push({
            index,
            sequence,
            section,
          });
        }
      }
    }
  });

  tracker.map((track) => {
    let { index, sequence, section } = track;
    if (section + 1 == animateables[sequence].length) section = -1;
    text[index] = animateables[sequence][section + 1];
  });

  return text.join("");
}

// get self id
export async function getSelfId(client) {
  let selfPm = await client.sendMessage("me", {
    message: "Service started successfully.",
  });

  return selfPm.senderId.value;
}

// send command
export async function handleSend(client, event, cb) {
  logger("handling send command.", "send");

  let { message, id } = event.message;
  let chatId = event.isPrivate
    ? event.message.peerId.userId.value
    : event.message.peerId.channelId.value;

  // parse the message text, time and rate
  message = message.split("\n");
  let commandsCount = message[0].split(" ");
  let groupId = commandsCount.length > 1 ? parseInt(commandsCount[1]) : 1;
  let time = commandsCount.length > 2 ? parseInt(commandsCount[2]) : 1;
  message.shift();
  message = message.length ? message.join("\n") : "there's no data.";

  sendInterval = setInterval(async () => {
    // sending message
    logger("send message interval initiated.", "send");

    await client.invoke(
      new Api.messages.sendMessage({
        silent: true,
        message,
        peer: new Api.InputPeerChat({
          chatId: groupId,
        }),
      })
    );
  }, time * 1000);
  cb(sendInterval);
}

// id command
export async function handleId(client, event) {
  let chatId =
    event.message.peerId?.userId?.value ||
    event.message.peerId?.channelId?.value ||
    event.message.peerId?.chatId?.value;

  let type;
  event.message.peerId?.chatId && (type = "chat");
  event.message.peerId?.userId && (type = "user");
  event.message.peerId?.channelId && (type = "channel");
  console.log(type);

  // general chat data
  if (!event.message.replyTo) {
    let message;

    // user
    if (type == "user") {
      const users = await client.invoke(
        new Api.users.GetUsers({
          id: [chatId],
        })
      );

      const user = users[0];
      const targetId = user.id.value;
      message = `
id : ${targetId}
first name : ${user.firstName || "undefined"} 
last name : ${user?.lastName || "undefined"}
username : ${user?.username || "undefined"}
deleted : ${user.deleted}
bot : ${user.bot}
verified : ${user.verified}
restricted : ${user.restricted}
scam : ${user.scam}
fake : ${user.fake}
premium : ${user.premium}
      `;
    }

    // chat
    if (type == "chat") {
      const chats = await client.invoke(
        new Api.messages.GetChats({
          id: [chatId],
        })
      );
      let chat = chats.chats[0];
      message = `
title : ${chat.title}
id : ${chat.id.value}
deactivated : ${chat.deactivated}
callActive : ${chat.callActive}
noforwards : ${chat.noforwards}
participants count : ${chat.participantsCount}
supergroup : ${chat.migratedTo ? "true" : "false"}
admin rights : ${JSON.stringify(chat.adminRights, "\n", " ").replaceAll(
        '"',
        " "
      )}
  banned rights : ${JSON.stringify(
    chat.defaultBannedRights,
    "\n",
    " "
  ).replaceAll('"', " ")}
  `;
    }

    // channel
    if (type == "channel") {
      const chats = await client.invoke(
        new Api.channels.GetChannels({
          id: [chatId],
        })
      );
      let chat = chats.chats[0];
      console.log(chat);
      message = `
title : ${chat.title}
id : ${chat.id.value}
broadcast : ${chat.broadcast}
verified : ${chat.verified}
megagroup : ${chat.megagroup}
restricted : ${chat.restricted}
signatures : ${chat.signatures}
scam : ${chat.scam}
gigagroup : ${chat.gigagroup}
joinToSend : ${chat.joinToSend}
forum : ${chat.forum}
callActive : ${chat.callActive}
noforwards : ${chat.noforwards}
participants count : ${chat.participantsCount}
supergroup : ${chat.migratedTo ? "true" : "false"}
admin rights : ${JSON.stringify(chat.adminRights, "\n", " ").replaceAll(
        '"',
        " "
      )}
  banned rights : ${JSON.stringify(
    chat.defaultBannedRights,
    "\n",
    " "
  ).replaceAll('"', " ")}
  `;
    }

    // shared code
    client.sendMessage(chatId, {
      replyTo: event.message.id,
      message,
    });
    return;
  }

  // an spicific target
  if (!event.message.repyTo) {
    let message;

    // users
    if (type == "user" || type == "chat") {
      const result = await client.invoke(
        new Api.messages.GetMessages({
          id: [event.message.replyTo.replyToMsgId],
          channel: chatId,
        })
      );

      const user = result.users[0];
      const targetId = result.users[0].id.value;
      message = `
id : ${targetId}
first name : ${user.firstName || "undefined"} 
last name : ${user?.lastName || "undefined"}
username : ${user?.username || "undefined"}
deleted : ${user.deleted}
bot : ${user.bot}
verified : ${user.verified}
restricted : ${user.restricted}
scam : ${user.scam}
fake : ${user.fake}
premium : ${user.premium}
  `;
    }

    // channels
    if (type == "channel") {
      const result = await client.invoke(
        new Api.channels.GetMessages({
          id: [event.message.replyTo.replyToMsgId],
          channel: chatId,
        })
      );

      const user = result.users[0];
      const targetId = result.users[0].id.value;
      message = `
id : ${targetId}
first name : ${user.firstName || "undefined"} 
last name : ${user?.lastName || "undefined"}
username : ${user?.username || "undefined"}
deleted : ${user.deleted}
bot : ${user.bot}
verified : ${user.verified}
restricted : ${user.restricted}
scam : ${user.scam}
fake : ${user.fake}
premium : ${user.premium}
  `;
    }

    // shared code
    client.sendMessage(chatId, {
      message,
      replyTo: event.message.id,
    });
  }
}
