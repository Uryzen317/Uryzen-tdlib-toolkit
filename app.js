import { NewMessage } from "telegram/events/NewMessage.js";

import {
  init,
  handleEliminate,
  logger,
  handleAnimate,
  handleSmartText,
} from "./util/helper.js";
import { handleDownload, handleDownloadQuality } from "./util/downloader.js";

// setting up the client , getting self id, configuring download server, setting up bio
const { client, selfId } = await init();

// handle commands/messages
client.addEventHandler((event) => {
  // check if message is sent by self
  const senderId = event.message.senderId.value.toString();
  if (senderId == selfId) {
    logger("message from self is sent.", "general");

    // handle /eliminate command
    if (event.message.text.includes("/eliminate")) {
      handleEliminate(client, event, senderId);
    }

    // handle /animate command
    if (event.message.text.includes("/animate")) {
      handleAnimate(client, event);
    }

    // handle /smart command
    if (event.message.text.includes("/smart")) {
      handleSmartText(client, event);
    }

    // handle /dowonload-quality command
    if (event.message.text.includes("/download-quality")) {
      handleDownloadQuality(client, event);
    }

    // handle /dowonload command
    if (event.message.text.includes("/download ")) {
      handleDownload(client, event);
    }
  }
}, new NewMessage());
