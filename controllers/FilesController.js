import { Buffer } from 'buffer';
import fs from 'fs';
import { v4 } from 'uuid';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.get('X-Token');
    if (!token) {
      // no token
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // retrieve the user ID from Redis with token
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId == null) {
      // no user token found in Redis
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // retrieve the user document object from MongoDB
    const objID = ObjectId(userId);
    const user = await dbClient.findUser({ _id: objID });
    if (user == null) {
      // no user token found in Redis
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // user found and authenticated
    // retrieve and parse file attributes
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }

    const { type } = req.body;
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      // type is not available, or not of acceptable kind
      res.status(400).json({ error: 'Missing type' });
      return;
    }

    let { parentId } = req.body; // optional
    if (parentId) {
      // ensure the parent actually exists
      if (parentId !== '0') {
        // possible ObjectId string; confirm and cast
        try {
          parentId = ObjectId(parentId);
        } catch (err) {
          res.status(400).json({ error: 'Parent not found' });
          return;
        }
      }

      // parentId now '0' (root) or a valid ObjectId
      if (parentId instanceof ObjectId) {
        // parent document exists; no doc for root [folder]
        const parentDoc = await dbClient.findFile({ _id: parentId });
        if (!parentDoc) {
          // parent does not exist in MongoDB
          res.status(400).json({ error: 'Parent not found' });
          return;
        }
        // console.log(parentDoc.type); // SCAFF
        // parent exists; ensure it's a folder
        if (parentDoc.type !== 'folder') {
          res.status(400).json({ error: 'Parent is not a folder' });
          return;
        }
      }
    } else {
      // set default
      parentId = '0';
    }

    let { isPublic } = req.body; // optional
    if (!isPublic || isPublic === 'false') {
      isPublic = false;
    }

    const { data } = req.body; // base64 of file content
    if (!data && type !== 'folder') {
      res.status(400).json({ error: 'Missing name' });
      return;
    }

    // path for storing files locally, on disk
    let folderPath = process.env.FOLDER_PATH ? process.env.FOLDER_PATH : '/tmp/files_manager';

    // file attributes parsed successfully
    const toSend = {
      id: undefined,
      userId,
      name,
      type,
      isPublic,
      parentId,
    }; // for responding to request
    const fileDoc = { ...toSend }; // for persisting
    delete fileDoc.id; // not to be persisted; for responding

    let idObj; // for storing return of dbClient.createFile

    if (type === 'folder') {
      // save to MongoDB and send immediately
      idObj = await dbClient.createFile(fileDoc);
      toSend.id = idObj.id;
      res.status(201).json(toSend);
      return;
    }

    // type is file or image;
    // get the file content for storage/persisting to disk
    // const stringData = Buffer.from(data, 'base64').toString('utf8'); // use this to convert to
    // ...string with specified encoding. Use buffer
    // ...obj below for persisting both text and image data
    const bufferData = Buffer.from(data, 'base64');
    // process its persistence to disk
    const fileName = `/${v4()}`; // uuid-based
    if (folderPath.endsWith('/')) {
      // strip it off
      folderPath = folderPath.slice(0, -1);
    }
    const localPath = `${folderPath}${fileName}`;
    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
      await fs.promises.writeFile(localPath, bufferData);
    } catch (err) {
      console.log(err.toString());
    }
    // save to MongoDB
    fileDoc.localPath = localPath;
    idObj = await dbClient.createFile(fileDoc);
    toSend.id = idObj.id;
    // send over the wire
    res.status(201).json(toSend);
  }
}

export default FilesController;
