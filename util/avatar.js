import { CustomFile } from "telegram/client/uploads.js";
import { Api } from "telegram";
import { statSync } from "node:fs";

import { logger } from "./helper.js";
import { getTime } from "./bio.js";

export async function avatarClockHandler(client) {
  let { hour, minute } = getTime();
  hour > 11 && (hour -= 12);
  minute > 59 && (minute -= 60);

  if (minute % 5) return;
  logger("handling avatar update ...", "avatar");

  // get current profiles
  const result = await client.invoke(
    new Api.photos.GetUserPhotos({
      userId: "uryzen317",
    })
  );

  // delete last profile photo if there are too many
  if (result.photos.length > process.env.STATIC_AVATARS) {
    const { id, accessHash, fileReference } = result.photos[0];
    await client.invoke(
      new Api.photos.DeletePhotos({
        id: [
          new Api.InputPhoto({
            id,
            accessHash,
            fileReference,
          }),
        ],
      })
    );
    logger("last profile deleted.", "avatar");
  }

  // upload a new one
  try {
    await client.invoke(
      new Api.photos.UploadProfilePhoto({
        file: await client.uploadFile({
          file: new CustomFile(
            `./avatars/${hour}-${minute}.jpg`,
            statSync(`./avatars/${hour}-${minute}.jpg`).size,
            `./avatars/${hour}-${minute}.jpg`
          ),
          workers: 1,
        }),
      })
    );
    logger("profile updated.", "avatar");
  } catch (err) {
    logger("profile update failed :\n." + err, "avatar");
  }
}
