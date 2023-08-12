import { exec } from "node:child_process";
import { mkdir, readdir, rm, rmdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { isDataView } from "node:util/types";
import { Api } from "telegram";
import { v4 } from "uuid";

import { logger } from "./helper.js";

// install donwload section dependencies
export async function configDownloadServer() {
  if (!process.env.CONFIG_SERVER) return;
  // init works
  await installFFMPEG();
  await installYoutubedl();
}

// create required folder to avoid further errors
export async function initDownloadModule() {
  try {
    return await mkdir(join("./", "files"));
  } catch (err) {
    return;
  }
}

// installing ffmpeg
export async function installFFMPEG() {
  exec("apt install ffmpeg -y", (err, stdout, stderr) => {
    if (err)
      return logger(
        "download section initialization falied. cant install ffmpeg.",
        "download"
      );
    resolve(logger("installing ffmpeg done."));
  });
}

// install youtube-dl
export async function installYoutubedl() {
  // installing youtubedl
  exec(
    "curl -L https://yt-dl.org/downloads/latest/youtube-dl -o /usr/local/bin/youtube-dl \
      && chmod a+rx /usr/local/bin/youtube-dl",
    (err, stdout, stderr) => {
      if (err)
        return logger(
          "download section initialization falied. cant initialize youtubedl.",
          "download"
        );
      return logger("initializing youtubedl done.");
    }
  );
}

// validate and handle download quality command, gets list of all available commands for user
export async function handleDownloadQuality(client, event) {
  let { id } = event.message;
  let chatId = event.isPrivate
    ? event.message.peerId.userId.value
    : event.message.peerId.channelId.value;

  logger("download quality operation started .", "download");

  // validation
  let commands = event.message.text.split(" ");
  if (commands.length == 1) {
    await client.sendMessage(chatId, {
      replyTo: id,
      message:
        "no link is provided. use the following syntax:\n/download-quality [link]",
    });
    return logger("no donwload link is provided.", "download");
  }
  let link = commands[1];

  // informing user
  let informationMessage = await client.sendMessage(chatId, {
    message: "getting list of available qualities for :\n" + link,
    replyTo: id,
    linkPreview: false,
  });

  // get and send the qualities list
  try {
    let qualities = await getQualityList(link);
    await client.invoke(
      new Api.messages.EditMessage({
        peer: chatId,
        id: informationMessage.id,
        message:
          "Select your desired quality : \nCode | Quality | Volume | Format\n" +
          qualities
            .map(
              (d) =>
                d.code +
                " | " +
                d.res +
                " | " +
                d.volume +
                " | " +
                d.format +
                "\n"
            )
            .join("") +
          "you may send your desired quality in form of\n/download [url] [quality?]",
      })
    );
  } catch (err) {
    // errors happended during process
    await client.invoke(
      new Api.messages.EditMessage({
        peer: chatId,
        id: informationMessage.id,
        message:
          "requested operation failed. please inform the developer.\nverbose error :\n" +
          err.message,
      })
    );
  }
}

// getting available video links
export function getQualityList(url) {
  return new Promise((resolve, reject) => {
    exec(`yt-dlp -F ${url} --no-warnings -q`, (err, stdout, stderr) => {
      // operation failed
      if (err) {
        logger("failed to get qualities list.", "download");
        return reject(err);
      }

      // operaion done
      logger("list of available qualities recieved.", "download");
      stdout = stdout.split("\n");
      stdout.shift();
      stdout.shift(); // first two lines are useless
      stdout.pop(); // last line is empty
      let data = [];

      stdout = stdout.map((t) => {
        let temp = t;
        t = t.split(" ").filter((tt) => tt && tt); // remove white spaces, sectionize

        let code = t[0];
        let format = t[1];
        let res = t[2];

        let middleSection = temp
          .split("|")[1]
          .split(" ")
          .filter((tt) => tt && tt != "~" && tt);

        let volume =
          middleSection.length == 3
            ? middleSection[0].replace("~", "")
            : "unknown";

        data.push({
          code,
          format,
          res,
          volume,
        });
      });

      resolve(data);
    });
  });
}

// validate and handle download command
export async function handleDownload(client, event) {
  let { id } = event.message;
  let chatId = event.isPrivate
    ? event.message.peerId.userId.value
    : event.message.peerId.channelId.value;
  logger("download operation started.", "download");

  // validation
  let commands = event.message.text.split(" ");
  if (commands.length == 1) {
    await client.sendMessage(chatId, {
      replyTo: id,
      message:
        "no link is provided. use the following syntax:\n/download [link] [quality?]",
    });
    return logger("no donwload link is provided.", "download");
  }
  let link = commands[1];
  let quality = commands[2] || false;

  let informationMessage = await client.sendMessage(chatId, {
    replyTo: id,
    peer: chatId,
    message:
      "starting to download from : " +
      link +
      (quality
        ? "\nwith selected quality code of " + quality
        : "\nno quality is specified."),
    linkPreview: false,
  });

  let fileName,
    ext,
    uniqueName,
    isDone = false;
  try {
    // file download successfully
    let data = await downloadFile(link, quality);
    fileName = data.fileName;
    ext = data.ext;
    uniqueName = data.uniqueName;
    logger("download operation is done, starting to upload", "download");

    // error downloading file
    await client.invoke(
      new Api.messages.EditMessage({
        id: informationMessage.id,
        peer: chatId,
        message: "file downloaded successfully.starting the upload operartion.",
      })
    );

    isDone = true;
  } catch (err) {
    // error downloading file
    await client.invoke(
      new Api.messages.EditMessage({
        id: informationMessage.id,
        peer: chatId,
        message:
          "failed to download provided file.please inform the developer.\nverbose error:\n" +
          err.message,
      })
    );
  }

  if (isDone) {
    // upload the file
    await uploadFile(
      fileName,
      ext,
      uniqueName,
      client,
      chatId,
      id,
      informationMessage.id
    );
  }
}

// download the actual file
export function downloadFile(link, quality) {
  return new Promise(async (resolve, reject) => {
    // making a unique directory path
    let uniqueName = v4();
    await mkdir(join("./", "files", uniqueName));
    let downloadString =
      "yt-dlp " +
      link +
      " -o ./files/" +
      uniqueName +
      '/"%(title)s.%(ext)s"' +
      " --no-warning ";
    quality && (downloadString += " -f " + quality);

    exec(downloadString, async (err, _stdout, _stderr) => {
      if (err) return reject(err);

      // extract name
      let fileName = await readdir(join("./", "files", uniqueName));
      let ext = extname(fileName[0]);
      fileName = fileName[0].split(ext)[0];
      return resolve({ fileName, ext, uniqueName });
    });
  });
}

// upload the downloaded file
export async function uploadFile(
  fileName,
  ext,
  uniqueName,
  client,
  chatId,
  id,
  informationMessageId
) {
  await client.sendFile(chatId, {
    file: join("./", "files", uniqueName, fileName + ext),
    replyTo: id,
    caption: fileName,
    supportsStreaming: true,
    // file: file, // randomId
    //   thumb: `./temp/${fileName}.png`,
    //   attributes:[new Api.DocumentAttributeVideo({
    //     duration,
    //     h,
    //     w,
    //     supports_streaming: true,
    //   })],
  });

  logger("file uploaded successfully.", "download");

  await client.invoke(
    new Api.messages.DeleteMessages({
      id: [informationMessageId],
      peer: chatId,
    })
  );

  // delete the file
  await deleteFile(uniqueName, fileName, ext);
}

// delete the downloaded file after its uploaded to telegram
export async function deleteFile(uniqueName, fileName, ext) {
  await rm(join("./", "files", uniqueName, fileName + ext));
  await rmdir(join("./", "files", uniqueName));
  logger("file deleted successfully.", "download");
}
