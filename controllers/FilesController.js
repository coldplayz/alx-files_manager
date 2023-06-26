import { Buffer } from 'buffer';
import fs from 'fs';
import { v4 } from 'uuid';
import { contentType } from 'mime-types';
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
    let userId = await redisClient.get(key);
    if (userId == null) {
      // no user token found in Redis
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // user ID retrieved as str 4rm redis; convert to ObjectId
    userId = ObjectId(userId);

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

  /**
   * getShow - retrieves the file document based on the ID.
   * @req {Request}: the Request object.
   * @resp (Response): the Response object.
   */
  static async getShow(req, res) {
    // TODO: eliminate repititive code; from here...
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
    // ...to around here

    // user found; find linked file document
    let fileId = req.params.id;
    const errMessage = { error: 'Unauthorized' };
    if (!fileId) {
      res.status(401).json(errMessage);
      return;
    }
    // verify id is valid ObjectId
    try {
      fileId = ObjectId(fileId);
    } catch (err) {
      res.status(401).json(errMessage);
      return;
    }
    // valid ObjectId; search
    /**
     * for finding a specific doc
     */
    const filterDoc = { _id: fileId, userId: user._id };
    let fileDoc = await dbClient.findFile(filterDoc);
    if (!fileDoc) {
      // no matching file doc found
      res.status(404).json({ error: 'Not found' });
    }

    // file doc found; return it
    // TODO: possible output formatting; check intranet exam.
    fileDoc = { id: fileDoc._id, ...fileDoc }; // format output first
    delete fileDoc._id;
    res.json(fileDoc);
  }

  /**
   * getIndex - return page of files matching the user ID and specified parent ID.
   */
  static async getIndex(req, res) {
    // TODO: eliminate repititive code; from here...
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
    // ...to around here

    // get query parameters
    // console.log(Object.entries(req)); // SCAFF
    let { page } = req.query;
    if (!page) {
      // no page number provided
      page = -1;
    } else {
      // TODO: validate that `page` is a numeric string
      page = Number(page);
    }
    let { parentId } = req.query;
    if (parentId) {
      // TODO: wrap in try/catch block; ObjectId throws
      parentId = ObjectId(parentId);
    } else {
      // none provided; use default
      parentId = '0';
    }

    // user validated; get parent files for this user
    const filterDoc = { parentId, userId: user._id };
    const files = await dbClient.getPaginatedFiles(20/* page size */, page, filterDoc); // an array
    // console.log(Object.entries(files)); // SCAFF
    const filesToSend = [];
    for (let file of files) {
      if (file._id) {
        // rename _id to id
        file = { id: file._id, ...file };
        delete file._id;
        filesToSend.push(file);
      }
    }

    // return list
    res.json(filesToSend);
  }

  static async putPublish(req, res) {
    // TODO: eliminate repititive code; from here...
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
    // ...to around here

    // get uri id parameter
    let { id } = req.params;
    id = ObjectId(id); // TODO: try/catch; ObjectId throws

    // get file with given id and userId
    const filterDoc = { _id: id, userId: user._id };
    const fileDoc = await dbClient.findFile(filterDoc);
    if (!fileDoc) {
      // no match found
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // edit and update file document
    fileDoc.isPublic = true;
    await dbClient.updateFileDoc(filterDoc, fileDoc);

    // return the updated file document
    const toSend = dbClient.formatFileDoc(fileDoc);
    res.json(toSend);
  }

  static async putUnpublish(req, res) {
    // TODO: eliminate repititive code; from here...
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
    // ...to around here

    // get uri id parameter
    let { id } = req.params;
    id = ObjectId(id); // TODO: try/catch; ObjectId throws

    // get file with given id and userId
    const filterDoc = { _id: id, userId: user._id };
    const fileDoc = await dbClient.findFile(filterDoc);
    if (!fileDoc) {
      // no match found
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // edit and update file document
    fileDoc.isPublic = false;
    await dbClient.updateFileDoc(filterDoc, fileDoc);

    // return the updated file document
    const toSend = dbClient.formatFileDoc(fileDoc);
    res.json(toSend);
  }

  /**
   * getFile - returns the content of a specific file document
   */
  static async getFile(req, res) {
    // TODO: eliminate repititive code; from here...
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
    // ...to around here

    // get uri id parameter
    let { id } = req.params;
    id = ObjectId(id); // TODO: try/catch; ObjectId throws

    // get file with given id and userId
    const filterDoc = { _id: id, userId: user._id };
    const fileDoc = await dbClient.findFile(filterDoc);
    if (!fileDoc || fileDoc.isPublic === false) {
      // no match found, or not public yet
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // ensure fileDoc is not for a folder
    if (fileDoc.type === 'folder') {
      res.status(400).json({ error: 'A folder doesn\'t have content' });
      return;
    }

    // fileDoc is for a file [or image?]
    // retrieve file contents from file system
    // TODO: this will work for text files; images?
    let fileContent;
    try {
      fileContent = await fs.promises.readFile(fileDoc.localPath);
      fileContent = fileContent.toString();
    } catch (err) {
      // ERROR: ENOENT: no such file or directory
      // file not present locally
      res.status(404).json({ error: 'Not found' });
      return;
    }

    // file content retrieved; return content with correct mime-type
    const mimeType = contentType(fileDoc.name); // full header
    res.set('Content-Type', mimeType);
    res.send(fileContent);
  }
}

export default FilesController;
